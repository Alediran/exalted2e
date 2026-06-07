import { describe, it, expect } from "vitest";
import { spellInitiationStatus } from "../../module/helpers/spell-helpers.mjs";

const spell = (id, tradition, circle) => ({ id, system: { tradition, circle } });

describe("spellInitiationStatus", () => {
  it("ok when the tradition's initiation >= circle", () => {
    const out = spellInitiationStatus([spell("s", "sorcery", 2)], { sorcery: { initiation: 2 } });
    expect(out.s).toEqual({ ok: true, required: 2, current: 2 });
  });
  it("not ok when initiation < circle", () => {
    const out = spellInitiationStatus([spell("s", "necromancy", 3)], { necromancy: { initiation: 1 } });
    expect(out.s).toEqual({ ok: false, required: 3, current: 1 });
  });
  it("weaving uses the weaving track; circle floors at 1", () => {
    const out = spellInitiationStatus([spell("s", "weaving", 0)], { weaving: { initiation: 1 } });
    expect(out.s).toEqual({ ok: true, required: 1, current: 1 });
  });
  it("unknown tradition falls back to the sorcery track", () => {
    const out = spellInitiationStatus([spell("s", "", 1)], { sorcery: { initiation: 1 } });
    expect(out.s.ok).toBe(true);
  });
});
