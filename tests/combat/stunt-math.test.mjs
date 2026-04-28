import { describe, it, expect } from "vitest";
import {
  computeStuntReward,
  splitMotePayout,
  splitWillpowerPayout,
  aggregateStuntPayouts
} from "../../module/combat/stunt-math.mjs";

// ── computeStuntReward ────────────────────────────────────────────────
describe("computeStuntReward", () => {
  it("stunt 0 → no reward", () => {
    expect(computeStuntReward({ stunt: 0, advancesMotivation: false, rewardKind: "motes" }))
      .toEqual({ motes: 0, willpower: 0 });
  });

  it("stunt 1 → 2 motes, no choice", () => {
    expect(computeStuntReward({ stunt: 1, advancesMotivation: false, rewardKind: "motes" }))
      .toEqual({ motes: 2, willpower: 0 });
  });

  it("stunt 1 + advances motivation → 2 motes + 1 WP rider", () => {
    expect(computeStuntReward({ stunt: 1, advancesMotivation: true, rewardKind: "motes" }))
      .toEqual({ motes: 2, willpower: 1 });
  });

  it("stunt 2, motes preference → 4 motes", () => {
    expect(computeStuntReward({ stunt: 2, advancesMotivation: false, rewardKind: "motes" }))
      .toEqual({ motes: 4, willpower: 0 });
  });

  it("stunt 2, motes preference + advances → 4 motes + 1 WP", () => {
    expect(computeStuntReward({ stunt: 2, advancesMotivation: true, rewardKind: "motes" }))
      .toEqual({ motes: 4, willpower: 1 });
  });

  it("stunt 2, willpower preference → 1 WP", () => {
    expect(computeStuntReward({ stunt: 2, advancesMotivation: false, rewardKind: "willpower" }))
      .toEqual({ motes: 0, willpower: 1 });
  });

  it("stunt 2, willpower preference + advances → 2 WP", () => {
    expect(computeStuntReward({ stunt: 2, advancesMotivation: true, rewardKind: "willpower" }))
      .toEqual({ motes: 0, willpower: 2 });
  });

  it("stunt 3, motes preference → 6 motes", () => {
    expect(computeStuntReward({ stunt: 3, advancesMotivation: false, rewardKind: "motes" }))
      .toEqual({ motes: 6, willpower: 0 });
  });

  it("stunt 3, willpower preference → 1 WP", () => {
    expect(computeStuntReward({ stunt: 3, advancesMotivation: false, rewardKind: "willpower" }))
      .toEqual({ motes: 0, willpower: 1 });
  });

  it("stunt 3, willpower preference + advances → 2 WP", () => {
    expect(computeStuntReward({ stunt: 3, advancesMotivation: true, rewardKind: "willpower" }))
      .toEqual({ motes: 0, willpower: 2 });
  });
});

// ── splitMotePayout ──────────────────────────────────────────────────
describe("splitMotePayout", () => {
  it("fits entirely in personal", () => {
    expect(splitMotePayout({ motes: 4, personalAvailable: 10, peripheralAvailable: 10 }))
      .toEqual({ toPersonal: 4, toPeripheral: 0, wasted: 0 });
  });

  it("overflows from personal to peripheral", () => {
    expect(splitMotePayout({ motes: 4, personalAvailable: 2, peripheralAvailable: 10 }))
      .toEqual({ toPersonal: 2, toPeripheral: 2, wasted: 0 });
  });

  it("partial waste when both pools have limited room", () => {
    expect(splitMotePayout({ motes: 6, personalAvailable: 1, peripheralAvailable: 2 }))
      .toEqual({ toPersonal: 1, toPeripheral: 2, wasted: 3 });
  });

  it("full waste when both pools are full", () => {
    expect(splitMotePayout({ motes: 4, personalAvailable: 0, peripheralAvailable: 0 }))
      .toEqual({ toPersonal: 0, toPeripheral: 0, wasted: 4 });
  });
});

// ── splitWillpowerPayout ─────────────────────────────────────────────
describe("splitWillpowerPayout", () => {
  it("paid in full when headroom is sufficient", () => {
    expect(splitWillpowerPayout({ willpower: 1, willpowerAvailable: 5 }))
      .toEqual({ paid: 1, wasted: 0 });
  });

  it("partial waste when headroom is limited", () => {
    expect(splitWillpowerPayout({ willpower: 2, willpowerAvailable: 1 }))
      .toEqual({ paid: 1, wasted: 1 });
  });
});

// ── aggregateStuntPayouts ────────────────────────────────────────────
describe("aggregateStuntPayouts", () => {
  it("empty array → all zeros, empty perRecord", () => {
    expect(aggregateStuntPayouts({
      rewards: [],
      personalAvailable: 10,
      peripheralAvailable: 10,
      willpowerAvailable: 5
    })).toEqual({
      toPersonal: 0,
      toPeripheral: 0,
      toWillpower: 0,
      wastedMotes: 0,
      wastedWillpower: 0,
      perRecord: []
    });
  });

  it("single 2-die motes record fits in personal", () => {
    const rewards = [{ stunt: 2, advancesMotivation: false, rewardKind: "motes" }];
    expect(aggregateStuntPayouts({
      rewards,
      personalAvailable: 10,
      peripheralAvailable: 10,
      willpowerAvailable: 5
    })).toEqual({
      toPersonal: 4,
      toPeripheral: 0,
      toWillpower: 0,
      wastedMotes: 0,
      wastedWillpower: 0,
      perRecord: [{ stunt: 2, motes: 4, willpower: 0 }]
    });
  });

  it("multi-record overflow: 1-die motes + 2-die WP+adv + 3-die motes+adv with limited headroom", () => {
    // Gross: motes = 2 + 0 + 6 = 8; WP = 0 + 2 + 1 = 3
    // Headroom: personal 1, peripheral 2, willpower 1
    // splitMotePayout(8, 1, 2) = { toPersonal: 1, toPeripheral: 2, wasted: 5 }
    // splitWillpowerPayout(3, 1) = { paid: 1, wasted: 2 }
    const rewards = [
      { stunt: 1, advancesMotivation: false, rewardKind: "motes" },
      { stunt: 2, advancesMotivation: true,  rewardKind: "willpower" },
      { stunt: 3, advancesMotivation: true,  rewardKind: "motes" }
    ];
    expect(aggregateStuntPayouts({
      rewards,
      personalAvailable: 1,
      peripheralAvailable: 2,
      willpowerAvailable: 1
    })).toEqual({
      toPersonal: 1,
      toPeripheral: 2,
      toWillpower: 1,
      wastedMotes: 5,
      wastedWillpower: 2,
      perRecord: [
        { stunt: 1, motes: 2, willpower: 0 },
        { stunt: 2, motes: 0, willpower: 2 },
        { stunt: 3, motes: 6, willpower: 1 }
      ]
    });
  });
});
