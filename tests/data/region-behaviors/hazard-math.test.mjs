import { describe, it, expect } from "vitest";
import { hazardAction, hazardPoolSize } from "../../../module/data/region-behaviors/hazard-math.mjs";

describe("hazardAction", () => {
  it("immune wins even for a player-owned actor with difficulty", () => {
    expect(hazardAction({ immune: true, hasPlayerOwner: true, resistDifficulty: 3 })).toBe("immune");
  });
  it("player-owned + difficulty>0 → resist", () => {
    expect(hazardAction({ immune: false, hasPlayerOwner: true, resistDifficulty: 3 })).toBe("resist");
  });
  it("player-owned but difficulty 0 → apply", () => {
    expect(hazardAction({ immune: false, hasPlayerOwner: true, resistDifficulty: 0 })).toBe("apply");
  });
  it("non-player-owned (NPC) → apply regardless of difficulty", () => {
    expect(hazardAction({ immune: false, hasPlayerOwner: false, resistDifficulty: 5 })).toBe("apply");
  });
});

describe("hazardPoolSize", () => {
  it("returns the evaluated pool when positive", () => {
    expect(hazardPoolSize("7", {}, () => 7)).toBe(7);
  });
  it("floors at 1 when the formula evaluates to 0 or negative", () => {
    expect(hazardPoolSize("0", {}, () => 0)).toBe(1);
    expect(hazardPoolSize("x", {}, () => -3)).toBe(1);
  });
  it("passes damagePool, rollData, and fallback 5 to the evaluator", () => {
    const seen = [];
    hazardPoolSize("@str", { str: 4 }, (f, rd, fb) => { seen.push([f, rd, fb]); return 4; });
    expect(seen[0]).toEqual(["@str", { str: 4 }, 5]);
  });
});
