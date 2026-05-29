import { describe, it, expect } from "vitest";
import {
  clinchOutcome,
  clinchDamageDice,
  clinchFreezeInitiative,
} from "../../module/rolls/clinch-math.mjs";

describe("clinchOutcome", () => {
  it("attacker wins on equal successes", () => {
    const r = clinchOutcome(3, 3);
    expect(r.attackerWins).toBe(true);
    expect(r.controlMargin).toBe(0);
  });

  it("attacker wins with more successes", () => {
    const r = clinchOutcome(5, 2);
    expect(r.attackerWins).toBe(true);
    expect(r.controlMargin).toBe(3);
  });

  it("defender wins when they have more successes", () => {
    const r = clinchOutcome(2, 4);
    expect(r.attackerWins).toBe(false);
    expect(r.controlMargin).toBe(0);
  });

  it("both at 0 successes — attacker wins on tie", () => {
    const r = clinchOutcome(0, 0);
    expect(r.attackerWins).toBe(true);
    expect(r.controlMargin).toBe(0);
  });
});

describe("clinchDamageDice", () => {
  it("Str 3 → 5 damage dice", () => {
    expect(clinchDamageDice(3)).toBe(5);
  });

  it("Str 1 → 3 damage dice", () => {
    expect(clinchDamageDice(1)).toBe(3);
  });

  it("null strength → 2 damage dice (minimum)", () => {
    expect(clinchDamageDice(null)).toBe(2);
  });
});

describe("clinchFreezeInitiative", () => {
  it("pushes held to controller initiative + speed 3", () => {
    expect(clinchFreezeInitiative(5, 3)).toBe(8);
  });

  it("defaults to speed 3 when not provided", () => {
    expect(clinchFreezeInitiative(10)).toBe(13);
  });

  it("null controller initiative treated as 0", () => {
    expect(clinchFreezeInitiative(null, 3)).toBe(3);
  });
});
