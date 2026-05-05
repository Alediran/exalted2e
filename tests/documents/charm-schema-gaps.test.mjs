import { describe, it, expect, beforeAll } from "vitest";
import { CharmData } from "../../module/data/item/charm-data.mjs";
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
  it("D3: mirrorCharmRef exists on schema", () => {
    expect(schema).toHaveProperty("mirrorCharmRef");
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
