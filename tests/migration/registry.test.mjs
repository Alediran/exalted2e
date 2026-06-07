import { describe, it, expect } from "vitest";
import { MIGRATIONS } from "../../module/migration/migrations.mjs";

describe("MIGRATIONS baseline step", () => {
  const baseline = MIGRATIONS[0];
  const seq = () => { let n = 0; return () => `id${++n}`; };

  it("first step is version 1.1.0", () => {
    expect(baseline.version).toBe("1.1.0");
  });
  it("actor() signals createUnarmed for a character missing the weapon", () => {
    expect(baseline.actor({ type: "character", items: [] })).toEqual({ createUnarmed: true });
  });
  it("actor() returns null when the unarmed weapon is present", () => {
    expect(baseline.actor({ type: "character", items: [{ type: "weapon", flags: { exalted2e: { unarmed: true } } }] })).toBeNull();
  });
  it("item() assigns a charmUid to a charm missing one", () => {
    expect(baseline.item({ type: "charm", system: {} }, seq())).toEqual({ "system.charmUid": "id1" });
  });
  it("item() assigns a spellUid to a spell missing one", () => {
    expect(baseline.item({ type: "spell", system: {} }, seq())).toEqual({ "system.spellUid": "id1" });
  });
  it("item() returns null for an item that needs nothing", () => {
    expect(baseline.item({ type: "weapon", system: {} }, seq())).toBeNull();
  });
});
