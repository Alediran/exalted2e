import { describe, it, expect, vi } from "vitest";
import { parseCostFormula } from "../../module/rolls/activation-ledger.mjs";

// Helper: zero-cost result shape
const ZERO = {
  motes: 0, committed: false, moteVar: null,
  willpower: 0, lethalHealth: 0, bashingHealth: 0, aggravatedHealth: 0,
  xp: 0, permanentEssence: 0, permanentWillpower: 0, promise: 0, surcharge: null
};

describe("parseCostFormula — empty / no-cost", () => {
  it("returns all-zero for empty string", () => {
    expect(parseCostFormula("")).toMatchObject(ZERO);
  });
  it("returns all-zero for em-dash", () => {
    expect(parseCostFormula("—")).toMatchObject(ZERO);
  });
  it("returns all-zero for null / undefined", () => {
    expect(parseCostFormula(null)).toMatchObject(ZERO);
    expect(parseCostFormula(undefined)).toMatchObject(ZERO);
  });
});

describe("parseCostFormula — fixed motes", () => {
  it("parses '3m'", () => {
    const r = parseCostFormula("3m");
    expect(r.motes).toBe(3);
    expect(r.committed).toBe(false);
    expect(r.moteVar).toBeNull();
  });
  it("parses '1m [committed]'", () => {
    const r = parseCostFormula("1m [committed]");
    expect(r.motes).toBe(1);
    expect(r.committed).toBe(true);
    expect(r.moteVar).toBeNull();
  });
});

describe("parseCostFormula — compound", () => {
  it("parses '4m, 1wp'", () => {
    const r = parseCostFormula("4m, 1wp");
    expect(r.motes).toBe(4);
    expect(r.willpower).toBe(1);
  });
  it("parses '3m, 1lhl'", () => {
    const r = parseCostFormula("3m, 1lhl");
    expect(r.motes).toBe(3);
    expect(r.lethalHealth).toBe(1);
  });
  it("parses '1bhl'", () => {
    expect(parseCostFormula("1bhl").bashingHealth).toBe(1);
  });
  it("parses '1ahl'", () => {
    expect(parseCostFormula("1ahl").aggravatedHealth).toBe(1);
  });
  it("parses '2xp'", () => {
    expect(parseCostFormula("2xp").xp).toBe(2);
  });
  it("parses 'perm ess'", () => {
    expect(parseCostFormula("perm ess").permanentEssence).toBe(1);
  });
  it("parses 'perm wp'", () => {
    expect(parseCostFormula("perm wp").permanentWillpower).toBe(1);
  });
});

describe("parseCostFormula — per-unit motes", () => {
  it("parses '1m/die'", () => {
    const r = parseCostFormula("1m/die");
    expect(r.motes).toBe(0);
    expect(r.moteVar).toMatchObject({ type: "perUnit", rate: 1, rateN: 1, unit: "die", min: 0, maxResolved: null, committed: false });
  });
  it("parses '1m/die (@str)' without rollData → maxResolved null", () => {
    const r = parseCostFormula("1m/die (@str)");
    expect(r.moteVar.maxResolved).toBeNull();
  });
  it("parses '1m/die (@str)' with rollData → maxResolved = str value", () => {
    const r = parseCostFormula("1m/die (@str)", { str: 4 });
    expect(r.moteVar.maxResolved).toBe(4);
  });
  it("parses '1m/2 dice' — rateN=2", () => {
    const r = parseCostFormula("1m/2 dice");
    expect(r.moteVar).toMatchObject({ type: "perUnit", rate: 1, rateN: 2, unit: "dice" });
  });
  it("parses '2m + 1m/die (@wit)' — base 2 + per-unit", () => {
    const r = parseCostFormula("2m + 1m/die (@wit)", { wit: 3 });
    expect(r.motes).toBe(2);
    expect(r.moteVar.type).toBe("perUnit");
    expect(r.moteVar.maxResolved).toBe(3);
  });
  it("parses '1m/die [committed]'", () => {
    const r = parseCostFormula("1m/die [committed]");
    expect(r.moteVar.committed).toBe(true);
  });
});

describe("parseCostFormula — open-ended motes", () => {
  it("parses '2m+'", () => {
    const r = parseCostFormula("2m+");
    expect(r.motes).toBe(2);
    expect(r.moteVar).toMatchObject({ type: "openEnded", committed: false });
  });
  it("parses '2m+, 1wp'", () => {
    const r = parseCostFormula("2m+, 1wp");
    expect(r.motes).toBe(2);
    expect(r.moteVar.type).toBe("openEnded");
    expect(r.willpower).toBe(1);
  });
});

describe("parseCostFormula — tiered motes", () => {
  it("parses '3m or 5m'", () => {
    const r = parseCostFormula("3m or 5m");
    expect(r.moteVar).toMatchObject({
      type: "tiered",
      tiers: [{ moteCost: 3, label: "" }, { moteCost: 5, label: "" }]
    });
  });
  it("parses '3m (Standard) or 5m (Boosted)'", () => {
    const r = parseCostFormula("3m (Standard) or 5m (Boosted)");
    expect(r.moteVar.tiers).toEqual([
      { moteCost: 3, label: "Standard" },
      { moteCost: 5, label: "Boosted" }
    ]);
  });
});

describe("parseCostFormula — formula-scaled base", () => {
  it("parses '@ess m' with rollData → motes = ess value", () => {
    const r = parseCostFormula("@ess m", { ess: 3 });
    expect(r.motes).toBe(3);
    expect(r.moteVar).toBeNull();
  });
});

describe("parseCostFormula — surcharge", () => {
  it("parses '—(5m, 1wp)' — single option, no condition", () => {
    const r = parseCostFormula("—(5m, 1wp)");
    expect(r.motes).toBe(0);
    expect(r.moteVar).toBeNull();
    expect(r.surcharge).toHaveLength(1);
    expect(r.surcharge[0].cost.motes).toBe(5);
    expect(r.surcharge[0].cost.willpower).toBe(1);
    expect(r.surcharge[0].condition).toBeNull();
    expect(r.surcharge[0].relative).toBe(false);
    expect(r.surcharge[0].conditionMet).toBe(false);
  });
  it("parses '—(1m [committed])'", () => {
    const r = parseCostFormula("—(1m [committed])");
    expect(r.surcharge[0].cost.motes).toBe(1);
    expect(r.surcharge[0].cost.committed).toBe(true);
  });
  it("parses '—(+3m or +3m, 1wp [@ess >= 5])' with ess=3 → second conditionMet false", () => {
    const r = parseCostFormula("—(+3m or +3m, 1wp [@ess >= 5])", { ess: 3 });
    expect(r.surcharge).toHaveLength(2);
    expect(r.surcharge[0].relative).toBe(true);
    expect(r.surcharge[0].cost.motes).toBe(3);
    expect(r.surcharge[1].condition).toBe("@ess >= 5");
    expect(r.surcharge[1].conditionMet).toBe(false);
  });
  it("parses '—(+3m or +3m, 1wp [@ess >= 5])' with ess=5 → second conditionMet true", () => {
    const r = parseCostFormula("—(+3m or +3m, 1wp [@ess >= 5])", { ess: 5 });
    expect(r.surcharge[1].conditionMet).toBe(true);
  });
});

describe("parseCostFormula — generic hl alias", () => {
  it("parses '1hl' as lethal health", () => {
    const r = parseCostFormula("1hl");
    expect(r.lethalHealth).toBe(1);
    expect(r.motes).toBe(0);
  });
  it("parses '2hl' in a compound", () => {
    const r = parseCostFormula("3m, 2hl");
    expect(r.motes).toBe(3);
    expect(r.lethalHealth).toBe(2);
  });
});

describe("parseCostFormula — Alchemical promise cost", () => {
  it("parses '5m, 1p'", () => {
    const r = parseCostFormula("5m, 1p");
    expect(r.motes).toBe(5);
    expect(r.promise).toBe(1);
  });
  it("parses '2m, 1wp, 3p'", () => {
    const r = parseCostFormula("2m, 1wp, 3p");
    expect(r.motes).toBe(2);
    expect(r.willpower).toBe(1);
    expect(r.promise).toBe(3);
  });
  it("parses '—' with promise=0 (no cost)", () => {
    const r = parseCostFormula("—");
    expect(r.promise).toBe(0);
  });
});

describe("parseCostFormula — multi-word unit names", () => {
  it("parses '1m/cubic foot'", () => {
    const r = parseCostFormula("1m/cubic foot");
    expect(r.moteVar?.type).toBe("perUnit");
    expect(r.moteVar?.unit).toBe("cubic foot");
    expect(r.moteVar?.rate).toBe(1);
  });
  it("parses '1m/penalty cancelled'", () => {
    const r = parseCostFormula("1m/penalty cancelled");
    expect(r.moteVar?.type).toBe("perUnit");
    expect(r.moteVar?.unit).toBe("penalty cancelled");
  });
  it("parses '1m/pre-soak damage die'", () => {
    const r = parseCostFormula("1m/pre-soak damage die");
    expect(r.moteVar?.type).toBe("perUnit");
    expect(r.moteVar?.unit).toBe("pre-soak damage die");
  });
  it("parses '3m/point of Magnitude, 1wp'", () => {
    const r = parseCostFormula("3m/point of Magnitude, 1wp");
    expect(r.moteVar?.type).toBe("perUnit");
    expect(r.moteVar?.unit).toBe("point of Magnitude");
    expect(r.willpower).toBe(1);
  });
});

describe("parseCostFormula — error handling", () => {
  it("returns null for unrecognized token", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(parseCostFormula("??weird??")).toBeNull();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
