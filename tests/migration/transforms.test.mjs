import { describe, it, expect } from "vitest";
import { actorNeedsUnarmed, assignCharmUid, assignSpellUid } from "../../module/migration/transforms.mjs";

const seq = () => { let n = 0; return () => `id${++n}`; };

describe("actorNeedsUnarmed", () => {
  it("true for a character with no unarmed weapon", () => {
    expect(actorNeedsUnarmed({ type: "character", items: [{ type: "weapon", flags: {} }] })).toBe(true);
  });
  it("false when an unarmed weapon is present", () => {
    expect(actorNeedsUnarmed({ type: "character", items: [{ type: "weapon", flags: { exalted2e: { unarmed: true } } }] })).toBe(false);
  });
  it("false for non-character actors", () => {
    expect(actorNeedsUnarmed({ type: "npc", items: [] })).toBe(false);
  });
  it("true for a character with no items array", () => {
    expect(actorNeedsUnarmed({ type: "character" })).toBe(true);
  });
});

describe("assignCharmUid", () => {
  it("assigns a uid to a charm missing one", () => {
    expect(assignCharmUid({ type: "charm", system: {} }, seq())).toEqual({ "system.charmUid": "id1" });
  });
  it("null when charmUid already set", () => {
    expect(assignCharmUid({ type: "charm", system: { charmUid: "x" } }, seq())).toBeNull();
  });
  it("null for non-charm items", () => {
    expect(assignCharmUid({ type: "spell", system: {} }, seq())).toBeNull();
  });
});

describe("assignSpellUid", () => {
  it("assigns a uid to a spell missing one", () => {
    expect(assignSpellUid({ type: "spell", system: {} }, seq())).toEqual({ "system.spellUid": "id1" });
  });
  it("null when spellUid already set", () => {
    expect(assignSpellUid({ type: "spell", system: { spellUid: "x" } }, seq())).toBeNull();
  });
  it("null for non-spell items", () => {
    expect(assignSpellUid({ type: "charm", system: {} }, seq())).toBeNull();
  });
});
