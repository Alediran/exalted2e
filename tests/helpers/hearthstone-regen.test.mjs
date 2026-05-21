import { describe, it, expect } from "vitest";
import { computeHearthstoneMoteRegen } from "../../module/helpers/hearthstone-regen.mjs";

function makeItem({ id, type, rating = 0, hearthstones = [] } = {}) {
  return { id, type, system: { rating, hearthstones } };
}

describe("computeHearthstoneMoteRegen", () => {
  it("returns 0 when no hearthstones are socketed", () => {
    const weapon = makeItem({ id: "w1", type: "weapon" });
    const stone  = makeItem({ id: "s1", type: "hearthstone", rating: 3 });
    expect(computeHearthstoneMoteRegen([weapon, stone])).toBe(0);
  });

  it("returns 2 × rating for one socketed hearthstone", () => {
    const weapon = makeItem({ id: "w1", type: "weapon", hearthstones: ["s1"] });
    const stone  = makeItem({ id: "s1", type: "hearthstone", rating: 3 });
    expect(computeHearthstoneMoteRegen([weapon, stone])).toBe(6);
  });

  it("sums regen across two stones socketed in two different artifacts", () => {
    const weapon = makeItem({ id: "w1", type: "weapon", hearthstones: ["s1"] });
    const armor  = makeItem({ id: "a1", type: "armor",  hearthstones: ["s2"] });
    const s1     = makeItem({ id: "s1", type: "hearthstone", rating: 2 });
    const s2     = makeItem({ id: "s2", type: "hearthstone", rating: 4 });
    expect(computeHearthstoneMoteRegen([weapon, armor, s1, s2])).toBe(12);
  });

  it("skips a socket ID that has no matching hearthstone item", () => {
    const weapon = makeItem({ id: "w1", type: "weapon", hearthstones: ["missing"] });
    expect(computeHearthstoneMoteRegen([weapon])).toBe(0);
  });

  it("does not count an unslotted hearthstone", () => {
    const weapon = makeItem({ id: "w1", type: "weapon", hearthstones: [] });
    const stone  = makeItem({ id: "s1", type: "hearthstone", rating: 5 });
    expect(computeHearthstoneMoteRegen([weapon, stone])).toBe(0);
  });

  it("ignores empty-string entries in the hearthstones array", () => {
    const weapon = makeItem({ id: "w1", type: "weapon", hearthstones: ["", "s1"] });
    const stone  = makeItem({ id: "s1", type: "hearthstone", rating: 1 });
    expect(computeHearthstoneMoteRegen([weapon, stone])).toBe(2);
  });

  it("handles equipment type artifacts", () => {
    const equip = makeItem({ id: "e1", type: "equipment", hearthstones: ["s1"] });
    const stone = makeItem({ id: "s1", type: "hearthstone", rating: 2 });
    expect(computeHearthstoneMoteRegen([equip, stone])).toBe(4);
  });
});
