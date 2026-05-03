import { describe, it, expect } from "vitest";
import { evaluateCharmPrereqs, areCharmPrereqsMet } from "../../module/helpers/charm-prereqs.mjs";

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
