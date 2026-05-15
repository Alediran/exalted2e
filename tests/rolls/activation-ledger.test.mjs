import { describe, it, expect } from "vitest";
import { normalizeCost, planLedgerRefund } from "../../module/rolls/activation-ledger.mjs";

// ── normalizeCost ────────────────────────────────────────────────────
describe("normalizeCost", () => {
  it("returns all six fields with zero defaults for an empty cost", () => {
    expect(normalizeCost({})).toEqual({
      moteCost: 0, willpowerCost: 0, bashingCost: 0,
      lethalCost: 0, aggravatedCost: 0, xpCost: 0
    });
  });

  it("handles undefined cost argument gracefully", () => {
    expect(normalizeCost(undefined)).toEqual({
      moteCost: 0, willpowerCost: 0, bashingCost: 0,
      lethalCost: 0, aggravatedCost: 0, xpCost: 0
    });
  });

  it("parses a mote-only formula", () => {
    expect(normalizeCost({ formula: "5m" })).toMatchObject({ moteCost: 5 });
  });

  it("treats the dash formula as zero cost", () => {
    expect(normalizeCost({ formula: "—" })).toMatchObject({ moteCost: 0 });
  });

  it("parses a willpower-only formula", () => {
    expect(normalizeCost({ formula: "2wp" })).toMatchObject({ willpowerCost: 2 });
  });

  it("parses a combined motes + willpower formula", () => {
    expect(normalizeCost({ formula: "5m, 1wp" })).toMatchObject({ moteCost: 5, willpowerCost: 1 });
  });

  it("parses a bashing health formula", () => {
    expect(normalizeCost({ formula: "1bhl" })).toMatchObject({ bashingCost: 1 });
  });

  it("parses a lethal health formula", () => {
    expect(normalizeCost({ formula: "2lhl" })).toMatchObject({ lethalCost: 2 });
  });

  it("parses an aggravated health formula", () => {
    expect(normalizeCost({ formula: "1ahl" })).toMatchObject({ aggravatedCost: 1 });
  });

  it("parses an xp formula", () => {
    expect(normalizeCost({ formula: "3xp" })).toMatchObject({ xpCost: 3 });
  });

  it("uses motesOverride instead of formula motes when provided", () => {
    expect(normalizeCost({ formula: "5m" }, { motesOverride: 10 })).toMatchObject({ moteCost: 10 });
  });

  it("does not use motesOverride when it is undefined (no second arg)", () => {
    expect(normalizeCost({ formula: "5m" })).toMatchObject({ moteCost: 5 });
  });

  it("applies the same floor-and-clamp to motesOverride as to motes", () => {
    expect(normalizeCost({ formula: "5m" }, { motesOverride: 7.9 })).toMatchObject({ moteCost: 7 });
    expect(normalizeCost({ formula: "5m" }, { motesOverride: -3 })).toMatchObject({ moteCost: 0 });
  });

  it("treats motesOverride of 0 as an explicit override (not undefined fallback)", () => {
    expect(normalizeCost({ formula: "5m" }, { motesOverride: 0 })).toMatchObject({ moteCost: 0 });
  });

  it("other cost fields are still read from formula when motesOverride is set", () => {
    expect(
      normalizeCost({ formula: "5m, 2wp, 1xp" }, { motesOverride: 8 })
    ).toEqual({ moteCost: 8, willpowerCost: 2, bashingCost: 0, lethalCost: 0, aggravatedCost: 0, xpCost: 1 });
  });

  it("legacy field-based cost (no formula key) still works", () => {
    expect(normalizeCost({ motes: 7, willpower: 2 })).toMatchObject({ moteCost: 7, willpowerCost: 2 });
  });

  it("legacy field-based path floors fractions and clamps negatives to zero", () => {
    expect(normalizeCost({
      motes: 3.7, willpower: -2, bashingHealth: "bad", lethalHealth: 2.2,
      aggravatedHealth: null, xp: -5
    })).toEqual({
      moteCost: 3, willpowerCost: 0, bashingCost: 0,
      lethalCost: 2, aggravatedCost: 0, xpCost: 0
    });
  });
});

// ── planLedgerRefund ─────────────────────────────────────────────────
describe("planLedgerRefund", () => {
  it("returns empty updates for an empty ledger", () => {
    expect(planLedgerRefund({}, { motes: {}, willpower: {}, experience: {}, health: {} }))
      .toEqual({ updates: {} });
  });

  it("refunds motes to the recorded pools, capped at each pool max", () => {
    const ledger = {
      moteBreakdown: { primaryPool: "personal", secondaryPool: "peripheral", fromPrimary: 5, fromSecondary: 3 }
    };
    const sys = {
      motes: {
        personal:   { value: 10, max: 13 },
        peripheral: { value: 32, max: 33 }
      }
    };
    const { updates } = planLedgerRefund(ledger, sys);
    expect(updates["system.motes.personal.value"]).toBe(13);       // 10 + 5 = 15, capped at 13
    expect(updates["system.motes.peripheral.value"]).toBe(33);     // 32 + 3 = 35, capped at 33
  });

  it("refunds willpower capped at max", () => {
    const ledger = { willpower: 5 };
    const sys = { willpower: { value: 7, max: 10 } };
    const { updates } = planLedgerRefund(ledger, sys);
    expect(updates["system.willpower.value"]).toBe(10);            // 7 + 5 = 12, capped at 10
  });

  it("refunds XP capped at experience.total", () => {
    const ledger = { xp: 5 };
    const sys = { experience: { value: 10, total: 12 } };
    const { updates } = planLedgerRefund(ledger, sys);
    expect(updates["system.experience.value"]).toBe(12);           // 10 + 5 = 15, capped at 12
  });

  it("refunds each health column and does not mutate the source health object", () => {
    const ledger = { bashing: 2, lethal: 1, aggravated: 1 };
    const sourceHealth = { bashing: 3, lethal: 2, aggravated: 1, bonus: { zero: 0, one: 0, two: 0 } };
    const sys = { health: sourceHealth };
    const { updates } = planLedgerRefund(ledger, sys);
    const h = updates["system.health"];
    expect(h).toEqual({ bashing: 1, lethal: 1, aggravated: 0, bonus: { zero: 0, one: 0, two: 0 } });
    // Non-mutation: the original health object is still at its pre-refund values.
    expect(sourceHealth.bashing).toBe(3);
    expect(h).not.toBe(sourceHealth);                              // fresh reference
  });

  it("floors health at zero on over-refund", () => {
    const ledger = { bashing: 10 };                                // claims 10 bashing refunded
    const sys = { health: { bashing: 3, lethal: 0, aggravated: 0 } };
    const { updates } = planLedgerRefund(ledger, sys);
    expect(updates["system.health"].bashing).toBe(0);              // floored, not -7
  });
});
