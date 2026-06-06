import { describe, it, expect } from "vitest";
import { filterSocialCharms, buildSocialCombos } from "../../module/rolls/social-attack-math.mjs";

const charm = (over = {}) => {
  const { system: overSystem, ...overRest } = over;
  return {
    id: "c", name: "C", type: "charm",
    system: { excellency: false, ability: "presence", charmType: "supplemental", steps: [], charmUid: "u", ...overSystem },
    ...overRest,
  };
};

describe("filterSocialCharms", () => {
  it("keeps a supplemental charm on the matching social ability", () => {
    const out = filterSocialCharms([charm()], "presence");
    expect(out.map(c => c.id)).toEqual(["c"]);
  });
  it("keeps a reflexive charm only if it has step 1", () => {
    expect(filterSocialCharms([charm({ id: "r", system: { charmType: "reflexive", steps: [1] } })], "presence").map(c => c.id)).toEqual(["r"]);
    expect(filterSocialCharms([charm({ id: "r", system: { charmType: "reflexive", steps: [2] } })], "presence")).toEqual([]);
  });
  it("excludes excellencies, ability mismatches, and non-social abilities", () => {
    expect(filterSocialCharms([charm({ system: { excellency: true } })], "presence")).toEqual([]);
    expect(filterSocialCharms([charm({ system: { ability: "performance" } })], "presence")).toEqual([]); // ability !== selected
    expect(filterSocialCharms([charm({ system: { ability: "melee", charmType: "supplemental" } })], "melee")).toEqual([]); // not a social ability
  });
});

describe("buildSocialCombos", () => {
  it("counts social-eligible charms per combo, dropping combos with none", () => {
    const charms = [charm({ id: "c1", system: { charmUid: "u1" } })];
    const combos = [
      { id: "k1", name: "K1", system: { charmUids: ["u1"] } },
      { id: "k2", name: "K2", system: { charmUids: ["nope"] } },
    ];
    expect(buildSocialCombos(combos, charms, "presence")).toEqual([{ id: "k1", name: "K1", charmCount: 1 }]);
  });
});
