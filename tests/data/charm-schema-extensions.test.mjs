// tests/data/charm-schema-extensions.test.mjs
import { describe, it, expect } from "vitest";
import { CharmData } from "../../module/data/item/charm-data.mjs";

describe("soakBonus — formula StringFields", () => {
  it("soakBonus has bashingFormula StringField", () => {
    const schema = CharmData.defineSchema();
    const f = schema.soakBonus.fields?.bashingFormula ?? schema.soakBonus.schema?.fields?.bashingFormula;
    expect(f).toBeDefined();
  });
  it("soakBonus.bashingFormula defaults to empty string", () => {
    const schema = CharmData.defineSchema();
    const f = schema.soakBonus.fields?.bashingFormula ?? schema.soakBonus.schema?.fields?.bashingFormula;
    const initial = f?.getInitialValue?.() ?? f?.options?.initial;
    expect(initial).toBe("");
  });
  it("soakBonus has lethalFormula StringField", () => {
    const schema = CharmData.defineSchema();
    const f = schema.soakBonus.fields?.lethalFormula ?? schema.soakBonus.schema?.fields?.lethalFormula;
    expect(f).toBeDefined();
  });
  it("soakBonus has aggravatedFormula StringField", () => {
    const schema = CharmData.defineSchema();
    const f = schema.soakBonus.fields?.aggravatedFormula ?? schema.soakBonus.schema?.fields?.aggravatedFormula;
    expect(f).toBeDefined();
  });
});

describe("dvBonus — formula StringFields", () => {
  it("dvBonus has dodgeBonusFormula StringField", () => {
    const schema = CharmData.defineSchema();
    const f = schema.dvBonus.fields?.dodgeBonusFormula ?? schema.dvBonus.schema?.fields?.dodgeBonusFormula;
    expect(f).toBeDefined();
  });
  it("dvBonus has parryBonusFormula StringField", () => {
    const schema = CharmData.defineSchema();
    const f = schema.dvBonus.fields?.parryBonusFormula ?? schema.dvBonus.schema?.fields?.parryBonusFormula;
    expect(f).toBeDefined();
  });
});

describe("rateBonus schema", () => {
  it("has rateBonus.enabled BooleanField defaulting false", () => {
    const schema = CharmData.defineSchema();
    const f = schema.rateBonus?.fields?.enabled ?? schema.rateBonus?.schema?.fields?.enabled;
    expect(f).toBeDefined();
    const initial = f?.getInitialValue?.() ?? f?.options?.initial;
    expect(initial).toBe(false);
  });
  it("has rateBonus.formula StringField", () => {
    const schema = CharmData.defineSchema();
    const f = schema.rateBonus?.fields?.formula ?? schema.rateBonus?.schema?.fields?.formula;
    expect(f).toBeDefined();
  });
});

describe("rateBonus schema presence", () => {
  it("rateBonus.formula defaults to '1'", () => {
    const schema = CharmData.defineSchema();
    const f = schema.rateBonus.fields?.formula ?? schema.rateBonus.schema?.fields?.formula;
    const initial = f?.getInitialValue?.() ?? f?.options?.initial;
    expect(initial).toBe("1");
  });
});

describe("willpowerRecovery schema", () => {
  it("has willpowerRecovery.enabled BooleanField defaulting false", () => {
    const schema = CharmData.defineSchema();
    const f = schema.willpowerRecovery?.fields?.enabled ?? schema.willpowerRecovery?.schema?.fields?.enabled;
    expect(f).toBeDefined();
    const initial = f?.getInitialValue?.() ?? f?.options?.initial;
    expect(initial).toBe(false);
  });
  it("has willpowerRecovery.event StringField", () => {
    const schema = CharmData.defineSchema();
    const f = schema.willpowerRecovery?.fields?.event ?? schema.willpowerRecovery?.schema?.fields?.event;
    expect(f).toBeDefined();
  });
  it("has willpowerRecovery.formula StringField", () => {
    const schema = CharmData.defineSchema();
    const f = schema.willpowerRecovery?.fields?.formula ?? schema.willpowerRecovery?.schema?.fields?.formula;
    expect(f).toBeDefined();
  });
});

import { computeSoakBonus } from "../../module/rolls/charm-passive-math.mjs";

describe("soakBonus formula field resolution (pre-evaluated by caller)", () => {
  it("formula value replaces integer when provided (as pre-evaluated entry)", () => {
    // Caller evaluates bashingFormula="@sta" → 3, passes entry with bashing=3
    const entries = [{ bashing: 3, lethal: 0, aggravated: 0, hardnessAdd: 0, hardnessSetTo: 0 }];
    expect(computeSoakBonus(entries).bashing).toBe(3);
  });
});

describe("dvPenalty schema field", () => {
  it("dvPenalty defaults to -1", () => {
    const schema = CharmData.defineSchema();
    const f = schema.dvPenalty;
    expect(f).toBeDefined();
    const initial = f?.getInitialValue?.() ?? f?.options?.initial;
    expect(initial).toBe(-1);
  });
  it("dvPenalty has min -3 and max 0", () => {
    const schema = CharmData.defineSchema();
    const f = schema.dvPenalty;
    expect(f.options?.min ?? f.min).toBe(-3);
    expect(f.options?.max ?? f.max).toBe(0);
  });
});
