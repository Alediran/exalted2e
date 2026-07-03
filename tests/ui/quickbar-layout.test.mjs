import { describe, it, expect } from "vitest";
import {
  QB_GROUPS, QB_GROUP_OF, groupForDock, partitionForRadial,
} from "../../module/ui/quickbar/quickbar-layout.mjs";

// Descriptor: { key, group }. group defaults via QB_GROUP_OF when omitted.
const d = (key) => ({ key, group: QB_GROUP_OF[key] ?? "utility" });

describe("QB_GROUP_OF", () => {
  it("maps known action keys to their group", () => {
    expect(QB_GROUP_OF.attack).toBe("offense");
    expect(QB_GROUP_OF.move).toBe("movement");
    expect(QB_GROUP_OF.cast).toBe("magic");
    expect(QB_GROUP_OF.guard).toBe("utility");
    expect(QB_GROUP_OF.finish).toBe("turn");
  });
});

describe("groupForDock", () => {
  it("returns segments in canonical order, empty groups omitted", () => {
    const segs = groupForDock([d("attack"), d("move"), d("guard"), d("finish")]);
    expect(segs.map(s => s.group)).toEqual(["offense", "movement", "utility", "turn"]);
  });
  it("keeps only each group's own buttons, preserving input order", () => {
    const segs = groupForDock([d("guard"), d("aim"), d("attack")]);
    const offense = segs.find(s => s.group === "offense");
    const utility = segs.find(s => s.group === "utility");
    expect(offense.items.map(i => i.key)).toEqual(["attack"]);
    expect(utility.items.map(i => i.key)).toEqual(["guard", "aim"]);
  });
  it("falls back to utility for an unknown group", () => {
    const segs = groupForDock([{ key: "mystery", group: undefined }]);
    expect(segs.find(s => s.group === "utility").items[0].key).toBe("mystery");
  });
});

describe("partitionForRadial", () => {
  it("always keeps attack and finish in the bar", () => {
    const { bar, radial } = partitionForRadial(
      [d("attack"), d("aim"), d("finish")], []);
    expect(bar.map(i => i.key)).toContain("attack");
    expect(bar.map(i => i.key)).toContain("finish");
    expect(radial.map(i => i.key)).toEqual(["aim"]);
  });
  it("puts pinned keys in the bar and the rest in the radial, order preserved", () => {
    const { bar, radial } = partitionForRadial(
      [d("attack"), d("guard"), d("move"), d("aim"), d("dash"), d("finish")],
      ["guard", "move"]);
    expect(bar.map(i => i.key)).toEqual(["attack", "guard", "move", "finish"]);
    expect(radial.map(i => i.key)).toEqual(["aim", "dash"]);
  });
  it("orders the bar by the pinned array, not build order", () => {
    // Build order has guard before move; the pinned array reverses them.
    const { bar } = partitionForRadial(
      [d("attack"), d("guard"), d("move"), d("finish")], ["move", "guard"]);
    expect(bar.map(i => i.key)).toEqual(["attack", "move", "guard", "finish"]);
  });
  it("always keeps abort in the bar (one-click abort affordance)", () => {
    const { bar, radial } = partitionForRadial([d("abort"), d("aim")], []);
    expect(bar.map(i => i.key)).toContain("abort");
    expect(radial.map(i => i.key)).toEqual(["aim"]);
  });
  it("ignores unknown pinned keys", () => {
    const { bar, radial } = partitionForRadial(
      [d("attack"), d("aim"), d("finish")], ["nonsense"]);
    expect(bar.map(i => i.key)).toEqual(["attack", "finish"]);
    expect(radial.map(i => i.key)).toEqual(["aim"]);
  });
});
