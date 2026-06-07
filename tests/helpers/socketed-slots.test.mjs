import { describe, it, expect } from "vitest";
import { buildSocketedSlots } from "../../module/helpers/equip-slots.mjs";

const stone = (id, name, rating) => ({ id, name, type: "hearthstone", system: { rating } });

describe("buildSocketedSlots", () => {
  it("returns one row per slot, filled where a matching hearthstone exists", () => {
    const item = {
      system: { hearthstoneSlots: 2, hearthstones: ["s1", ""] },
      parent: { items: [stone("s1", "Gem", 3)] },
    };
    expect(buildSocketedSlots(item)).toEqual([
      { index: 0, filled: true,  stoneId: "s1", stoneName: "Gem", stoneRating: 3 },
      { index: 1, filled: false, stoneId: "",   stoneName: "",    stoneRating: 0 },
    ]);
  });
  it("treats a referenced-but-missing stone as empty", () => {
    const item = { system: { hearthstoneSlots: 1, hearthstones: ["gone"] }, parent: { items: [] } };
    expect(buildSocketedSlots(item)[0]).toEqual({ index: 0, filled: false, stoneId: "gone", stoneName: "", stoneRating: 0 });
  });
  it("returns [] for zero slots and tolerates no parent", () => {
    expect(buildSocketedSlots({ system: { hearthstoneSlots: 0 } })).toEqual([]);
    expect(buildSocketedSlots({ system: { hearthstoneSlots: 1, hearthstones: [] } })).toEqual([
      { index: 0, filled: false, stoneId: "", stoneName: "", stoneRating: 0 },
    ]);
  });
});
