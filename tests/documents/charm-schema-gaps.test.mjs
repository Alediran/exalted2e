import { describe, it, expect, beforeAll } from "vitest";
import { CharmData } from "../../module/data/item/charm-data.mjs";
import { CharacterData } from "../../module/data/actor/character-data.mjs";
import { areCharmPrereqsMet } from "../../module/helpers/charm-prereqs.mjs";

describe("CharmData schema gaps — field presence", () => {
  let schema;
  beforeAll(() => { schema = CharmData.defineSchema(); });

  it("B6: dvPenalty exists on schema", () => {
    expect(schema).toHaveProperty("dvPenalty");
  });
  it("B1: cost has motesLabel field", () => {
    expect(schema.cost.options).toHaveProperty("motesLabel");
  });
  it("B5: martialArtsStyleName exists on schema", () => {
    expect(schema).toHaveProperty("martialArtsStyleName");
  });
  it("B4: maidenAffiliation exists on schema", () => {
    expect(schema).toHaveProperty("maidenAffiliation");
  });
  it("B8: cost has resonance field", () => {
    expect(schema.cost.options).toHaveProperty("resonance");
  });
  it("D1: cost has limitTrigger field", () => {
    expect(schema.cost.options).toHaveProperty("limitTrigger");
  });
  it("D2: durationFormula exists on schema", () => {
    expect(schema).toHaveProperty("durationFormula");
  });
  it("D3: mirrorId exists on schema", () => {
    expect(schema).toHaveProperty("mirrorId");
  });
  it("D5: stackCount exists on schema", () => {
    expect(schema).toHaveProperty("stackCount");
  });
  it("B7: virtue is a valid choice for prereq alternative type", () => {
    // prereqGroups(ArrayField).options = element SchemaField
    // element SchemaField.options = { alternatives: ArrayField }
    // alternatives(ArrayField).options = alt SchemaField
    // alt SchemaField.options = { type: StringField, ... }
    const altFields = schema.prereqGroups.options.options.alternatives.options.options;
    expect(altFields.type.options.choices).toContain("virtue");
  });
  it("B7: virtueKey and virtueMin fields exist on prereq alternatives", () => {
    const altFields = schema.prereqGroups.options.options.alternatives.options.options;
    expect(altFields).toHaveProperty("virtueKey");
    expect(altFields).toHaveProperty("virtueMin");
  });
});

describe("areCharmPrereqsMet — virtue prerequisites (B7)", () => {
  function makeActor(overrides = {}) {
    const base = { compassion: 1, conviction: 1, temperance: 1, valor: 1 };
    const merged = { ...base, ...overrides };
    return {
      system: {
        virtues: Object.fromEntries(
          Object.entries(merged).map(([k, v]) => [k, { dotRating: v }])
        )
      },
      items: []
    };
  }

  function makeCharm(groups) {
    return { type: "charm", id: "c1", system: { prereqGroups: groups }, actor: null };
  }

  it("satisfies when actor's virtue rating meets the minimum", () => {
    const charm = makeCharm([{
      alternatives: [{ type: "virtue", virtueKey: "valor", virtueMin: 3 }]
    }]);
    expect(areCharmPrereqsMet(charm, makeActor({ valor: 3 }))).toBe(true);
  });

  it("fails when actor's virtue rating is below the minimum", () => {
    const charm = makeCharm([{
      alternatives: [{ type: "virtue", virtueKey: "valor", virtueMin: 4 }]
    }]);
    expect(areCharmPrereqsMet(charm, makeActor({ valor: 3 }))).toBe(false);
  });

  it("satisfies OR group when any one alternative is met", () => {
    const charm = makeCharm([{
      alternatives: [
        { type: "virtue", virtueKey: "compassion", virtueMin: 3 },
        { type: "virtue", virtueKey: "valor",      virtueMin: 2 }
      ]
    }]);
    expect(areCharmPrereqsMet(charm, makeActor({ compassion: 1, valor: 2 }))).toBe(true);
  });

  it("blank virtueKey always fails (defensive)", () => {
    const charm = makeCharm([{
      alternatives: [{ type: "virtue", virtueKey: "", virtueMin: 1 }]
    }]);
    expect(areCharmPrereqsMet(charm, makeActor())).toBe(false);
  });
});

describe("CharmData — perfectDefenseType and payload schemas", () => {
  const fields = foundry.data.fields;
  let schema;
  beforeAll(() => { schema = CharmData.defineSchema(); });

  it("perfectDefenseType is a StringField", () => {
    expect(schema.perfectDefenseType).toBeInstanceOf(fields.StringField);
    expect(schema.perfectDefenseType.initial).toBe("");
  });

  const payloads = [
    "healthGrant", "soakBonus", "woundReduction", "statBoost",
    "moteRecovery", "healingRoll", "statusApply", "motePoolBonus",
    "extraActions", "dvBonus", "attackBonus", "targetPenalty", "speedModifier"
  ];
  for (const name of payloads) {
    it(`${name} is a SchemaField with enabled:false BooleanField`, () => {
      expect(schema[name]).toBeInstanceOf(fields.SchemaField);
      expect(schema[name].fields.enabled).toBeInstanceOf(fields.BooleanField);
      expect(schema[name].fields.enabled.initial).toBe(false);
    });
  }

  it("targetEffect defaults correctly", () => {
    const field = schema.targetEffect;

    expect(field).toBeInstanceOf(fields.SchemaField);
    expect(field.fields.enabled.initial).toBe(false);
    expect(field.fields.trigger.initial).toBe("onHit");
    expect(field.fields.trigger.options.choices).toEqual(["onHit", "onActivate"]);
    expect(field.fields.label.initial).toBe("");
    expect(field.fields.icon.initial).toBe("icons/svg/aura.svg");
    expect(field.fields.duration.initial).toBe("oneScene");
    expect(field.fields.duration.options.choices).toEqual(["oneScene", "indefinite", "permanent"]);
    expect(field.fields.changes).toBeInstanceOf(fields.ArrayField);
    expect(field.fields.internalPenalty.fields.enabled.initial).toBe(false);
    expect(field.fields.internalPenalty.fields.type.initial).toBe("all");
    expect(field.fields.internalPenalty.fields.amount.initial).toBe(-1);
    expect(field.fields.perDamageLevel.initial).toBe(false);
  });
});

describe("CharacterData — bonus fields", () => {
  const fields = foundry.data.fields;
  let schema;
  beforeAll(() => { schema = CharacterData.defineSchema(); });

  it("motes.personal has a bonus NumberField defaulting to 0", () => {
    const f = schema.motes.fields.personal.fields.bonus;
    expect(f).toBeInstanceOf(fields.NumberField);
    expect(f.initial).toBe(0);
  });

  it("motes.peripheral has a bonus NumberField defaulting to 0", () => {
    const f = schema.motes.fields.peripheral.fields.bonus;
    expect(f).toBeInstanceOf(fields.NumberField);
    expect(f.initial).toBe(0);
  });

  it("bonuses SchemaField has woundPenaltyReduction, soakBashing, soakLethal, soakAggravated, hardnessAdd", () => {
    const b = schema.bonuses.fields;
    expect(b.woundPenaltyReduction).toBeInstanceOf(fields.NumberField);
    expect(b.soakBashing).toBeInstanceOf(fields.NumberField);
    expect(b.soakLethal).toBeInstanceOf(fields.NumberField);
    expect(b.soakAggravated).toBeInstanceOf(fields.NumberField);
    expect(b.hardnessAdd).toBeInstanceOf(fields.NumberField);
  });
});
