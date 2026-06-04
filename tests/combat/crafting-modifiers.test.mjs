import { describe, it, expect } from "vitest";
import {
  WORKSHOP_DICE_MOD, workshopDiceMod, assistantBonusSuccesses, effectiveWorkshopMod,
} from "../../module/helpers/crafting-helpers.mjs";

describe("workshopDiceMod", () => {
  it("maps each tier", () => {
    expect(workshopDiceMod("rudimentary")).toBe(-4);
    expect(workshopDiceMod("basic")).toBe(-2);
    expect(workshopDiceMod("masters")).toBe(0);
    expect(workshopDiceMod("flawless")).toBe(2);
    expect(workshopDiceMod("ideal")).toBe(4);
  });
  it("unknown / blank → 0", () => {
    expect(workshopDiceMod("bogus")).toBe(0);
    expect(workshopDiceMod("")).toBe(0);
    expect(workshopDiceMod(undefined)).toBe(0);
  });
  it("exposes the table", () => {
    expect(WORKSHOP_DICE_MOD.ideal).toBe(4);
  });
});

describe("assistantBonusSuccesses", () => {
  it("zero for empty / missing", () => {
    expect(assistantBonusSuccesses({})).toBe(0);
    expect(assistantBonusSuccesses(undefined)).toBe(0);
  });
  it("applies each rate with floors", () => {
    expect(assistantBonusSuccesses({ mortalAides: 9 })).toBe(1);
    expect(assistantBonusSuccesses({ lesserArtisans: 5 })).toBe(2);
    expect(assistantBonusSuccesses({ greaterArtisans: 2 })).toBe(8);
    expect(assistantBonusSuccesses({ mightyArtisans: 1 })).toBe(6);
  });
  it("sums a mixed crew", () => {
    expect(assistantBonusSuccesses({
      mortalAides: 10, lesserArtisans: 3, greaterArtisans: 1, mightyArtisans: 1,
    })).toBe(2 + 1 + 4 + 6);
  });
});

describe("effectiveWorkshopMod", () => {
  it("passes through when not waived", () => {
    expect(effectiveWorkshopMod("rudimentary", { wordsAsWorkshop: false })).toBe(-4);
    expect(effectiveWorkshopMod("ideal", { wordsAsWorkshop: false })).toBe(4);
  });
  it("floors at Master's (0) when waived, never lowers a bonus", () => {
    expect(effectiveWorkshopMod("rudimentary", { wordsAsWorkshop: true })).toBe(0);
    expect(effectiveWorkshopMod("basic", { wordsAsWorkshop: true })).toBe(0);
    expect(effectiveWorkshopMod("ideal", { wordsAsWorkshop: true })).toBe(4);
  });
});
