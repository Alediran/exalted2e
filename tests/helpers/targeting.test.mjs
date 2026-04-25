import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkAttackRange } from "../../module/helpers/targeting.mjs";

// Stub canvas + game.combat per test. _tokenForActor (private) reads:
//   game.combat?.combatants?.find(c => c.actorId === actor.id)?.token?.object
//   actor?.getActiveTokens?.()[0]
// We provide tokens via getActiveTokens to keep tests independent of combat state.

let originalCanvas;
let originalCombat;

beforeEach(() => {
  originalCanvas = globalThis.canvas;
  originalCombat = globalThis.game.combat;
  globalThis.game.combat = null;                                // force fall-through to getActiveTokens
});

afterEach(() => {
  globalThis.canvas = originalCanvas;
  globalThis.game.combat = originalCombat;
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
});
