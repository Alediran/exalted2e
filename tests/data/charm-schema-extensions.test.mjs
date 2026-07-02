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

describe("attack schema — area attack fields", () => {
  it("charm attack schema has areaAttack and area config defaults", () => {
    const schema = CharmData.defineSchema();
    const attackSchema = schema.attack;
    expect(attackSchema.fields.areaAttack).toBeDefined();
    expect(attackSchema.fields.areaShape).toBeDefined();
    expect(attackSchema.fields.areaSize).toBeDefined();
    expect(attackSchema.fields.areaResistPool).toBeDefined();
    expect(attackSchema.fields.areaResistDifficulty).toBeDefined();
    expect(attackSchema.fields.areaResistEffect).toBeDefined();

    const areaAttackInitial = attackSchema.fields.areaAttack?.getInitialValue?.() ?? attackSchema.fields.areaAttack?.options?.initial;
    expect(areaAttackInitial).toBe(false);

    const areaShapeInitial = attackSchema.fields.areaShape?.getInitialValue?.() ?? attackSchema.fields.areaShape?.options?.initial;
    expect(areaShapeInitial).toBe("circle");

    const areaSizeInitial = attackSchema.fields.areaSize?.getInitialValue?.() ?? attackSchema.fields.areaSize?.options?.initial;
    expect(areaSizeInitial).toBe("3");

    const areaResistPoolInitial = attackSchema.fields.areaResistPool?.getInitialValue?.() ?? attackSchema.fields.areaResistPool?.options?.initial;
    expect(areaResistPoolInitial).toBe("stamina+resistance");

    const areaResistDifficultyInitial = attackSchema.fields.areaResistDifficulty?.getInitialValue?.() ?? attackSchema.fields.areaResistDifficulty?.options?.initial;
    expect(areaResistDifficultyInitial).toBe("1");

    const areaResistEffectInitial = attackSchema.fields.areaResistEffect?.getInitialValue?.() ?? attackSchema.fields.areaResistEffect?.options?.initial;
    expect(areaResistEffectInitial).toBe("avoid");
  });
});

describe("CharmData schema — bypassAmmoConsumption (M71)", () => {
  it("field exists on schema", () => {
    const schema = CharmData.defineSchema();
    expect(schema.bypassAmmoConsumption).toBeDefined();
  });

  it("defaults to false", () => {
    const schema = CharmData.defineSchema();
    const initial = schema.bypassAmmoConsumption.getInitialValue?.() ?? schema.bypassAmmoConsumption.options?.initial;
    expect(initial).toBe(false);
  });
});

describe("CharmData schema — sendsWeaponToElsewhere (M72)", () => {
  it("field exists on schema", () => {
    const schema = CharmData.defineSchema();
    expect(schema.sendsWeaponToElsewhere).toBeDefined();
  });

  it("defaults to false", () => {
    const schema = CharmData.defineSchema();
    const initial = schema.sendsWeaponToElsewhere.getInitialValue?.() ?? schema.sendsWeaponToElsewhere.options?.initial;
    expect(initial).toBe(false);
  });
});

describe("CharmData schema — capturesMalados (M73)", () => {
  it("field exists on schema", () => {
    const schema = CharmData.defineSchema();
    expect(schema.capturesMalados).toBeDefined();
  });

  it("defaults to false", () => {
    const schema = CharmData.defineSchema();
    const initial = schema.capturesMalados.getInitialValue?.() ?? schema.capturesMalados.options?.initial;
    expect(initial).toBe(false);
  });
});

describe("CharmData schema — transfersMalados (M73)", () => {
  it("field exists on schema", () => {
    const schema = CharmData.defineSchema();
    expect(schema.transfersMalados).toBeDefined();
  });

  it("defaults to false", () => {
    const schema = CharmData.defineSchema();
    const initial = schema.transfersMalados.getInitialValue?.() ?? schema.transfersMalados.options?.initial;
    expect(initial).toBe(false);
  });
});

describe("CharmData schema — grantsBackground (M74)", () => {
  it("field exists on schema", () => {
    const schema = CharmData.defineSchema();
    expect(schema.grantsBackground).toBeDefined();
  });

  it("defaults to false", () => {
    const schema = CharmData.defineSchema();
    const initial = schema.grantsBackground.getInitialValue?.() ?? schema.grantsBackground.options?.initial;
    expect(initial).toBe(false);
  });
});

describe("CharmData schema — linksNpcCompanion (M75)", () => {
  it("field exists on schema", () => {
    const schema = CharmData.defineSchema();
    expect(schema.linksNpcCompanion).toBeDefined();
  });

  it("defaults to false", () => {
    const schema = CharmData.defineSchema();
    const initial = schema.linksNpcCompanion.getInitialValue?.() ?? schema.linksNpcCompanion.options?.initial;
    expect(initial).toBe(false);
  });
});
