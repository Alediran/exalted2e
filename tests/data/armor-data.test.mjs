import { describe, it, expect, vi, afterEach } from "vitest";
import { ArmorData } from "../../module/data/item/armor-data.mjs";

afterEach(() => {
  vi.restoreAllMocks();
});

function _prepDerivedData(armorSystem) {
  const data = Object.create(ArmorData.prototype);
  Object.assign(data, armorSystem);
  data.prepareDerivedData();
  return data;
}

describe("ArmorData schema — artifact fields", () => {
  let schema;
  beforeAll(() => { schema = ArmorData.defineSchema(); });

  it("artifactRating: min 0, max 5, integer, initial 0", () => {
    expect(schema.artifactRating.options).toMatchObject({ min: 0, max: 5, integer: true, initial: 0 });
  });

  it("hearthstoneSlots: min 0, max 3, integer, initial 0", () => {
    expect(schema.hearthstoneSlots.options).toMatchObject({ min: 0, max: 3, integer: true, initial: 0 });
  });
});

describe("ArmorData.prepareDerivedData", () => {
  it("unattuned armor gets no material bonus", () => {
    const sys = {
      soak: { bashing: 5, lethal: 3, aggravated: 0 },
      hardness: 0,
      mobilityPenalty: -1,
      fatiguePenalty: -1,
      artifact: false,
      magicalMaterial: "",
      attunementCost: 0,
      attuned: false,
      tags: [],
      description: "",
      equipped: false
    };
    const result = _prepDerivedData(sys);
    expect(result.effectiveSoak.bashing).toBe(5);
    expect(result.effectiveSoak.lethal).toBe(3);
    expect(result.effectiveHardness).toBe(0);
  });

  it("orichalcum artifact (core): +2/+2/+0 soak, +1 hardness", () => {
    const sys = {
      soak: { bashing: 5, lethal: 3, aggravated: 0 },
      hardness: 0,
      mobilityPenalty: 0,
      fatiguePenalty: 0,
      artifact: true,
      magicalMaterial: "orichalcum",
      attunementCost: 4,
      attuned: true,
      tags: [],
      description: "",
      equipped: true
    };
    const result = _prepDerivedData(sys);
    expect(result.effectiveSoak.bashing).toBe(5 + 2);
    expect(result.effectiveSoak.lethal).toBe(3 + 2);
    expect(result.effectiveSoak.aggravated).toBe(0);
    expect(result.effectiveHardness).toBe(1);
  });

  it("moonsilver mobility-penalty bonus reduces magnitude (capped at 0)", () => {
    const sys = {
      soak: { bashing: 0, lethal: 0, aggravated: 0 },
      hardness: 0,
      mobilityPenalty: -1,    // -1 base; moonsilver bonus = +2
      fatiguePenalty: 0,
      artifact: true,
      magicalMaterial: "moonsilver",
      attunementCost: 4,
      attuned: true,
      tags: [],
      description: "",
      equipped: true
    };
    const result = _prepDerivedData(sys);
    // -1 + 2 = +1, but Math.min(0, +1) = 0 — penalty can't go positive.
    expect(result.effectiveMobilityPenalty).toBe(0);
  });

  it("starmetal armor (errata): minDamageReduction adds hardness", () => {
    vi.spyOn(game.settings, "get").mockImplementation((scope, key) => {
      if (key === "useErrataMaterials") return true;
      return false;
    });
    const sys = {
      soak: { bashing: 0, lethal: 0, aggravated: 0 },
      hardness: 0,
      mobilityPenalty: 0,
      fatiguePenalty: 0,
      artifact: true,
      magicalMaterial: "starmetal",
      attunementCost: 4,
      attuned: true,
      tags: [],
      description: "",
      equipped: true
    };
    const result = _prepDerivedData(sys);
    // Errata starmetal: +1 hardness (same as core in this case).
    expect(result.effectiveHardness).toBe(1);
  });
});
