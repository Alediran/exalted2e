import { describe, it, expect } from "vitest";
import { RESPLENDENT_PARADOX_TRIGGERS, sumResplendentParadoxDice } from "../../module/combat/resplendent-paradox.mjs";

describe("sumResplendentParadoxDice", () => {
  it("returns 0 for empty / undefined", () => {
    expect(sumResplendentParadoxDice([])).toBe(0);
    expect(sumResplendentParadoxDice(undefined)).toBe(0);
  });

  it("returns a single row's dice", () => {
    expect(sumResplendentParadoxDice(["out_of_character"])).toBe(1);
    expect(sumResplendentParadoxDice(["confusing_meeting_other"])).toBe(2);
  });

  it("sums additive rows", () => {
    expect(sumResplendentParadoxDice(["confusing_meeting_other", "concludes_supernatural"])).toBe(4);
    expect(sumResplendentParadoxDice(["anima_glowing", "anima_burning"])).toBe(3);
  });

  it("ignores unknown keys", () => {
    expect(sumResplendentParadoxDice(["out_of_character", "bogus"])).toBe(1);
  });

  it("exposes all eight table rows", () => {
    expect(RESPLENDENT_PARADOX_TRIGGERS.map(t => t.key)).toEqual([
      "out_of_character", "dozen_destinies_month",
      "anima_glowing", "anima_burning",
      "confusing_meeting_self", "confusing_meeting_other",
      "concludes_imitating", "concludes_supernatural",
    ]);
  });
});
