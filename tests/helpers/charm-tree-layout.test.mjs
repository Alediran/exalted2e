import { describe, it, expect } from "vitest";
import { assignCoordinates } from "../../module/helpers/charm-tree-layout.mjs";

function tree(spec) {
  const nodes = new Map();
  const tierMap = new Map();
  spec.tiers.forEach((ids, t) => {
    tierMap.set(t, ids.map(id => ({ id, tier: t })));
    ids.forEach(id => nodes.set(id, { id, tier: t }));
  });
  const edges = spec.edges.map(([fromId, toId]) => ({ fromId, toId }));
  return { nodes, edges, tierMap, maxTier: spec.tiers.length - 1 };
}
const STEP = 110 + 16;

describe("assignCoordinates", () => {
  it("centers a parent over its two children", () => {
    const x = assignCoordinates(tree({ tiers: [["p"], ["a", "b"]], edges: [["p","a"],["p","b"]] }), {});
    expect(x.get("p")).toBeCloseTo((x.get("a") + x.get("b")) / 2, 5);
  });
  it("centers a child between its two parents", () => {
    const x = assignCoordinates(tree({ tiers: [["p","q"], ["c"]], edges: [["p","c"],["q","c"]] }), {});
    expect(x.get("c")).toBeCloseTo((x.get("p") + x.get("q")) / 2, 5);
  });
  it("keeps a single chain vertically aligned (same x)", () => {
    const x = assignCoordinates(tree({ tiers: [["a"], ["b"], ["c"]], edges: [["a","b"],["b","c"]] }), {});
    expect(x.get("a")).toBeCloseTo(x.get("b"), 5);
    expect(x.get("b")).toBeCloseTo(x.get("c"), 5);
  });
  it("never overlaps two nodes in the same tier (>= step apart)", () => {
    const x = assignCoordinates(tree({ tiers: [["p"], ["a","b","c"]], edges: [["p","a"],["p","b"],["p","c"]] }), {});
    const xs = ["a","b","c"].map(id => x.get(id)).sort((m,n) => m - n);
    expect(xs[1] - xs[0]).toBeGreaterThanOrEqual(STEP - 0.001);
    expect(xs[2] - xs[1]).toBeGreaterThanOrEqual(STEP - 0.001);
  });
  it("keeps same-tier peers in a tight band flanking the hub, not over their own subtrees", () => {
    // V (virtual hub) at tier 0 with a same-tier peer B. V centres over a wide
    // fan of children (c1..c3); B has its own child far to the right (bChild).
    // Without same-tier clustering B would drift right to centre over bChild;
    // it must instead stay one step from V (the Excellency-row band) so the
    // virtual→peer connector is a short straight horizontal line.
    const x = assignCoordinates(tree({
      tiers: [["V", "B"], ["c1", "c2", "c3", "bChild"]],
      edges: [["V", "c1"], ["V", "c2"], ["V", "c3"], ["V", "B"], ["B", "bChild"]],
    }), {});
    expect(x.get("B") - x.get("V")).toBeCloseTo(STEP, 5);   // peer hugs the hub
    expect(x.get("B")).toBeLessThan(x.get("bChild"));        // peer did NOT drift over its child
  });
  it("splits same-tier peers evenly on both sides of the hub", () => {
    // Hub V sorts LAST in tier order (as the virtual anyExcellency node does),
    // with four same-tier peers e0..e3. The band must place V in the centre with
    // two peers on each side — not all four stacked on one side.
    const x = assignCoordinates(tree({
      tiers: [["e0", "e1", "e2", "e3", "V"], ["c1", "c2"]],
      edges: [["V", "e0"], ["V", "e1"], ["V", "e2"], ["V", "e3"], ["V", "c1"], ["V", "c2"]],
    }), {});
    const vx = x.get("V");
    const peers = ["e0", "e1", "e2", "e3"];
    const left  = peers.filter(p => x.get(p) < vx).length;
    const right = peers.filter(p => x.get(p) > vx).length;
    expect(left).toBe(2);
    expect(right).toBe(2);
    expect(x.get("V")).toBeCloseTo((x.get("c1") + x.get("c2")) / 2, 5); // band centred over subtree
  });
  it("normalizes so the minimum x is 0", () => {
    const x = assignCoordinates(tree({ tiers: [["p"], ["a","b"]], edges: [["p","a"],["p","b"]] }), {});
    expect(Math.min(...x.values())).toBeCloseTo(0, 5);
  });
  it("is deterministic for identical input", () => {
    const t = tree({ tiers: [["p","q"], ["c"]], edges: [["p","c"],["q","c"]] });
    const a = assignCoordinates(t, {}); const b = assignCoordinates(t, {});
    for (const k of a.keys()) expect(a.get(k)).toBe(b.get(k));
  });
});
