import { describe, it, expect } from "vitest";
import { isReflexiveForCombo, isComboBasic, validateComboAdd, charmCostMetaString }
  from "../../module/helpers/combo-helpers.mjs";

const charm = (over = {}) => ({ system: { charmType: "supplemental", keywords: [], ...over } });

describe("predicates", () => {
  it("isReflexiveForCombo: reflexive type OR Combo-Basic keyword", () => {
    expect(isReflexiveForCombo(charm({ charmType: "reflexive" }))).toBe(true);
    expect(isReflexiveForCombo(charm({ keywords: ["Combo-Basic"] }))).toBe(true);
    expect(isReflexiveForCombo(charm())).toBe(false);
  });
  it("isComboBasic: Combo-Basic keyword", () => {
    expect(isComboBasic(charm({ keywords: ["Combo-Basic"] }))).toBe(true);
    expect(isComboBasic(charm())).toBe(false);
  });
});

describe("validateComboAdd", () => {
  it("rejects a second Form charm", () => {
    expect(validateComboAdd(charm({ charmType: "form" }), [charm({ charmType: "form" })]))
      .toBe("EX2E.ComboOneFormType");
  });
  it("rejects a Combo-Basic added alongside a non-reflexive charm", () => {
    expect(validateComboAdd(charm({ keywords: ["Combo-Basic"] }), [charm({ charmType: "supplemental" })]))
      .toBe("EX2E.ComboBasicOnlyWithReflexive");
  });
  it("rejects a non-reflexive added alongside an existing Combo-Basic", () => {
    expect(validateComboAdd(charm({ charmType: "supplemental" }), [charm({ keywords: ["Combo-Basic"] })]))
      .toBe("EX2E.ComboBasicOnlyWithReflexive");
  });
  it("returns null for a legal addition", () => {
    expect(validateComboAdd(charm({ charmType: "reflexive" }), [])).toBeNull();
  });
});

describe("charmCostMetaString", () => {
  it("joins willpower/health/xp components", () => {
    expect(charmCostMetaString({ willpower: 1, bashingHealth: 2, xp: 3 })).toBe("+1wp 2b 3xp");
  });
  it("empty cost → empty string", () => {
    expect(charmCostMetaString({})).toBe("");
  });
  it("mote formula present → starts with formula, followed by non-mote components", () => {
    expect(charmCostMetaString({ formula: "3m", willpower: 1 })).toBe("3m +1wp");
  });
  it("no mote formula with other costs → omits mote string", () => {
    expect(charmCostMetaString({ willpower: 1, bashingHealth: 2 })).toBe("+1wp 2b");
  });
});
