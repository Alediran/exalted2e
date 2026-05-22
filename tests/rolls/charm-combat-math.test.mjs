import { describe, it, expect } from "vitest";
import {
  computeAttackCharmBonus,
  computeSocialCharmBonus,
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
      ignoreRangeBand: false,
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

  it("sets ignoreRangeBand when any enabled charm has ignoreRangeBand", () => {
    const charms = [{ system: { attackBonus: {
      enabled: true, accuracyDice: "", accuracySuccesses: "", damageDice: "",
      ignoreAccuracyPenalties: false, ignoreRangeBand: true
    }}}];
    expect(computeAttackCharmBonus(charms, {}).ignoreRangeBand).toBe(true);
  });

  it("ignoreRangeBand stays false when disabled charm has it", () => {
    const charms = [{ system: { attackBonus: {
      enabled: false, accuracyDice: "", accuracySuccesses: "", damageDice: "",
      ignoreAccuracyPenalties: false, ignoreRangeBand: true
    }}}];
    expect(computeAttackCharmBonus(charms, {}).ignoreRangeBand).toBe(false);
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

// ── computeSocialCharmBonus ──────────────────────────────────────────
describe("computeSocialCharmBonus", () => {
  it("returns zeros when no charms given", () => {
    expect(computeSocialCharmBonus([], {})).toEqual({
      poolDice: 0, poolSuccesses: 0, ignorePenalties: false
    });
  });

  it("returns zeros when no charm has socialBonus.enabled", () => {
    const charms = [{ system: { socialBonus: {
      enabled: false, poolDice: "5", poolSuccesses: "3",
      poolDicePerMote: false, ignorePenalties: true
    }}}];
    expect(computeSocialCharmBonus(charms, {})).toEqual({
      poolDice: 0, poolSuccesses: 0, ignorePenalties: false
    });
  });

  it("sums poolDice and poolSuccesses from enabled charms", () => {
    const charms = [
      { system: { socialBonus: { enabled: true, poolDice: "2", poolSuccesses: "1", poolDicePerMote: false, ignorePenalties: false }, resolvedUnits: 1 }},
      { system: { socialBonus: { enabled: true, poolDice: "1", poolSuccesses: "0", poolDicePerMote: false, ignorePenalties: false }, resolvedUnits: 1 }}
    ];
    const r = computeSocialCharmBonus(charms, {});
    expect(r.poolDice).toBe(3);
    expect(r.poolSuccesses).toBe(1);
  });

  it("scales poolDice by resolvedUnits when poolDicePerMote is true", () => {
    const charms = [
      { system: { socialBonus: { enabled: true, poolDice: "@cha", poolSuccesses: "1", poolDicePerMote: true, ignorePenalties: false }, resolvedUnits: 2 }}
    ];
    // cha = 3 → 3 * 2 = 6 dice
    const r = computeSocialCharmBonus(charms, { cha: 3 });
    expect(r.poolDice).toBe(6);
    expect(r.poolSuccesses).toBe(1);
  });

  it("does NOT scale poolDice by resolvedUnits when poolDicePerMote is false", () => {
    const charms = [
      { system: { socialBonus: { enabled: true, poolDice: "3", poolSuccesses: "", poolDicePerMote: false, ignorePenalties: false }, resolvedUnits: 5 }}
    ];
    expect(computeSocialCharmBonus(charms, {}).poolDice).toBe(3);
  });

  it("sets ignorePenalties when any enabled charm has it", () => {
    const charms = [
      { system: { socialBonus: { enabled: true, poolDice: "", poolSuccesses: "", poolDicePerMote: false, ignorePenalties: false }, resolvedUnits: 1 }},
      { system: { socialBonus: { enabled: true, poolDice: "", poolSuccesses: "", poolDicePerMote: false, ignorePenalties: true  }, resolvedUnits: 1 }}
    ];
    expect(computeSocialCharmBonus(charms, {}).ignorePenalties).toBe(true);
  });

  it("resolves formula tokens from rollData", () => {
    const charms = [
      { system: { socialBonus: { enabled: true, poolDice: "@ess", poolSuccesses: "@wp", poolDicePerMote: false, ignorePenalties: false }, resolvedUnits: 1 }}
    ];
    const r = computeSocialCharmBonus(charms, { ess: 4, wp: 2 });
    expect(r.poolDice).toBe(4);
    expect(r.poolSuccesses).toBe(2);
  });

  it("uses resolvedUnits = 1 as fallback when field is absent", () => {
    const charms = [
      { system: { socialBonus: { enabled: true, poolDice: "2", poolSuccesses: "", poolDicePerMote: true, ignorePenalties: false } } }
      // no resolvedUnits field → fallback 1 → 2 * 1 = 2
    ];
    expect(computeSocialCharmBonus(charms, {}).poolDice).toBe(2);
  });
});

