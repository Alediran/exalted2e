import { describe, it, expect } from "vitest";
import {
  computeAttackCharmBonus,
  computeSpeedModifier,
  computeExtraActionsMax,
} from "../../module/rolls/charm-combat-math.mjs";

// ── computeAttackCharmBonus ──────────────────────────────────────────
describe("computeAttackCharmBonus", () => {
  it("returns zeros when no charms", () => {
    expect(computeAttackCharmBonus([], {})).toEqual({
      extraAccuracyDice: 0,
      extraAccuracySuccesses: 0,
      extraDamageDice: 0,
      ignorePenalties: false,
    });
  });

  it("adds integer accuracy dice", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "1", accuracySuccesses: "", damageDice: "", ignoreAccuracyPenalties: false
    }}}];
    expect(computeAttackCharmBonus(charms, {}).extraAccuracyDice).toBe(1);
  });

  it("adds integer accuracy successes", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "3", damageDice: "", ignoreAccuracyPenalties: false
    }}}];
    expect(computeAttackCharmBonus(charms, {}).extraAccuracySuccesses).toBe(3);
  });

  it("adds integer damage dice", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "2", ignoreAccuracyPenalties: false
    }}}];
    expect(computeAttackCharmBonus(charms, {}).extraDamageDice).toBe(2);
  });

  it("sets ignorePenalties when any charm sets ignoreAccuracyPenalties", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "", ignoreAccuracyPenalties: true
    }}}];
    expect(computeAttackCharmBonus(charms, {}).ignorePenalties).toBe(true);
  });

  it("stacks bonuses across multiple charms", () => {
    const charms = [
      { system: { attackBonus: { enabled: true, accuracyDice: "1", accuracySuccesses: "", damageDice: "2", ignoreAccuracyPenalties: false }}},
      { system: { attackBonus: { enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "2", ignoreAccuracyPenalties: false }}}
    ];
    const r = computeAttackCharmBonus(charms, {});
    expect(r.extraAccuracyDice).toBe(1);
    expect(r.extraDamageDice).toBe(4);
  });

  it("non-integer formula token yields 0 (safe, no Foundry needed)", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "@ess",
      ignoreAccuracyPenalties: false
    }}}];
    expect(computeAttackCharmBonus(charms, { ess: 3 }).extraDamageDice).toBe(0);
  });

  it("skips disabled charms", () => {
    const charms = [{ system: { attackBonus: { enabled: false, accuracyDice: "5", accuracySuccesses: "5", damageDice: "5", ignoreAccuracyPenalties: true }}}];
    const r = computeAttackCharmBonus(charms, {});
    expect(r.extraAccuracyDice).toBe(0);
    expect(r.ignorePenalties).toBe(false);
  });
});

// ── computeSpeedModifier ─────────────────────────────────────────────
describe("computeSpeedModifier", () => {
  it("returns baseSpeed unchanged when no charms", () => {
    expect(computeSpeedModifier([], 5)).toBe(5);
  });

  it("applies negative delta", () => {
    const charms = [{ system: { speedModifier: { enabled: true, delta: -1, minimum: 3, perMotes: 0 }}}];
    expect(computeSpeedModifier(charms, 5)).toBe(4);
  });

  it("clamps to minimum", () => {
    const charms = [{ system: { speedModifier: { enabled: true, delta: -5, minimum: 3, perMotes: 0 }}}];
    expect(computeSpeedModifier(charms, 5)).toBe(3);
  });

  it("stacks multiple deltas and takes global minimum", () => {
    const charms = [
      { system: { speedModifier: { enabled: true, delta: -1, minimum: 3, perMotes: 0 }}},
      { system: { speedModifier: { enabled: true, delta: -1, minimum: 4, perMotes: 0 }}}
    ];
    expect(computeSpeedModifier(charms, 5)).toBe(4);
  });

  it("skips disabled charms", () => {
    const charms = [{ system: { speedModifier: { enabled: false, delta: -3, minimum: 3, perMotes: 0 }}}];
    expect(computeSpeedModifier(charms, 5)).toBe(5);
  });

  it("no minimum field on charm — floors at 3 (fastest legal speed in 2e)", () => {
    const charms = [{ system: { speedModifier: { enabled: true, delta: -10, perMotes: 0 }}}];
    expect(computeSpeedModifier(charms, 5)).toBe(3);
  });
});

// ── computeExtraActionsMax ───────────────────────────────────────────
describe("computeExtraActionsMax", () => {
  it("returns 0 when no charms", () => {
    expect(computeExtraActionsMax([], {})).toBe(0);
  });

  it("integer maxFormula resolves directly", () => {
    const charms = [{ system: { extraActions: { enabled: true, maxFormula: "2", costPerAction: 0 }}}];
    expect(computeExtraActionsMax(charms, {})).toBe(2);
  });

  it("uses the highest max from all active charms", () => {
    const charms = [
      { system: { extraActions: { enabled: true, maxFormula: "3", costPerAction: 0 }}},
      { system: { extraActions: { enabled: true, maxFormula: "5", costPerAction: 0 }}}
    ];
    expect(computeExtraActionsMax(charms, {})).toBe(5);
  });

  it("skips disabled charms", () => {
    const charms = [{ system: { extraActions: { enabled: false, maxFormula: "10", costPerAction: 0 }}}];
    expect(computeExtraActionsMax(charms, {})).toBe(0);
  });

  it("empty maxFormula yields 0", () => {
    const charms = [{ system: { extraActions: { enabled: true, maxFormula: "", costPerAction: 0 }}}];
    expect(computeExtraActionsMax(charms, {})).toBe(0);
  });
});

describe("computeAttackCharmBonus — formula safety", () => {
  it("formula token with rollData context yields 0 without Foundry (no crash)", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "@wp",
      ignoreAccuracyPenalties: false
    }}}];
    expect(() => computeAttackCharmBonus(charms, { wp: 5 })).not.toThrow();
    expect(computeAttackCharmBonus(charms, { wp: 5 }).extraDamageDice).toBe(0);
  });
});
