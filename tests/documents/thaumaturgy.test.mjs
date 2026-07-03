import { vi, describe, it, expect, beforeEach } from "vitest";
import { computeThaumPool, rollProcedure } from "../../module/rolls/thaumaturgy.mjs";
import { ExaltedRoll } from "../../module/rolls/exalted-roll.mjs";

vi.mock("../../module/rolls/exalted-roll.mjs", () => ({
  ExaltedRoll: {
    rollPool: vi.fn().mockResolvedValue({ successes: 5, botch: false })
  }
}));

// ── computeThaumPool ──────────────────────────────────────────────────────────

describe("computeThaumPool", () => {
  it("sums attribute + occult + art degree", () => {
    expect(computeThaumPool(3, 2, 1)).toBe(6);
  });

  it("returns 0 for all-zero inputs", () => {
    expect(computeThaumPool(0, 0, 0)).toBe(0);
  });

  it("treats null/undefined values as 0", () => {
    expect(computeThaumPool(null, undefined, 2)).toBe(2);
  });

  it("adds correctly for max values", () => {
    expect(computeThaumPool(5, 5, 3)).toBe(13);
  });
});

// ── rollProcedure ─────────────────────────────────────────────────────────────

function makeActor(artItems = []) {
  return {
    id: "actor-1",
    system: {
      attributes: { intelligence: { value: 4 } },
      abilities:  { occult:       { value: 2 } },
    },
    items: artItems,
  };
}

function makeProcedure(overrides = {}) {
  return {
    name: "Brew Healing Tonic",
    system: {
      art:         overrides.art        ?? "Alchemy",
      minDegree:   overrides.minDegree  ?? 2,
      attribute:   overrides.attribute  ?? "intelligence",
      difficulty:  overrides.difficulty ?? 3,
      castingTime: overrides.castingTime ?? "one hour",
      description: "Test procedure description",
      ...overrides,
    },
  };
}

const matchingArt = { type: "thaum-art", system: { artName: "Alchemy", degree: 3 } };

beforeEach(() => {
  vi.clearAllMocks();
  ExaltedRoll.rollPool.mockResolvedValue({ successes: 5, botch: false });
});

describe("rollProcedure – no matching art", () => {
  it("returns null when actor has no items", async () => {
    const result = await rollProcedure(makeActor([]), makeProcedure());
    expect(result).toBeNull();
  });

  it("calls ui.notifications.warn when no art item found", async () => {
    await rollProcedure(makeActor([]), makeProcedure());
    expect(ui.notifications.warn).toHaveBeenCalledWith("EX2E.ThaummNoArt");
  });

  it("returns null when art exists but degree is too low", async () => {
    const lowDegreeArt = { type: "thaum-art", system: { artName: "Alchemy", degree: 1 } };
    const result = await rollProcedure(makeActor([lowDegreeArt]), makeProcedure({ minDegree: 2 }));
    expect(result).toBeNull();
  });

  it("returns null when art name does not match procedure art", async () => {
    const wrongArt = { type: "thaum-art", system: { artName: "Geomancy", degree: 3 } };
    const result = await rollProcedure(makeActor([wrongArt]), makeProcedure({ art: "Alchemy" }));
    expect(result).toBeNull();
  });

  it("does not call ExaltedRoll.rollPool when no art is found", async () => {
    await rollProcedure(makeActor([]), makeProcedure());
    expect(ExaltedRoll.rollPool).not.toHaveBeenCalled();
  });
});

describe("rollProcedure – happy path", () => {
  it("calls ExaltedRoll.rollPool when art item matches", async () => {
    await rollProcedure(makeActor([matchingArt]), makeProcedure());
    expect(ExaltedRoll.rollPool).toHaveBeenCalled();
  });

  it("passes correct pool (attr + occult + artDeg) to rollPool", async () => {
    await rollProcedure(makeActor([matchingArt]), makeProcedure());
    const callArgs = ExaltedRoll.rollPool.mock.calls[0];
    expect(callArgs[1].pool).toBe(9); // 4 + 2 + 3
  });

  it("passes flavor = procedure name to rollPool", async () => {
    await rollProcedure(makeActor([matchingArt]), makeProcedure());
    expect(ExaltedRoll.rollPool.mock.calls[0][1].flavor).toBe("Brew Healing Tonic");
  });

  it("calls ChatMessage.create to post result card", async () => {
    await rollProcedure(makeActor([matchingArt]), makeProcedure());
    expect(ChatMessage.create).toHaveBeenCalled();
  });

  it("returns the roll result", async () => {
    const result = await rollProcedure(makeActor([matchingArt]), makeProcedure());
    expect(result).toEqual({ successes: 5, botch: false });
  });

  it("returns null when rollPool returns null", async () => {
    ExaltedRoll.rollPool.mockResolvedValue(null);
    const result = await rollProcedure(makeActor([matchingArt]), makeProcedure());
    expect(result).toBeNull();
  });

  it("does not set pendingAction flag when game.combat is null", async () => {
    game.combat = null;
    const result = await rollProcedure(makeActor([matchingArt]), makeProcedure({ castingTime: "instant" }));
    expect(result).not.toBeNull();
  });
});

describe("rollProcedure – combat instant action", () => {
  it("stamps pendingAction flag on combatant when combat started + castingTime instant", async () => {
    const mockCombatant = {
      actorId: "actor-1",
      setFlag: vi.fn().mockResolvedValue(undefined),
    };
    game.combat = {
      started:    true,
      combatants: { find: (fn) => mockCombatant },
    };
    await rollProcedure(makeActor([matchingArt]), makeProcedure({ castingTime: "instant" }));
    expect(mockCombatant.setFlag).toHaveBeenCalledWith(
      "exalted2e", "pendingAction",
      expect.objectContaining({ actionKey: "thaumaturgy", speed: 3 })
    );
    game.combat = null;
  });

  it("does not stamp flag when castingTime is not instant", async () => {
    const mockCombatant = { actorId: "actor-1", setFlag: vi.fn() };
    game.combat = {
      started:    true,
      combatants: { find: () => mockCombatant },
    };
    await rollProcedure(makeActor([matchingArt]), makeProcedure({ castingTime: "one hour" }));
    expect(mockCombatant.setFlag).not.toHaveBeenCalled();
    game.combat = null;
  });
});
