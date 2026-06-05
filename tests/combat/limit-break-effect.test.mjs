import { describe, it, expect } from "vitest";
import { buildLimitBreakEffectData } from "../../module/combat/limit-break-effect.mjs";

function flaw({ id = "flaw1", baseVirtue = "compassion", img, changes = [] } = {}) {
  return { id, img, system: { baseVirtue, changes } };
}

describe("buildLimitBreakEffectData", () => {
  it("maps changes rows to AE changes, dropping keyless rows", () => {
    const f = flaw({ changes: [
      { key: "system.dv.dodge", mode: 2, value: "-2" },
      { key: "",               mode: 2, value: "5" },   // dropped (no key)
    ] });
    const ae = buildLimitBreakEffectData(f, "Compassion — Limit Break");
    expect(ae.changes).toEqual([{ key: "system.dv.dodge", mode: 2, value: "-2" }]);
  });

  it("sets the AE name from the passed label and uses the flaw image", () => {
    const ae = buildLimitBreakEffectData(flaw({ img: "icons/terror.webp" }), "Valor — Limit Break");
    expect(ae.name).toBe("Valor — Limit Break");
    expect(ae.img).toBe("icons/terror.webp");
  });

  it("falls back to a default image when the flaw has none", () => {
    const ae = buildLimitBreakEffectData(flaw({ img: undefined }), "X");
    expect(ae.img).toBe("icons/svg/terror.svg");
  });

  it("carries the limitBreakEffect flag, oneScene duration, and gmOnlyRemoval", () => {
    const ae = buildLimitBreakEffectData(flaw({ id: "fX", baseVirtue: "valor" }), "X");
    expect(ae.transfer).toBe(false);
    expect(ae.flags.exalted2e.limitBreakEffect).toEqual({ virtueFlawId: "fX", baseVirtue: "valor" });
    expect(ae.flags.exalted2e.charmDuration).toBe("oneScene");
    expect(ae.flags.exalted2e.gmOnlyRemoval).toBe(true);
  });

  it("produces an empty changes array for a marker-only flaw", () => {
    const ae = buildLimitBreakEffectData(flaw({ changes: [] }), "X");
    expect(ae.changes).toEqual([]);
  });
});
