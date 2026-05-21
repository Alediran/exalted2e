import { describe, it, expect } from "vitest";
import {
  isEligible,
  moteRange,
  buildEligibleCharms,
} from "../../module/helpers/countermagic-helpers.mjs";

function makeCharm(overrides = {}) {
  return {
    system: {
      isCountermagic: true,
      countermagicTier: 1,
      countermagicTradition: "sorcery",
      ...overrides,
    },
  };
}

describe("moteRange", () => {
  it("tier 1 returns fixed 10", () => {
    expect(moteRange(1)).toEqual({ min: 10, max: 10 });
  });
  it("tier 2 returns 15–20", () => {
    expect(moteRange(2)).toEqual({ min: 15, max: 20 });
  });
  it("tier 3 returns 20–25", () => {
    expect(moteRange(3)).toEqual({ min: 20, max: 25 });
  });
  it("unknown/null tier falls back to tier-1 range", () => {
    expect(moteRange(null)).toEqual({ min: 10, max: 10 });
    expect(moteRange(undefined)).toEqual({ min: 10, max: 10 });
    expect(moteRange(0)).toEqual({ min: 10, max: 10 });
  });
});

describe("isEligible", () => {
  it("tier 1 passes circle 1, fails circles 2–3", () => {
    const charm = makeCharm({ countermagicTier: 1 });
    expect(isEligible(charm, 1, "sorcery")).toBe(true);
    expect(isEligible(charm, 2, "sorcery")).toBe(false);
    expect(isEligible(charm, 3, "sorcery")).toBe(false);
  });
  it("tier 2 passes circles 1–2, fails circle 3", () => {
    const charm = makeCharm({ countermagicTier: 2 });
    expect(isEligible(charm, 1, "sorcery")).toBe(true);
    expect(isEligible(charm, 2, "sorcery")).toBe(true);
    expect(isEligible(charm, 3, "sorcery")).toBe(false);
  });
  it("tier 3 passes all circles", () => {
    const charm = makeCharm({ countermagicTier: 3 });
    expect(isEligible(charm, 1, "sorcery")).toBe(true);
    expect(isEligible(charm, 2, "sorcery")).toBe(true);
    expect(isEligible(charm, 3, "sorcery")).toBe(true);
  });
  it("tradition 'sorcery' blocks necromancy targets", () => {
    const charm = makeCharm({ countermagicTier: 3, countermagicTradition: "sorcery" });
    expect(isEligible(charm, 1, "necromancy")).toBe(false);
  });
  it("tradition 'necromancy' blocks sorcery targets", () => {
    const charm = makeCharm({ countermagicTier: 3, countermagicTradition: "necromancy" });
    expect(isEligible(charm, 1, "sorcery")).toBe(false);
  });
  it("tradition 'both' passes sorcery and necromancy", () => {
    const charm = makeCharm({ countermagicTier: 3, countermagicTradition: "both" });
    expect(isEligible(charm, 1, "sorcery")).toBe(true);
    expect(isEligible(charm, 1, "necromancy")).toBe(true);
  });
  it("returns false when isCountermagic is false", () => {
    const charm = makeCharm({ isCountermagic: false });
    expect(isEligible(charm, 1, "sorcery")).toBe(false);
  });
  it("returns false for null/undefined charm", () => {
    expect(isEligible(null, 1, "sorcery")).toBe(false);
    expect(isEligible(undefined, 1, "sorcery")).toBe(false);
  });
});

describe("buildEligibleCharms", () => {
  it("returns charms that pass isEligible for the target", () => {
    const actor = {
      items: {
        contents: [
          makeCharm({ countermagicTier: 1, countermagicTradition: "sorcery" }),
          makeCharm({ countermagicTier: 2, countermagicTradition: "sorcery" }),
          { system: { isCountermagic: false } },
        ],
      },
    };
    const result = buildEligibleCharms(actor, 2, "sorcery");
    expect(result).toHaveLength(1);
    expect(result[0].system.countermagicTier).toBe(2);
  });
  it("returns empty array when no charms match", () => {
    const actor = {
      items: {
        contents: [
          makeCharm({ countermagicTier: 1, countermagicTradition: "sorcery" }),
        ],
      },
    };
    expect(buildEligibleCharms(actor, 3, "sorcery")).toHaveLength(0);
  });
  it("returns empty array for null/undefined actor", () => {
    expect(buildEligibleCharms(null, 1, "sorcery")).toHaveLength(0);
    expect(buildEligibleCharms(undefined, 1, "sorcery")).toHaveLength(0);
  });
});
