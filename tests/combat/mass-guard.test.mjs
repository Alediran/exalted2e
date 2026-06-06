import { describe, it, expect } from "vitest";
import { collectGuardTargets } from "../../module/combat/mass-guard.mjs";

function combatWith(...pairs) {
  // pairs: [combatantId, actorId, name]
  return { combatants: pairs.map(([id, actorId, name]) => ({ id, actor: { id: actorId }, name })) };
}
const tok = actorId => ({ actor: { id: actorId } });

describe("collectGuardTargets", () => {
  it("maps distinct tokens to their combatants", () => {
    const combat = combatWith(["c1", "a1", "A"], ["c2", "a2", "B"]);
    const r = collectGuardTargets(combat, [tok("a1"), tok("a2")]);
    expect(r.combatants.map(c => c.id)).toEqual(["c1", "c2"]);
    expect(r.skipped).toBe(0);
  });

  it("dedupes two tokens of the same actor to one combatant", () => {
    const combat = combatWith(["c1", "a1", "A"]);
    const r = collectGuardTargets(combat, [tok("a1"), tok("a1")]);
    expect(r.combatants.map(c => c.id)).toEqual(["c1"]);
    expect(r.skipped).toBe(0);
  });

  it("counts tokens with no combatant as skipped", () => {
    const combat = combatWith(["c1", "a1", "A"]);
    const r = collectGuardTargets(combat, [tok("a1"), tok("aX")]);
    expect(r.combatants.map(c => c.id)).toEqual(["c1"]);
    expect(r.skipped).toBe(1);
  });

  it("returns empty for null combat or non-array tokens", () => {
    expect(collectGuardTargets(null, [tok("a1")])).toEqual({ combatants: [], skipped: 0 });
    expect(collectGuardTargets(combatWith(["c1", "a1", "A"]), null)).toEqual({ combatants: [], skipped: 0 });
  });

  it("skips a token with no actor", () => {
    const combat = combatWith(["c1", "a1", "A"]);
    const r = collectGuardTargets(combat, [{}, tok("a1")]);
    expect(r.combatants.map(c => c.id)).toEqual(["c1"]);
    expect(r.skipped).toBe(1);
  });
});
