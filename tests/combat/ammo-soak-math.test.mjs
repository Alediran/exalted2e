import { describe, it, expect } from "vitest";
import { computeAttackOutcome } from "../../module/rolls/attack-math.mjs";

// Build a minimal attack snapshot focused on soak fields.
// defense: null causes computeAttackOutcome to return after setting effectiveTargetSoak.
function base(overrides = {}) {
  return {
    targetSoak:      10,
    targetArmorSoak: 4,
    soakPiercing:    0,
    ignoresArmor:    false,
    ammoSoakMod:     "normal",
    defense:         null,
    ...overrides,
  };
}

// ── ammoSoakMod: "normal" (default) ──────────────────────────────────────────

describe("computeAttackOutcome — ammoSoakMod: normal", () => {
  it("effectiveTargetSoak equals totalSoak with no modifiers", () => {
    expect(computeAttackOutcome(base()).effectiveTargetSoak).toBe(10);
  });

  it("soakPiercing reduces effectiveTargetSoak", () => {
    expect(computeAttackOutcome(base({ soakPiercing: 3 })).effectiveTargetSoak).toBe(7);
  });

  it("ignoresArmor removes armorSoak component", () => {
    // naturalSoak = 10 - 4 = 6
    expect(computeAttackOutcome(base({ ignoresArmor: true })).effectiveTargetSoak).toBe(6);
  });

  it("undefined ammoSoakMod behaves identically to 'normal'", () => {
    const without = base({ ammoSoakMod: undefined });
    expect(computeAttackOutcome(without).effectiveTargetSoak).toBe(10);
  });

  it("effectiveTargetSoak is floored at 0", () => {
    expect(computeAttackOutcome(base({ soakPiercing: 20 })).effectiveTargetSoak).toBe(0);
  });
});

// ── ammoSoakMod: "doubled" (Frog Crotch arrows) ──────────────────────────────

describe("computeAttackOutcome — ammoSoakMod: doubled", () => {
  it("armorSoak counts twice: effectiveTargetSoak = totalSoak + armorSoak", () => {
    // 10 + 4 = 14
    expect(computeAttackOutcome(base({ ammoSoakMod: "doubled" })).effectiveTargetSoak).toBe(14);
  });

  it("doubled + soakPiercing: piercing reduces total then armor is doubled", () => {
    // effectiveSoak = 10 - 0(armorComponent) - 2(piercing) = 8, then + 4 = 12
    expect(computeAttackOutcome(base({ soakPiercing: 2, ammoSoakMod: "doubled" })).effectiveTargetSoak).toBe(12);
  });

  it("doubled has no extra effect when ignoresArmor is also true", () => {
    // ignoresArmor removes armor (10 - 4 = 6); doubled branch skipped
    expect(computeAttackOutcome(base({ ignoresArmor: true, ammoSoakMod: "doubled" })).effectiveTargetSoak).toBe(6);
  });

  it("doubled result is floored at 0", () => {
    // targetSoak 1, armorSoak 1, soakPiercing 10 → (1 - 10) + 1 = -8 → 0
    const attack = base({ targetSoak: 1, targetArmorSoak: 1, soakPiercing: 10, ammoSoakMod: "doubled" });
    expect(computeAttackOutcome(attack).effectiveTargetSoak).toBe(0);
  });
});

// ── ammoSoakMod: "halved" (Target arrows — piercing) ─────────────────────────

describe("computeAttackOutcome — ammoSoakMod: halved", () => {
  it("even armorSoak halved exactly: naturalSoak + floor(armorSoak / 2)", () => {
    // naturalSoak = 10 - 4 = 6; halved armor = 2; result = 8
    // Implementation: effectiveSoak = 10 - ceil(4/2) = 10 - 2 = 8
    expect(computeAttackOutcome(base({ ammoSoakMod: "halved" })).effectiveTargetSoak).toBe(8);
  });

  it("odd armorSoak rounds down (core says 'rounded down')", () => {
    // naturalSoak = 11 - 5 = 6; halved armor = floor(5/2) = 2; result = 8
    // Implementation: effectiveSoak = 11 - ceil(5/2) = 11 - 3 = 8
    const attack = base({ targetSoak: 11, targetArmorSoak: 5, ammoSoakMod: "halved" });
    expect(computeAttackOutcome(attack).effectiveTargetSoak).toBe(8);
  });

  it("halved + soakPiercing: both reductions apply", () => {
    // effectiveSoak = 10 - 0 - 2(piercing) = 8, then - ceil(4/2) = 8 - 2 = 6
    expect(computeAttackOutcome(base({ soakPiercing: 2, ammoSoakMod: "halved" })).effectiveTargetSoak).toBe(6);
  });

  it("halved has no extra effect when ignoresArmor is true", () => {
    // ignoresArmor removes armor (10 - 4 = 6); halved branch skipped
    expect(computeAttackOutcome(base({ ignoresArmor: true, ammoSoakMod: "halved" })).effectiveTargetSoak).toBe(6);
  });

  it("halved with zero armorSoak makes no difference", () => {
    const attack = base({ targetArmorSoak: 0, ammoSoakMod: "halved" });
    expect(computeAttackOutcome(attack).effectiveTargetSoak).toBe(10);
  });

  it("halved result is floored at 0", () => {
    // targetSoak 3, armorSoak 2, soakPiercing 5 → (3 - 5) - 1 = -3 → 0
    const attack = base({ targetSoak: 3, targetArmorSoak: 2, soakPiercing: 5, ammoSoakMod: "halved" });
    expect(computeAttackOutcome(attack).effectiveTargetSoak).toBe(0);
  });
});
