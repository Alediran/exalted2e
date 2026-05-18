import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkAttackRange } from "../../module/helpers/targeting.mjs";

// Stub canvas + game.combat per test. _tokenForActor (private) reads:
//   game.combat?.combatants?.find(c => c.actorId === actor.id)?.token?.object
//   actor?.getActiveTokens?.()[0]
// We provide tokens via getActiveTokens to keep tests independent of combat state.

const RANGE_BANDS = [
  { key: "short",  maxFraction: 1 / 3, penalty: 0, labelKey: "EX2E.RangeBandShort"  },
  { key: "medium", maxFraction: 2 / 3, penalty: 0, labelKey: "EX2E.RangeBandMedium" },
  { key: "long",   maxFraction: 1,     penalty: 2, labelKey: "EX2E.RangeBandLong"   },
];

let originalCanvas;
let originalCombat;
let originalExalted;

beforeEach(() => {
  originalCanvas  = globalThis.canvas;
  originalCombat  = globalThis.game.combat;
  originalExalted = globalThis.game.exalted2e;
  globalThis.game.combat    = null;                             // force fall-through to getActiveTokens
  globalThis.game.exalted2e = { EX2E: { rangeBands: RANGE_BANDS } };
});

afterEach(() => {
  globalThis.canvas         = originalCanvas;
  globalThis.game.combat    = originalCombat;
  globalThis.game.exalted2e = originalExalted;
});

function makeActorWithToken({ id = "a", x = 0, y = 0 } = {}) {
  const token = { center: { x, y } };
  return {
    id,
    getActiveTokens: () => [token]
  };
}

function setMeasurePath({ distance, spaces }) {
  globalThis.canvas = {
    grid: {
      measurePath: () => ({ distance, spaces })
    }
  };
}

describe("checkAttackRange", () => {
  it("returns null when either actor has no token", () => {
    setMeasurePath({ distance: 1, spaces: 1 });
    const attacker = makeActorWithToken();
    const target = { id: "t", getActiveTokens: () => [] };        // no token
    expect(checkAttackRange({ effectiveRange: 0 }, attacker, target)).toBe(null);
  });

  it("melee (range 0) is in range at 1 space", () => {
    setMeasurePath({ distance: 5, spaces: 1 });
    const attacker = makeActorWithToken({ id: "a" });
    const target = makeActorWithToken({ id: "t" });
    const result = checkAttackRange({ effectiveRange: 0, tags: [] }, attacker, target);
    expect(result.inRange).toBe(true);
    expect(result.maxRange).toBe(1);
  });

  it("melee out of range at 2 spaces (no Reach tag)", () => {
    setMeasurePath({ distance: 10, spaces: 2 });
    const attacker = makeActorWithToken({ id: "a" });
    const target = makeActorWithToken({ id: "t" });
    const result = checkAttackRange({ effectiveRange: 0, tags: [] }, attacker, target);
    expect(result.inRange).toBe(false);
  });

  it("Reach tag extends melee range to 2 spaces", () => {
    setMeasurePath({ distance: 10, spaces: 2 });
    const attacker = makeActorWithToken({ id: "a" });
    const target = makeActorWithToken({ id: "t" });
    const result = checkAttackRange({ effectiveRange: 0, tags: ["Reach"] }, attacker, target);
    expect(result.inRange).toBe(true);
    expect(result.maxRange).toBe(2);
  });

  it("ranged weapon: distance ≤ effectiveRange is in range", () => {
    setMeasurePath({ distance: 30, spaces: 6 });
    const attacker = makeActorWithToken({ id: "a" });
    const target = makeActorWithToken({ id: "t" });
    const result = checkAttackRange({ effectiveRange: 50, tags: [] }, attacker, target);
    expect(result.inRange).toBe(true);
    expect(result.distance).toBe(30);
    expect(result.maxRange).toBe(50);
  });

  // ── Range bands ──────────────────────────────────────────────────────
  // effectiveRange = 30: short ≤10, medium ≤20, long ≤30

  it("short range (≤ 1/3 max): band=short, penalty=0", () => {
    setMeasurePath({ distance: 10, spaces: 2 });
    const result = checkAttackRange(
      { effectiveRange: 30, tags: [] },
      makeActorWithToken({ id: "a" }), makeActorWithToken({ id: "t" })
    );
    expect(result.inRange).toBe(true);
    expect(result.band).toBe("short");
    expect(result.rangePenalty).toBe(0);
  });

  it("medium range (> 1/3 and ≤ 2/3 max): band=medium, penalty=0", () => {
    setMeasurePath({ distance: 15, spaces: 3 });
    const result = checkAttackRange(
      { effectiveRange: 30, tags: [] },
      makeActorWithToken({ id: "a" }), makeActorWithToken({ id: "t" })
    );
    expect(result.inRange).toBe(true);
    expect(result.band).toBe("medium");
    expect(result.rangePenalty).toBe(0);
  });

  it("long range (> 2/3 and ≤ max): band=long, penalty=2", () => {
    setMeasurePath({ distance: 25, spaces: 5 });
    const result = checkAttackRange(
      { effectiveRange: 30, tags: [] },
      makeActorWithToken({ id: "a" }), makeActorWithToken({ id: "t" })
    );
    expect(result.inRange).toBe(true);
    expect(result.band).toBe("long");
    expect(result.rangePenalty).toBe(2);
  });

  it("exactly at max range: still in range, band=long", () => {
    setMeasurePath({ distance: 30, spaces: 6 });
    const result = checkAttackRange(
      { effectiveRange: 30, tags: [] },
      makeActorWithToken({ id: "a" }), makeActorWithToken({ id: "t" })
    );
    expect(result.inRange).toBe(true);
    expect(result.band).toBe("long");
  });

  it("beyond max range: inRange=false, band=null", () => {
    setMeasurePath({ distance: 35, spaces: 7 });
    const result = checkAttackRange(
      { effectiveRange: 30, tags: [] },
      makeActorWithToken({ id: "a" }), makeActorWithToken({ id: "t" })
    );
    expect(result.inRange).toBe(false);
    expect(result.band).toBe(null);
    expect(result.rangePenalty).toBe(0);
  });

  it("melee weapon: band=null, rangePenalty=0", () => {
    setMeasurePath({ distance: 5, spaces: 1 });
    const result = checkAttackRange(
      { effectiveRange: 0, tags: [] },
      makeActorWithToken({ id: "a" }), makeActorWithToken({ id: "t" })
    );
    expect(result.band).toBe(null);
    expect(result.rangePenalty).toBe(0);
  });
});
