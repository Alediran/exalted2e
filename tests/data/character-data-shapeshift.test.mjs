import { describe, it, expect } from "vitest";
import { CharacterData } from "../../module/data/actor/character-data.mjs";

/**
 * Build a synthetic systemData and a parent actor stub. Calls
 * CharacterData.prototype._applyActiveFormSubstitution.call(fakeThis, systemData).
 *
 * `fakeThis` carries `exaltType` and a `parent` whose `items.get(id)` returns
 * the requested form (or null). `systemData` carries the splat block plus the
 * 9 attributes-with-value object.
 */
function makeSubstitutionContext({
  exaltType = "lunar",
  activeFormId = "",
  formItem = null,
  attributesValues = { strength: 2, dexterity: 2, stamina: 2, charisma: 2, manipulation: 2, appearance: 2, perception: 2, intelligence: 2, wits: 2 }
} = {}) {
  const attrs = {};
  for (const [k, v] of Object.entries(attributesValues)) {
    attrs[k] = { value: v, caste: false, favored: false };
  }
  const fakeThis = {
    exaltType,
    parent: {
      items: {
        get: (id) => (formItem && id === formItem.id) ? formItem : null
      }
    }
  };
  const systemData = {
    splat: { lunar: { activeFormId } },
    attributes: attrs
  };
  return { fakeThis, systemData };
}

describe("CharacterData._applyActiveFormSubstitution", () => {
  it("substitutes Str/Dex/Sta when active form resolves", () => {
    const formItem = {
      id: "form-tigress", type: "form",
      system: { attributes: { strength: 5, dexterity: 4, stamina: 5,
        charisma: 1, manipulation: 1, appearance: 1, perception: 1, intelligence: 1, wits: 1 } }
    };
    const { fakeThis, systemData } = makeSubstitutionContext({
      activeFormId: "form-tigress", formItem
    });
    CharacterData.prototype._applyActiveFormSubstitution.call(fakeThis, systemData);
    expect(systemData.attributes.strength.value).toBe(5);
    expect(systemData.attributes.dexterity.value).toBe(4);
    expect(systemData.attributes.stamina.value).toBe(5);
    // Mental/social unchanged
    expect(systemData.attributes.charisma.value).toBe(2);
    expect(systemData.attributes.intelligence.value).toBe(2);
    expect(systemData.attributes.wits.value).toBe(2);
  });

  it("does nothing when activeFormId is empty (human guise)", () => {
    const { fakeThis, systemData } = makeSubstitutionContext({ activeFormId: "" });
    CharacterData.prototype._applyActiveFormSubstitution.call(fakeThis, systemData);
    expect(systemData.attributes.strength.value).toBe(2);
    expect(systemData.attributes.dexterity.value).toBe(2);
    expect(systemData.attributes.stamina.value).toBe(2);
  });

  it("does nothing when actor is non-Lunar", () => {
    const formItem = {
      id: "form-tigress", type: "form",
      system: { attributes: { strength: 5, dexterity: 4, stamina: 5 } }
    };
    const { fakeThis, systemData } = makeSubstitutionContext({
      exaltType: "solar", activeFormId: "form-tigress", formItem
    });
    CharacterData.prototype._applyActiveFormSubstitution.call(fakeThis, systemData);
    expect(systemData.attributes.strength.value).toBe(2);
  });

  it("does nothing when activeFormId points to a missing item", () => {
    const { fakeThis, systemData } = makeSubstitutionContext({
      activeFormId: "form-deleted", formItem: null
    });
    CharacterData.prototype._applyActiveFormSubstitution.call(fakeThis, systemData);
    expect(systemData.attributes.strength.value).toBe(2);
  });
});
