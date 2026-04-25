import { describe, it, expect } from "vitest";
import {
  sortCombatants,
  computeTickFromJB,
  planCommitOnAim
} from "../../module/combat/combat-math.mjs";

// Helper: build a combatant-shaped object with just the fields sortCombatants reads.
function combatant({ id = "x", name = "", init = 0, acted = false, dex = 0, wits = 0 } = {}) {
  return {
    id, name,
    initiative: init,
    flags: { exalted2e: { actedThisTick: acted } },
    actor: { system: { attributes: { dexterity: { value: dex }, wits: { value: wits } } } }
  };
}

// ── sortCombatants ───────────────────────────────────────────────────
describe("sortCombatants", () => {
  it("unacted combatants come before acted (primary sort)", () => {
    const a = combatant({ id: "a", init: 5, acted: true });
    const b = combatant({ id: "b", init: 0, acted: false });
    expect(sortCombatants(a, b)).toBeGreaterThan(0);           // a after b
    expect(sortCombatants(b, a)).toBeLessThan(0);              // b before a
  });

  it("lower initiative comes first within the same acted-bucket", () => {
    const a = combatant({ id: "a", init: 3 });
    const b = combatant({ id: "b", init: 5 });
    expect(sortCombatants(a, b)).toBeLessThan(0);
  });

  it("higher Dexterity wins when initiative ties", () => {
    const a = combatant({ id: "a", init: 3, dex: 4 });
    const b = combatant({ id: "b", init: 3, dex: 2 });
    expect(sortCombatants(a, b)).toBeLessThan(0);              // higher dex first
  });

  it("higher Wits breaks a Dex tie", () => {
    const a = combatant({ id: "a", init: 3, dex: 3, wits: 5 });
    const b = combatant({ id: "b", init: 3, dex: 3, wits: 3 });
    expect(sortCombatants(a, b)).toBeLessThan(0);
  });

  it("name localeCompare breaks Dex+Wits tie", () => {
    const a = combatant({ id: "a", name: "Alice", init: 3, dex: 2, wits: 2 });
    const b = combatant({ id: "b", name: "Bob",   init: 3, dex: 2, wits: 2 });
    expect(sortCombatants(a, b)).toBeLessThan(0);
  });

  it("missing initiative treated as Infinity (sorts last within bucket)", () => {
    const a = combatant({ id: "a", init: NaN });
    const b = combatant({ id: "b", init: 5 });
    expect(sortCombatants(a, b)).toBeGreaterThan(0);           // NaN → Infinity, so b first
  });
});

// ── computeTickFromJB ────────────────────────────────────────────────
describe("computeTickFromJB", () => {
  it("winner (max == theirs) lands on tick 0", () => {
    expect(computeTickFromJB(5, false, 5)).toBe(0);
  });

  it("losers spread at max - theirs", () => {
    expect(computeTickFromJB(3, false, 5)).toBe(2);
    expect(computeTickFromJB(1, false, 5)).toBe(4);
  });

  it("clamps to tick 6 even for a very large gap", () => {
    expect(computeTickFromJB(1, false, 20)).toBe(6);
  });

  it("botcher lands on tick 6 regardless of successes", () => {
    expect(computeTickFromJB(10, true, 10)).toBe(6);           // botched winner still tick 6
  });

  it("botcher overrides even a zero successes result", () => {
    expect(computeTickFromJB(0, true, 5)).toBe(6);
  });
});

// ── planCommitOnAim ──────────────────────────────────────────────────
describe("planCommitOnAim", () => {
  it("no aim → no changes", () => {
    expect(planCommitOnAim({ pending: { actionKey: "attack" }, flurry: null, aim: null }))
      .toEqual({ clearAim: false, applyAbortPenalty: false });
  });

  it("aim continuation (re-aim same target) keeps aim flag", () => {
    const aim     = { targetActorId: "T" };
    const pending = { actionKey: "aim", targetActorId: "T" };
    expect(planCommitOnAim({ pending, flurry: null, aim }))
      .toEqual({ clearAim: false, applyAbortPenalty: false });
  });

  it("aimed attack (same target) consumes aim without penalty", () => {
    const aim     = { targetActorId: "T" };
    const pending = { actionKey: "attack", targetActorId: "T" };
    expect(planCommitOnAim({ pending, flurry: null, aim }))
      .toEqual({ clearAim: true, applyAbortPenalty: false });
  });

  it("attack on a DIFFERENT target is a divert (clear + penalty)", () => {
    const aim     = { targetActorId: "T" };
    const pending = { actionKey: "attack", targetActorId: "OTHER" };
    expect(planCommitOnAim({ pending, flurry: null, aim }))
      .toEqual({ clearAim: true, applyAbortPenalty: true });
  });

  it("any non-aim non-attack pending action is a divert (e.g., move)", () => {
    const aim     = { targetActorId: "T" };
    const pending = { actionKey: "move", targetActorId: "T" };
    expect(planCommitOnAim({ pending, flurry: null, aim }))
      .toEqual({ clearAim: true, applyAbortPenalty: true });
  });

  it("flurry (with no pending action) breaks aim with penalty", () => {
    const aim    = { targetActorId: "T" };
    const flurry = { actions: [] };
    expect(planCommitOnAim({ pending: null, flurry, aim }))
      .toEqual({ clearAim: true, applyAbortPenalty: true });
  });
});
