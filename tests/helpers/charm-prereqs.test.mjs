import { describe, it, expect } from "vitest";
import { evaluateCharmPrereqs, areCharmPrereqsMet, meetsMinAbility } from "../../module/helpers/charm-prereqs.mjs";

// Helpers — build minimal charm/actor shapes for testing.
function makeCharm({ id = "host", name = "Host Charm", ability = "melee", prereqGroups = [], charmUid = "" } = {}) {
  return {
    id,
    name,
    type: "charm",
    system: { ability, prereqGroups, charmUid }
  };
}

function makeOwnedCharm({ id, name, ability = "", excellency = "", charmUid = "" } = {}) {
  return {
    id,
    name,
    type: "charm",
    system: { ability, excellency, charmUid }
  };
}

function makeActor(items) {
  return { items: { filter: (fn) => items.filter(fn) } };
}

describe("evaluateCharmPrereqs", () => {
  it("returns empty array when actor is null", () => {
    const charm = makeCharm({ prereqGroups: [{ alternatives: [{ type: "charm", charmName: "X" }] }] });
    expect(evaluateCharmPrereqs(charm, null)).toEqual([]);
  });

  it("returns empty array when charm has no prereq groups", () => {
    const charm = makeCharm({ prereqGroups: [] });
    const actor = makeActor([]);
    expect(evaluateCharmPrereqs(charm, actor)).toEqual([]);
  });

  it("matches a charm alternative by exact charmUid (preferred path)", () => {
    const charm = makeCharm({
      prereqGroups: [{ alternatives: [{ type: "charm", charmUid: "uid-123", charmName: "Stale Name" }] }]
    });
    const actor = makeActor([
      makeOwnedCharm({ id: "x", name: "Different Name Now", charmUid: "uid-123" })
    ]);
    const report = evaluateCharmPrereqs(charm, actor);
    expect(report).toHaveLength(1);
    expect(report[0].satisfied).toBe(true);
  });

  it("falls back to case-insensitive name match when charmUid is empty", () => {
    const charm = makeCharm({
      prereqGroups: [{ alternatives: [{ type: "charm", charmUid: "", charmName: "Excellent Strike" }] }]
    });
    const actor = makeActor([
      makeOwnedCharm({ id: "x", name: "  excellent strike  " })
    ]);
    expect(evaluateCharmPrereqs(charm, actor)[0].satisfied).toBe(true);
  });

  it("anyExcellency matches any owned charm with matching ability", () => {
    const charm = makeCharm({
      ability: "melee",
      prereqGroups: [{ alternatives: [{ type: "anyExcellency" }] }]
    });
    const actor = makeActor([
      makeOwnedCharm({ id: "exc", name: "First Excellency", ability: "melee", excellency: "first" })
    ]);
    expect(evaluateCharmPrereqs(charm, actor)[0].satisfied).toBe(true);
  });

  it("anyExcellency rejects when no excellency charm matches the host's ability", () => {
    const charm = makeCharm({
      ability: "melee",
      prereqGroups: [{ alternatives: [{ type: "anyExcellency" }] }]
    });
    const actor = makeActor([
      makeOwnedCharm({ id: "exc", name: "Archery Exc", ability: "archery", excellency: "first" })
    ]);
    expect(evaluateCharmPrereqs(charm, actor)[0].satisfied).toBe(false);
  });

  it("excludes the host charm from the satisfaction pool", () => {
    // Host charm names itself as a prereq — should not satisfy.
    const charm = makeCharm({
      id: "self",
      name: "Self Reference",
      prereqGroups: [{ alternatives: [{ type: "charm", charmName: "Self Reference" }] }]
    });
    const actor = makeActor([{ ...charm, system: { ...charm.system } }]);
    expect(evaluateCharmPrereqs(charm, actor)[0].satisfied).toBe(false);
  });
});

describe("areCharmPrereqsMet", () => {
  it("true when no prereq groups exist", () => {
    expect(areCharmPrereqsMet(makeCharm({ prereqGroups: [] }), makeActor([]))).toBe(true);
  });
});

describe("areCharmPrereqsMet — Chimera Knack gate", () => {
  function makeKnack({ isChimera = false } = {}) {
    return { type: "knack", system: { isChimera, prereqGroups: [] } };
  }
  function makeActorForKnack({ exaltType = "solar", caste = "dawn", limitValue = 0 } = {}) {
    return {
      system: { exaltType, caste, limit: { value: limitValue } },
      items: { filter: () => [] }
    };
  }

  it("non-Chimera knack always passes regardless of actor", () => {
    const actor = makeActorForKnack({ exaltType: "solar", caste: "dawn", limitValue: 0 });
    expect(areCharmPrereqsMet(makeKnack({ isChimera: false }), actor)).toBe(true);
  });
  it("Chimera knack blocks non-Lunar actor (Solar at Limit 10)", () => {
    const actor = makeActorForKnack({ exaltType: "solar", caste: "dawn", limitValue: 10 });
    expect(areCharmPrereqsMet(makeKnack({ isChimera: true }), actor)).toBe(false);
  });
  it("Chimera knack blocks Lunar with non-casteless caste (fullMoon at Limit 10)", () => {
    const actor = makeActorForKnack({ exaltType: "lunar", caste: "full", limitValue: 10 });
    expect(areCharmPrereqsMet(makeKnack({ isChimera: true }), actor)).toBe(false);
  });
  it("Chimera knack blocks Casteless Lunar at Limit 9", () => {
    const actor = makeActorForKnack({ exaltType: "lunar", caste: "casteless", limitValue: 9 });
    expect(areCharmPrereqsMet(makeKnack({ isChimera: true }), actor)).toBe(false);
  });
  it("Chimera knack passes for Casteless Lunar at Limit 10", () => {
    const actor = makeActorForKnack({ exaltType: "lunar", caste: "casteless", limitValue: 10 });
    expect(areCharmPrereqsMet(makeKnack({ isChimera: true }), actor)).toBe(true);
  });
});

describe("meetsMinAbility", () => {
  function maCharm({ minAbility = 0, martialArtsStyleName = "" } = {}) {
    return { system: { ability: "martialarts", minAbility, martialArtsStyleName, prereqGroups: [] } };
  }
  function attrCharm({ minAbility = 0, ability = "dexterity" } = {}) {
    return { system: { ability, minAbility, prereqGroups: [] } };
  }
  function abilityActor({ exaltType = "solar", martialArts = 0 } = {}) {
    return { system: { exaltType, abilities: { martialArts: { value: martialArts } }, attributes: {} } };
  }
  function lunarActor({ dexterity = 0 } = {}) {
    return { system: { exaltType: "lunar", abilities: { martialArts: { value: 0 } }, attributes: { dexterity: { value: dexterity } } } };
  }

  it("returns true when minAbility is 0 regardless of actor stats", () => {
    expect(meetsMinAbility(maCharm({ minAbility: 0 }), abilityActor({ martialArts: 0 }))).toBe(true);
  });

  it("returns true when actor is null", () => {
    expect(meetsMinAbility(maCharm({ minAbility: 4 }), null)).toBe(true);
  });

  it("martialarts ability — passes when MA meets minimum", () => {
    expect(meetsMinAbility(maCharm({ minAbility: 4 }), abilityActor({ martialArts: 4 }))).toBe(true);
  });

  it("martialarts ability — fails when MA is below minimum", () => {
    expect(meetsMinAbility(maCharm({ minAbility: 4 }), abilityActor({ martialArts: 3 }))).toBe(false);
  });

  it("Lunar Hero Style + Lunar actor — passes on sufficient Dexterity, ignoring low MA", () => {
    const charm = maCharm({ minAbility: 4, martialArtsStyleName: "Lunar Hero Style" });
    const actor = lunarActor({ dexterity: 5 });
    actor.system.abilities.martialArts = { value: 1 };
    expect(meetsMinAbility(charm, actor)).toBe(true);
  });

  it("Lunar Hero Style + Lunar actor — fails when Dexterity is below minimum, even with high MA", () => {
    const charm = maCharm({ minAbility: 4, martialArtsStyleName: "Lunar Hero Style" });
    const actor = lunarActor({ dexterity: 3 });
    actor.system.abilities.martialArts = { value: 5 };
    expect(meetsMinAbility(charm, actor)).toBe(false);
  });

  it("Lunar Hero Style + Solar actor — checks Martial Arts (non-Lunar uses MA path)", () => {
    const charm = maCharm({ minAbility: 4, martialArtsStyleName: "Lunar Hero Style" });
    const actor = abilityActor({ exaltType: "solar", martialArts: 4 });
    expect(meetsMinAbility(charm, actor)).toBe(true);
  });

  it("attribute-keyed ability — passes when attribute meets minimum", () => {
    const charm = attrCharm({ ability: "dexterity", minAbility: 4 });
    const actor = { system: { attributes: { dexterity: { value: 4 } } } };
    expect(meetsMinAbility(charm, actor)).toBe(true);
  });

  it("attribute-keyed ability — fails when attribute is below minimum", () => {
    const charm = attrCharm({ ability: "dexterity", minAbility: 4 });
    const actor = { system: { attributes: { dexterity: { value: 3 } } } };
    expect(meetsMinAbility(charm, actor)).toBe(false);
  });

  it("regular ability key (melee) — always returns true (no minAbility enforcement)", () => {
    const charm = { system: { ability: "melee", minAbility: 5, prereqGroups: [] } };
    const actor = { system: { abilities: {}, attributes: {} } };
    expect(meetsMinAbility(charm, actor)).toBe(true);
  });
});

describe("areCharmPrereqsMet — meetsMinAbility gate", () => {
  it("blocks a MA charm when the actor's Martial Arts is below minAbility", () => {
    const charm = {
      type: "charm",
      system: { ability: "martialarts", minAbility: 4, martialArtsStyleName: "", prereqGroups: [] }
    };
    const actor = {
      system: { exaltType: "solar", abilities: { martialArts: { value: 3 } }, attributes: {}, caste: "", limit: { value: 0 } },
      items: { filter: () => [] }
    };
    expect(areCharmPrereqsMet(charm, actor)).toBe(false);
  });

  it("passes when minAbility is met even with no prereq groups", () => {
    const charm = {
      type: "charm",
      system: { ability: "martialarts", minAbility: 3, martialArtsStyleName: "", prereqGroups: [] }
    };
    const actor = {
      system: { exaltType: "solar", abilities: { martialArts: { value: 3 } }, attributes: {}, caste: "", limit: { value: 0 } },
      items: { filter: () => [] }
    };
    expect(areCharmPrereqsMet(charm, actor)).toBe(true);
  });
});
