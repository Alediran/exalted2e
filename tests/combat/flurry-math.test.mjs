import { describe, it, expect } from "vitest";
import { computeFlurryPreview, normalizeFlurryActions, effectiveModeRate, isModeOptionEnabled }
  from "../../module/combat/flurry-math.mjs";

describe("computeFlurryPreview", () => {
  it("normal flurry: speed=max, dvPenalty=maxDv+(n-1), dicePenalty=n-1", () => {
    const actions = [
      { actionKey: "attack", speed: 5, dvMod: 1 },
      { actionKey: "move",   speed: 6, dvMod: 0 },
    ];
    expect(computeFlurryPreview(actions)).toEqual({ count: 2, dicePenalty: 1, speed: 6, dvPenalty: 2 });
  });
  it("quick-draw (2 rows: a draw + its weapon attack) uses MIN speed", () => {
    const actions = [
      { actionKey: "draw", speed: 5, dvMod: 0, weaponId: "w1" },
      { actionKey: "weapon:w1:0", speed: 5, dvMod: 1 },
    ];
    expect(computeFlurryPreview(actions).speed).toBe(5);
  });
  it("quick-draw min picks the lower of the two speeds", () => {
    const actions = [
      { actionKey: "draw", speed: 3, dvMod: 0, weaponId: "w1" },
      { actionKey: "weapon:w1:0", speed: 6, dvMod: 0 },
    ];
    expect(computeFlurryPreview(actions).speed).toBe(3);
  });
  it("single action: dicePenalty/dvPenalty floor at 0", () => {
    expect(computeFlurryPreview([{ actionKey: "attack", speed: 4, dvMod: 0 }]))
      .toEqual({ count: 1, dicePenalty: 0, speed: 4, dvPenalty: 0 });
  });
});

describe("normalizeFlurryActions", () => {
  const fallback = { key: "move", speed: 5, dvMod: 0 };
  it("resets a weapon row whose weapon is missing", () => {
    const actions = [{ actionKey: "weapon:gone:0", speed: 9, dvMod: 2, weaponId: "" }];
    const out = normalizeFlurryActions(actions, new Set(), {}, fallback);
    expect(out[0]).toEqual({ actionKey: "move", speed: 5, dvMod: 0, weaponId: "" });
  });
  it("keeps a weapon row whose weapon is equipped", () => {
    const actions = [{ actionKey: "weapon:w1:0", speed: 9, dvMod: 2, weaponId: "" }];
    const out = normalizeFlurryActions(actions, new Set(), { w1: { equipped: true } }, fallback);
    expect(out[0].actionKey).toBe("weapon:w1:0");
  });
  it("keeps a weapon row whose weapon is drawn (not equipped)", () => {
    const actions = [{ actionKey: "weapon:w1:0", speed: 9, dvMod: 2, weaponId: "" }];
    const out = normalizeFlurryActions(actions, new Set(["w1"]), { w1: { equipped: false } }, fallback);
    expect(out[0].actionKey).toBe("weapon:w1:0");
  });
  it("leaves non-weapon rows untouched", () => {
    const actions = [{ actionKey: "attack", speed: 5, dvMod: 1, weaponId: "" }];
    expect(normalizeFlurryActions(actions, new Set(), {}, fallback)[0].actionKey).toBe("attack");
  });
});

describe("effectiveModeRate", () => {
  it("adds the charm bonus to the base rate, floored at 1", () => {
    expect(effectiveModeRate(3, 0)).toBe(3);
    expect(effectiveModeRate(2, 1)).toBe(3);
    expect(effectiveModeRate(1, -5)).toBe(1);
    expect(effectiveModeRate(undefined, 0)).toBe(1);
  });
});

describe("isModeOptionEnabled", () => {
  it("enabled when (equipped or drawn) and otherUses < rate", () => {
    expect(isModeOptionEnabled(true, false, 0, 3)).toBe(true);
    expect(isModeOptionEnabled(false, true, 2, 3)).toBe(true);
  });
  it("disabled when neither equipped nor drawn", () => {
    expect(isModeOptionEnabled(false, false, 0, 3)).toBe(false);
  });
  it("disabled when otherUses has reached the rate", () => {
    expect(isModeOptionEnabled(true, false, 3, 3)).toBe(false);
  });
});
