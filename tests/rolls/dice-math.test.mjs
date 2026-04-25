import { describe, it, expect } from "vitest";
import { countSuccesses } from "../../module/rolls/dice-math.mjs";

describe("countSuccesses", () => {
  it("face 10 gives 2 successes and double-success class", () => {
    const r = countSuccesses([10]);
    expect(r.rawSuccesses).toBe(2);
    expect(r.ones).toBe(0);
    expect(r.details[0]).toEqual({ face: 10, succs: 2, cls: "double-success" });
  });

  it("faces 7, 8, 9 each give 1 success", () => {
    const r = countSuccesses([7, 8, 9]);
    expect(r.rawSuccesses).toBe(3);
    expect(r.details.map(d => d.cls)).toEqual(["success", "success", "success"]);
  });

  it("faces 2-6 miss (no successes, no ones)", () => {
    const r = countSuccesses([2, 3, 4, 5, 6]);
    expect(r.rawSuccesses).toBe(0);
    expect(r.ones).toBe(0);
    expect(r.details.every(d => d.cls === "miss" && d.succs === 0)).toBe(true);
  });

  it("face 1 contributes to ones but not successes", () => {
    const r = countSuccesses([1, 1, 1]);
    expect(r.rawSuccesses).toBe(0);
    expect(r.ones).toBe(3);
    expect(r.details.every(d => d.cls === "one" && d.succs === 0)).toBe(true);
  });

  it("mixed dice tally correctly (7+10+1+3 = 3 raw, 1 one)", () => {
    const r = countSuccesses([7, 10, 1, 3]);
    expect(r.rawSuccesses).toBe(3);
    expect(r.ones).toBe(1);
    expect(r.details.map(d => d.face)).toEqual([7, 10, 1, 3]);
  });

  it("empty dice array returns zeros", () => {
    const r = countSuccesses([]);
    expect(r.rawSuccesses).toBe(0);
    expect(r.ones).toBe(0);
    expect(r.details).toEqual([]);
  });

  it("accepts input dice as objects with .face (returns fresh details)", () => {
    const input = [
      { face: 10, succs: 99, cls: "stale" },
      { face: 3,  succs: 99, cls: "stale" }
    ];
    const r = countSuccesses(input);
    expect(r.rawSuccesses).toBe(2);
    expect(r.details).toEqual([
      { face: 10, succs: 2, cls: "double-success" },
      { face: 3,  succs: 0, cls: "miss" }
    ]);
    // Input was not mutated — countSuccesses returns a fresh details array.
    expect(input[0].cls).toBe("stale");
  });

  it("10s do not count toward ones tally", () => {
    const r = countSuccesses([10, 10, 10]);
    expect(r.rawSuccesses).toBe(6);
    expect(r.ones).toBe(0);
  });

  it("1s do not count toward successes tally", () => {
    const r = countSuccesses([1, 1]);
    expect(r.rawSuccesses).toBe(0);
    expect(r.details.every(d => d.succs === 0)).toBe(true);
  });

  it("tallies a full 1-10 spread correctly", () => {
    const r = countSuccesses([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.details.length).toBe(10);
    expect(r.rawSuccesses).toBe(5);  // 7+8+9 = 3 × 1, plus 10 = 2, total 5
    expect(r.ones).toBe(1);
  });
});
