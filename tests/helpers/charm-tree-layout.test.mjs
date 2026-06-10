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
  it("splits isolated standalone nodes evenly on both sides of the anchored content", () => {
    // V is anchored (centred over its children c1/c2). s1..s4 are isolated
    // standalone nodes with no edges — they must split two-per-side around the
    // anchored band, not clump at one end from their seed order.
    // V sorts FIRST, so all standalones seed to its right — they must still end
    // up two-per-side, proving the split (not the seed order) does the balancing.
    const x = assignCoordinates(tree({
      tiers: [["V", "s1", "s2", "s3", "s4"], ["c1", "c2"]],
      edges: [["V", "c1"], ["V", "c2"]],
    }), {});
    const vx = x.get("V");
    const standalones = ["s1", "s2", "s3", "s4"];
    const left  = standalones.filter(s => x.get(s) < vx).length;
    const right = standalones.filter(s => x.get(s) > vx).length;
    expect(left).toBe(2);
    expect(right).toBe(2);
  });
  it("keeps anchored nodes centred over their child regardless of standalone count", () => {
    // e1/e2/e3 (Excellencies) all feed the virtual node V; V centres over its
    // children. A standalone `s` shares the row but must NOT drag the
    // Excellencies off-centre — they stay centred over V like the no-standalone
    // case (image 2), the standalone just flanks the row.
    const x = assignCoordinates(tree({
      tiers: [["e1", "e2", "e3", "s"], ["V"], ["c1", "c2"]],
      edges: [["e1", "V"], ["e2", "V"], ["e3", "V"], ["V", "c1"], ["V", "c2"]],
    }), {});
    expect(x.get("e2")).toBeCloseTo(x.get("V"), 5);                       // middle Excellency over V
    expect((x.get("e1") + x.get("e3")) / 2).toBeCloseTo(x.get("V"), 5);   // Excellencies symmetric about V
  });
  it("renders a childless leaf to the side so a through-node keeps the central slot", () => {
    // Mid-tier T and P are through-nodes (parent + children); D is a childless
    // leaf sharing parent S with P. D should yield to the side (right, toward S)
    // so P sits over its own parent/children instead of being shoved out by D.
    const x = assignCoordinates(tree({
      tiers: [["L", "S"], ["T", "D", "P"], ["U", "E"]],
      edges: [["L", "T"], ["S", "D"], ["S", "P"], ["T", "U"], ["P", "U"], ["P", "E"]],
    }), {});
    expect(x.get("D")).toBeGreaterThan(x.get("P"));   // leaf moved aside (right)
    expect(x.get("D")).toBeGreaterThan(x.get("T"));   // leaf is outermost on its side
    expect(x.get("P")).toBeLessThan(x.get("D"));      // through-node kept the inner slot
  });
  it("reorders a tier to remove an avoidable parent/child edge crossing", () => {
    // Seed order [L,F,S] over [G,T,...]: L→T and F→G cross (L is left of F but
    // its child T is right of F's child G). Crossing reduction should reorder
    // the parent tier (swap L and F) so the edges no longer cross.
    const x = assignCoordinates(tree({
      tiers: [["L", "F", "S"], ["G", "T", "P", "D"], ["c"]],
      edges: [["L", "T"], ["F", "G"], ["S", "T"], ["S", "P"], ["S", "D"], ["T", "c"]],
    }), {});
    // No crossing ⇔ L vs F sit on the same side as their children T vs G.
    expect(Math.sign(x.get("L") - x.get("F"))).toBe(Math.sign(x.get("T") - x.get("G")));
  });
  it("places two virtual hubs together in the centre with semi-excellencies outside", () => {
    // Two virtual anyExcellency nodes (V1/V2) share a tier with four quasi peers
    // via same-tier edges, and each anchors its own subtree. The virtuals should
    // end up adjacent in the centre, the quasi split evenly outside them.
    const tier0 = [
      { id: "q0", tier: 0 }, { id: "q1", tier: 0 },
      { id: "V1", tier: 0, isVirtual: true }, { id: "V2", tier: 0, isVirtual: true },
      { id: "q2", tier: 0 }, { id: "q3", tier: 0 },
    ];
    // V1's children sit on the left, V2's on the right, so without core-grouping
    // the two virtuals would drift far apart (V2 floating between the quasi).
    const tier1 = [{ id: "a1", tier: 1 }, { id: "a2", tier: 1 }, { id: "d1", tier: 1 }, { id: "d2", tier: 1 }];
    const tierMap = new Map([[0, tier0], [1, tier1]]);
    const nodes = new Map([...tier0, ...tier1].map(n => [n.id, n]));
    // All quasi belong to V1 (same-tier). V2 has NO same-tier peers — only
    // cross-tier children — exactly like "(Any Two Lore Excellencies)".
    const edges = [
      { fromId: "V1", toId: "q0" }, { fromId: "V1", toId: "q1" },   // same-tier
      { fromId: "V1", toId: "q2" }, { fromId: "V1", toId: "q3" },   // same-tier
      { fromId: "V1", toId: "a1" }, { fromId: "V1", toId: "a2" },   // V1 children (left)
      { fromId: "V2", toId: "d1" }, { fromId: "V2", toId: "d2" },   // V2 children (right)
    ];
    const x = assignCoordinates({ nodes, edges, tierMap, maxTier: 1 }, {});
    expect(Math.abs(x.get("V1") - x.get("V2"))).toBeCloseTo(STEP, 5); // virtuals adjacent
    const lo = Math.min(x.get("V1"), x.get("V2"));
    const hi = Math.max(x.get("V1"), x.get("V2"));
    expect(["q0", "q1", "q2", "q3"].filter(q => x.get(q) < lo).length).toBe(2);
    expect(["q0", "q1", "q2", "q3"].filter(q => x.get(q) > hi).length).toBe(2);
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
