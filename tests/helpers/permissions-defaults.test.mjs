import { describe, it, expect } from "vitest";
import {
  PERMISSION_DEFAULTS,
  resolvePermissions
} from "../../module/helpers/permissions-defaults.mjs";

describe("resolvePermissions", () => {
  it("returns a deep clone of defaults when overrides is null", () => {
    const result = resolvePermissions(null);
    expect(result).toEqual({ ...PERMISSION_DEFAULTS });
    // Mutating the result must not bleed back into the frozen defaults.
    result.combatFlow = 0;
    expect(PERMISSION_DEFAULTS.combatFlow).not.toBe(0);
  });

  it("returns defaults for undefined / non-object overrides", () => {
    expect(resolvePermissions(undefined)).toEqual({ ...PERMISSION_DEFAULTS });
    expect(resolvePermissions("not-an-object")).toEqual({ ...PERMISSION_DEFAULTS });
    expect(resolvePermissions(42)).toEqual({ ...PERMISSION_DEFAULTS });
  });

  it("returns defaults when overrides is an empty object", () => {
    expect(resolvePermissions({})).toEqual({ ...PERMISSION_DEFAULTS });
  });

  it("applies a partial valid numeric override and leaves others as defaults", () => {
    const result = resolvePermissions({ combatFlow: 2 });
    expect(result.combatFlow).toBe(2);
    expect(result.purchaseMode).toBe(PERMISSION_DEFAULTS.purchaseMode);
    expect(result.protectedEffects).toBe(PERMISSION_DEFAULTS.protectedEffects);
  });

  it("falls back to defaults for non-finite, null, undefined, and empty-string values", () => {
    const cases = [
      { combatFlow: null },
      { combatFlow: undefined },
      { combatFlow: "" },
      { combatFlow: "abc" },
      { combatFlow: NaN }
    ];
    for (const c of cases) {
      const result = resolvePermissions(c);
      expect(result.combatFlow).toBe(PERMISSION_DEFAULTS.combatFlow);
    }
  });
});
