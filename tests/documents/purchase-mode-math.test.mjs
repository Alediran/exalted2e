import { describe, it, expect } from "vitest";
import { collectPermanentTraitChanges } from "../../module/documents/purchase-mode-math.mjs";
import { makeCharacterSystem } from "../_helpers/make-actor.mjs";

function makeActor(overrides = {}) {
  return { system: makeCharacterSystem(overrides) };
}

describe("collectPermanentTraitChanges", () => {
  it("attribute increase produces an 'increase' row", () => {
    const actor = makeActor({
      attributes: { ...makeCharacterSystem().attributes, strength: { value: 2 } }
    });
    const changed = { system: { attributes: { strength: { value: 3 } } } };
    const out = collectPermanentTraitChanges(changed, actor);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      path: "system.attributes.strength.value",
      oldValue: 2,
      newValue: 3,
      kind: "increase"
    });
  });

  it("attribute reduction produces a 'reduction' row", () => {
    const actor = makeActor({
      attributes: { ...makeCharacterSystem().attributes, strength: { value: 4 } }
    });
    const changed = { system: { attributes: { strength: { value: 2 } } } };
    const out = collectPermanentTraitChanges(changed, actor);
    expect(out[0].kind).toBe("reduction");
    expect(out[0].oldValue).toBe(4);
    expect(out[0].newValue).toBe(2);
  });

  it("ability change produces a row with the matching path", () => {
    const actor = makeActor({
      abilities: { ...makeCharacterSystem().abilities, melee: {
        value: 2, defaultAttribute: "", caste: false, favored: false, specialties: []
      } }
    });
    const changed = { system: { abilities: { melee: { value: 4 } } } };
    const out = collectPermanentTraitChanges(changed, actor);
    expect(out[0].path).toBe("system.abilities.melee.value");
    expect(out[0].kind).toBe("increase");
  });

  it("virtue change produces a row", () => {
    const actor = makeActor({
      virtues: {
        compassion: { value: 1, current: 1 },
        conviction: { value: 2, current: 2 },
        temperance: { value: 1, current: 1 },
        valor:      { value: 1, current: 1 }
      }
    });
    const changed = { system: { virtues: { conviction: { value: 3 } } } };
    const out = collectPermanentTraitChanges(changed, actor);
    expect(out[0].path).toBe("system.virtues.conviction.value");
    expect(out[0].oldValue).toBe(2);
    expect(out[0].newValue).toBe(3);
  });

  it("essence and willpower changes are recognized", () => {
    const actor = makeActor({
      essence: { value: 2, max: 2 },
      willpower: { value: 5, max: 5 }
    });
    const changed = {
      system: {
        essence:   { value: 3 },
        willpower: { max: 6 }
      }
    };
    const out = collectPermanentTraitChanges(changed, actor);
    const paths = out.map(r => r.path).sort();
    expect(paths).toEqual(["system.essence.value", "system.willpower.max"]);
  });

  it("specialty array length delta produces a row (not a per-specialty row)", () => {
    const actor = makeActor({
      abilities: { ...makeCharacterSystem().abilities, melee: {
        value: 3, defaultAttribute: "", caste: false, favored: false,
        specialties: [{ name: "Daggers", value: 1 }]
      } }
    });
    const changed = {
      system: {
        abilities: {
          melee: {
            specialties: [
              { name: "Daggers", value: 1 },
              { name: "Swords",  value: 1 }
            ]
          }
        }
      }
    };
    const out = collectPermanentTraitChanges(changed, actor);
    const specialtyRow = out.find(r => r.path === "system.abilities.melee.specialties");
    expect(specialtyRow).toBeDefined();
    expect(specialtyRow.oldValue).toBe(1);
    expect(specialtyRow.newValue).toBe(2);
    expect(specialtyRow.kind).toBe("increase");
  });

  it("no-change updates produce no rows (oldValue === newValue is skipped)", () => {
    const actor = makeActor({
      attributes: { ...makeCharacterSystem().attributes, strength: { value: 3 } }
    });
    const changed = { system: { attributes: { strength: { value: 3 } } } };
    const out = collectPermanentTraitChanges(changed, actor);
    expect(out).toEqual([]);
  });
});
