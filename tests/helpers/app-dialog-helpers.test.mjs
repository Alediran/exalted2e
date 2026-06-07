import { describe, it, expect } from "vitest";
import {
  isNumbersEligible, buildFormationOptions, buildHeroWeaponRows, parseManualTick, parseTierSelection,
} from "../../module/helpers/app-dialog-helpers.mjs";

const unit = (id, mag, joinMag) => ({
  actor: { id, type: "unit", system: { magnitude: { value: mag } } },
  flags: { exalted2e: { magnitudeAtJoinWar: joinMag } },
});

describe("isNumbersEligible", () => {
  it("true when another unit dropped below its join magnitude and is still above mine", () => {
    expect(isNumbersEligible("me", 2, [unit("o", 3, 5)])).toBe(true);
  });
  it("false when the other unit is not above my magnitude", () => {
    expect(isNumbersEligible("me", 4, [unit("o", 3, 5)])).toBe(false);
  });
  it("ignores self, non-units, and units with no join-magnitude flag", () => {
    expect(isNumbersEligible("me", 1, [unit("me", 3, 5)])).toBe(false);
    expect(isNumbersEligible("me", 1, [{ actor: { id: "x", type: "character", system: { magnitude: { value: 3 } } }, flags: {} }])).toBe(false);
    expect(isNumbersEligible("me", 1, [unit("o", 3, null)])).toBe(false);
  });
  it("empty/undefined combatants → false", () => {
    expect(isNumbersEligible("me", 1, [])).toBe(false);
    expect(isNumbersEligible("me", 1, undefined)).toBe(false);
  });
});

describe("buildFormationOptions", () => {
  const loc = k => k;
  it("includes only formations whose min-drill <= drill, flags current", () => {
    const opts = buildFormationOptions(2, "skirmish", loc);
    expect(opts.map(o => o.value)).toEqual(["unordered", "skirmish", "relaxed"]);
    expect(opts.find(o => o.value === "skirmish").current).toBe(true);
    expect(opts[0].label).toBe("EX2E.FormationUnordered");
  });
  it("drill 3 also includes close", () => {
    expect(buildFormationOptions(3, "", loc).map(o => o.value)).toEqual(["unordered", "skirmish", "relaxed", "close"]);
  });
});

describe("buildHeroWeaponRows", () => {
  const wpn = (id, name, ranged, over = {}) => ({ id, name, system: { ranged, ability: over.ability, damage: over.damage } });
  it("ranged=true keeps ranged weapons; maps display fields", () => {
    const rows = buildHeroWeaponRows([wpn("a", "Bow", true, { ability: "archery", damage: 5 }), wpn("b", "Sword", false)], true, "a");
    expect(rows).toEqual([{ id: "a", name: "Bow", ability: "archery", damage: 5, selected: true }]);
  });
  it("ranged=false keeps melee; ability/damage default; selected flag", () => {
    const rows = buildHeroWeaponRows([wpn("b", "Sword", false)], false, "x");
    expect(rows).toEqual([{ id: "b", name: "Sword", ability: "melee", damage: 0, selected: false }]);
  });
});

describe("parseManualTick", () => {
  it("valid number → max(0, n)", () => {
    expect(parseManualTick("3")).toBe(3);
    expect(parseManualTick("-2")).toBe(0);
    expect(parseManualTick("0")).toBe(0);
  });
  it("empty / null / NaN → null", () => {
    expect(parseManualTick("")).toBeNull();
    expect(parseManualTick(null)).toBeNull();
    expect(parseManualTick("abc")).toBeNull();
  });
});

describe("parseTierSelection", () => {
  const active = [{ id: "t0" }, { id: "t1" }];
  it("'standard' / empty → standard mode", () => {
    expect(parseTierSelection("standard", active)).toEqual({ standard: true });
    expect(parseTierSelection("", active)).toEqual({ standard: true });
  });
  it("valid tier index → that tier", () => {
    expect(parseTierSelection("tier_1", active)).toEqual({ standard: false, tier: { id: "t1" } });
  });
  it("NaN / out-of-bounds → standard mode", () => {
    expect(parseTierSelection("tier_x", active)).toEqual({ standard: true });
    expect(parseTierSelection("tier_5", active)).toEqual({ standard: true });
  });
});
