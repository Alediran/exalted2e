import { describe, it, expect } from "vitest";
import { manseSoakRef } from "../../module/helpers/manse-geomancy.mjs";

describe("manseSoakRef", () => {
  it("maps fragility 0..3 to the soak reference string", () => {
    expect(manseSoakRef(0)).toBe("12L/18B");
    expect(manseSoakRef(1)).toBe("6L/9B");
    expect(manseSoakRef(2)).toBe("—");
    expect(manseSoakRef(3)).toBe("—");
  });
  it("clamps out-of-range fragility into 0..3", () => {
    expect(manseSoakRef(-1)).toBe("12L/18B");
    expect(manseSoakRef(9)).toBe("—");
    expect(manseSoakRef(undefined)).toBe("12L/18B");
  });
});
