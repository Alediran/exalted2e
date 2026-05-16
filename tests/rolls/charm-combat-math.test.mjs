import { describe, it, expect } from "vitest";
import {
  computeAttackCharmBonus,
} from "../../module/rolls/charm-combat-math.mjs";

// ── computeAttackCharmBonus ──────────────────────────────────────────
describe("computeAttackCharmBonus", () => {
  it("returns zeros when no charms", () => {
    expect(computeAttackCharmBonus([], {})).toEqual({
      extraAccuracyDice: 0,
      extraAccuracySuccesses: 0,
      extraDamageDice: 0,
      extraPostSoakDamageDice: 0,
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

  it("formula token with rollData resolves correctly (e.g. @ess with ess:3 → 3)", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "@ess",
      ignoreAccuracyPenalties: false
    }}}];
    expect(computeAttackCharmBonus(charms, { ess: 3 }).extraDamageDice).toBe(3);
  });

  it("skips disabled charms", () => {
    const charms = [{ system: { attackBonus: { enabled: false, accuracyDice: "5", accuracySuccesses: "5", damageDice: "5", ignoreAccuracyPenalties: true }}}];
    const r = computeAttackCharmBonus(charms, {});
    expect(r.extraAccuracyDice).toBe(0);
    expect(r.ignorePenalties).toBe(false);
  });
});

describe("computeAttackCharmBonus — post-soak damage dice", () => {
  it("sums postSoakDamageDice from enabled charms", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "",
      postSoakDamageDice: "3", ignoreAccuracyPenalties: false
    }}}];
    expect(computeAttackCharmBonus(charms, {}).extraPostSoakDamageDice).toBe(3);
  });

  it("stacks post-soak across multiple charms", () => {
    const charms = [
      { system: { attackBonus: { enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "", postSoakDamageDice: "2", ignoreAccuracyPenalties: false }}},
      { system: { attackBonus: { enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "", postSoakDamageDice: "1", ignoreAccuracyPenalties: false }}}
    ];
    expect(computeAttackCharmBonus(charms, {}).extraPostSoakDamageDice).toBe(3);
  });

  it("pre-scaled per-mote value is used as-is (scaling done by caller)", () => {
    // The caller (rollAttack) multiplies by resolvedUnits before passing in.
    // computeAttackCharmBonus sees already-scaled integers.
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "",
      postSoakDamageDice: "4", ignoreAccuracyPenalties: false
    }}}];
    expect(computeAttackCharmBonus(charms, {}).extraPostSoakDamageDice).toBe(4);
  });

  it("resolves formula token in postSoakDamageDice", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "",
      postSoakDamageDice: "@ess", ignoreAccuracyPenalties: false
    }}}];
    expect(computeAttackCharmBonus(charms, { ess: 3 }).extraPostSoakDamageDice).toBe(3);
  });
});

describe("computeAttackCharmBonus — formula evaluation", () => {
  it("@wp token resolves from rollData", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "@wp",
      ignoreAccuracyPenalties: false
    }}}];
    expect(() => computeAttackCharmBonus(charms, { wp: 5 })).not.toThrow();
    expect(computeAttackCharmBonus(charms, { wp: 5 }).extraDamageDice).toBe(5);
  });

  it("accuracy fields also resolve formulas", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "@ess", accuracySuccesses: "@ess", damageDice: "",
      ignoreAccuracyPenalties: false
    }}}];
    const r = computeAttackCharmBonus(charms, { ess: 4 });
    expect(r.extraAccuracyDice).toBe(4);
    expect(r.extraAccuracySuccesses).toBe(4);
  });

  it("missing rollData token falls back to 0", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "@ess",
      ignoreAccuracyPenalties: false
    }}}];
    // ess not present in rollData — replaceFormulaData substitutes "0"
    expect(computeAttackCharmBonus(charms, {}).extraDamageDice).toBe(0);
  });
});

