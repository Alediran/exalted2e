import { describe, it, expect } from "vitest";
import { evaluateCharmPrereqs, areCharmPrereqsMet, meetsMinAbility, describeGroup } from "../../module/helpers/charm-prereqs.mjs";

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

function makeFullActor({ essence = 1, abilities = {}, attributes = {}, items = [] } = {}) {
  return {
    system: { essence: { value: essence }, abilities, attributes },
    items:  { filter: (fn) => items.filter(fn) }
  };
}

function makeBackground({ id = "bg1", name = "Resources", value = 1 } = {}) {
  return { id, name, type: "background", system: { value } };
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

describe("essence prerequisite", () => {
  function prereq(essenceMin) {
    return makeCharm({ prereqGroups: [{ alternatives: [{ type: "essence", essenceMin }] }] });
  }

  it("passes when actor essence equals the minimum", () => {
    const actor = makeFullActor({ essence: 3 });
    expect(evaluateCharmPrereqs(prereq(3), actor)[0].satisfied).toBe(true);
  });

  it("passes when actor essence exceeds the minimum", () => {
    const actor = makeFullActor({ essence: 5 });
    expect(evaluateCharmPrereqs(prereq(3), actor)[0].satisfied).toBe(true);
  });

  it("fails when actor essence is below the minimum", () => {
    const actor = makeFullActor({ essence: 2 });
    expect(evaluateCharmPrereqs(prereq(3), actor)[0].satisfied).toBe(false);
  });
});

describe("ability prerequisite", () => {
  function prereq(abilityKey, abilityMin) {
    return makeCharm({ prereqGroups: [{ alternatives: [{ type: "ability", abilityKey, abilityMin }] }] });
  }

  it("passes when actor ability meets minimum", () => {
    const actor = makeFullActor({ abilities: { melee: { value: 4 } } });
    expect(evaluateCharmPrereqs(prereq("melee", 4), actor)[0].satisfied).toBe(true);
  });

  it("fails when actor ability is below minimum", () => {
    const actor = makeFullActor({ abilities: { melee: { value: 3 } } });
    expect(evaluateCharmPrereqs(prereq("melee", 4), actor)[0].satisfied).toBe(false);
  });

  it("normalizes camelCase ability key (martialArts vs martialarts)", () => {
    const actor = makeFullActor({ abilities: { martialArts: { value: 4 } } });
    expect(evaluateCharmPrereqs(prereq("martialarts", 4), actor)[0].satisfied).toBe(true);
  });

  it("falls back to attributes when ability key not found in abilities", () => {
    const actor = makeFullActor({ attributes: { dexterity: { value: 4 } } });
    expect(evaluateCharmPrereqs(prereq("dexterity", 4), actor)[0].satisfied).toBe(true);
  });

  it("fails when key not found in either abilities or attributes", () => {
    const actor = makeFullActor({});
    expect(evaluateCharmPrereqs(prereq("melee", 1), actor)[0].satisfied).toBe(false);
  });
});

describe("background prerequisite", () => {
  function prereq(backgroundName, backgroundMin = 1) {
    return makeCharm({ prereqGroups: [{ alternatives: [{ type: "background", backgroundName, backgroundMin }] }] });
  }

  it("passes when actor owns background at required dots", () => {
    const actor = makeFullActor({ items: [makeBackground({ name: "Resources", value: 3 })] });
    expect(evaluateCharmPrereqs(prereq("Resources", 3), actor)[0].satisfied).toBe(true);
  });

  it("fails when background dots are below minimum", () => {
    const actor = makeFullActor({ items: [makeBackground({ name: "Resources", value: 2 })] });
    expect(evaluateCharmPrereqs(prereq("Resources", 3), actor)[0].satisfied).toBe(false);
  });

  it("fails when background is not owned", () => {
    const actor = makeFullActor({ items: [] });
    expect(evaluateCharmPrereqs(prereq("Resources", 1), actor)[0].satisfied).toBe(false);
  });

  it("matches background name case-insensitively", () => {
    const actor = makeFullActor({ items: [makeBackground({ name: "RESOURCES", value: 2 })] });
    expect(evaluateCharmPrereqs(prereq("resources", 2), actor)[0].satisfied).toBe(true);
  });

  it("passes with default backgroundMin of 1 when background owned at any dots", () => {
    const charm = makeCharm({ prereqGroups: [{ alternatives: [{ type: "background", backgroundName: "Contacts" }] }] });
    const actor = makeFullActor({ items: [makeBackground({ name: "Contacts", value: 1 })] });
    expect(evaluateCharmPrereqs(charm, actor)[0].satisfied).toBe(true);
  });
});

describe("describeGroup — anyExcellency label", () => {
  it("includes abilityKey in label when minCount=1 and abilityKey is set", () => {
    const group = { alternatives: [{ type: "anyExcellency", abilityKey: "lore", minCount: 1 }] };
    const label = describeGroup(group);
    // game.i18n.format mock returns "key:{\"field\":\"value\"}"
    expect(label).toBe('EX2E.PrereqAnyAbilityExcellency:{"ability":"lore"}');
  });

  it("returns generic key when abilityKey is empty and minCount=1", () => {
    const group = { alternatives: [{ type: "anyExcellency", abilityKey: "", minCount: 1 }] };
    const label = describeGroup(group);
    expect(label).toBe("EX2E.PrereqAnyExcellency");
  });

  it("includes ability and count when minCount>1", () => {
    const group = { alternatives: [{ type: "anyExcellency", abilityKey: "lore", minCount: 2 }] };
    const label = describeGroup(group);
    expect(label).toBe('EX2E.PrereqAnyNExcellencies:{"count":2,"ability":"lore"}');
  });
});

describe("anyExcellency minCount", () => {
  function makeExcPrereq(abilityKey, minCount) {
    return { type: "anyExcellency", charmUid: "", charmName: "", abilityKey, virtueKey: "valor", virtueMin: 1, minCount };
  }

  it("minCount 1, one matching Excellency — satisfied (backward-compat baseline)", () => {
    const charm = makeCharm({ ability: "lore", prereqGroups: [{ alternatives: [makeExcPrereq("lore", 1)] }] });
    const actor = makeActor([makeOwnedCharm({ id: "e1", name: "First Lore Exc", ability: "lore", excellency: "first" })]);
    const report = evaluateCharmPrereqs(charm, actor);
    expect(report[0].satisfied).toBe(true);
  });

  it("minCount 2, one matching Excellency — not satisfied", () => {
    const charm = makeCharm({ ability: "lore", prereqGroups: [{ alternatives: [makeExcPrereq("lore", 2)] }] });
    const actor = makeActor([makeOwnedCharm({ id: "e1", name: "First Lore Exc", ability: "lore", excellency: "first" })]);
    const report = evaluateCharmPrereqs(charm, actor);
    expect(report[0].satisfied).toBe(false);
  });

  it("minCount 2, two matching Excellencies — satisfied", () => {
    const charm = makeCharm({ ability: "lore", prereqGroups: [{ alternatives: [makeExcPrereq("lore", 2)] }] });
    const actor = makeActor([
      makeOwnedCharm({ id: "e1", name: "First Lore Exc",  ability: "lore", excellency: "first" }),
      makeOwnedCharm({ id: "e2", name: "Second Lore Exc", ability: "lore", excellency: "second" })
    ]);
    const report = evaluateCharmPrereqs(charm, actor);
    expect(report[0].satisfied).toBe(true);
  });

  it("minCount 2, two Excellencies of wrong ability — not satisfied", () => {
    const charm = makeCharm({ ability: "lore", prereqGroups: [{ alternatives: [makeExcPrereq("lore", 2)] }] });
    const actor = makeActor([
      makeOwnedCharm({ id: "e1", name: "First Occult Exc",  ability: "occult", excellency: "first" }),
      makeOwnedCharm({ id: "e2", name: "Second Occult Exc", ability: "occult", excellency: "second" })
    ]);
    const report = evaluateCharmPrereqs(charm, actor);
    expect(report[0].satisfied).toBe(false);
  });

  it("minCount 2, no abilityKey — falls back to charm's own ability", () => {
    const charm = makeCharm({ ability: "lore", prereqGroups: [{ alternatives: [makeExcPrereq("", 2)] }] });
    const actor = makeActor([
      makeOwnedCharm({ id: "e1", name: "First Lore Exc",  ability: "lore", excellency: "first" }),
      makeOwnedCharm({ id: "e2", name: "Second Lore Exc", ability: "lore", excellency: "second" })
    ]);
    const report = evaluateCharmPrereqs(charm, actor);
    expect(report[0].satisfied).toBe(true);
  });

  it("minCount undefined — treated as 1, satisfied with one match", () => {
    const charm = makeCharm({ ability: "lore", prereqGroups: [{ alternatives: [{ type: "anyExcellency", charmUid: "", charmName: "", abilityKey: "lore", virtueKey: "valor", virtueMin: 1 }] }] });
    const actor = makeActor([makeOwnedCharm({ id: "e1", name: "First Lore Exc", ability: "lore", excellency: "first" })]);
    const report = evaluateCharmPrereqs(charm, actor);
    expect(report[0].satisfied).toBe(true);
  });
});

describe("anyCharmOfAbility prerequisite", () => {
  it("satisfied when actor owns at least one charm of the target ability", () => {
    const charm = makeCharm({
      ability: "survival",
      prereqGroups: [{ alternatives: [{ type: "anyCharmOfAbility", abilityKey: "medicine", charmUid: "", charmName: "" }] }]
    });
    const actor = makeActor([
      makeOwnedCharm({ id: "m1", name: "Wound-Mending Care", ability: "medicine" })
    ]);
    expect(evaluateCharmPrereqs(charm, actor)[0].satisfied).toBe(true);
  });

  it("not satisfied when actor owns no charm of the target ability", () => {
    const charm = makeCharm({
      ability: "survival",
      prereqGroups: [{ alternatives: [{ type: "anyCharmOfAbility", abilityKey: "medicine", charmUid: "", charmName: "" }] }]
    });
    const actor = makeActor([
      makeOwnedCharm({ id: "s1", name: "Trackless Step", ability: "survival" })
    ]);
    expect(evaluateCharmPrereqs(charm, actor)[0].satisfied).toBe(false);
  });

  it("not satisfied when abilityKey is empty", () => {
    const charm = makeCharm({
      ability: "survival",
      prereqGroups: [{ alternatives: [{ type: "anyCharmOfAbility", abilityKey: "", charmUid: "", charmName: "" }] }]
    });
    const actor = makeActor([
      makeOwnedCharm({ id: "m1", name: "Any", ability: "medicine" })
    ]);
    expect(evaluateCharmPrereqs(charm, actor)[0].satisfied).toBe(false);
  });

  it("label includes the abilityKey", () => {
    const group = { alternatives: [{ type: "anyCharmOfAbility", abilityKey: "medicine", charmUid: "", charmName: "" }] };
    expect(describeGroup(group)).toBe('EX2E.PrereqAnyCharmOfAbility:{"ability":"medicine"}');
  });
});
