import { describe, it, expect } from "vitest";
import { evaluateCoverageGate } from "../../tools/ci/coverage-gate.mjs";

describe("evaluateCoverageGate", () => {
  it("off when floor is unset / empty / non-numeric (exit 0)", () => {
    for (const floor of [undefined, null, "", "abc"]) {
      const r = evaluateCoverageGate({ floor, linesPct: 10, complete: true });
      expect(r.status).toBe("off");
      expect(r.exitCode).toBe(0);
    }
  });
  it("skip when inputs incomplete — even below floor (exit 0)", () => {
    const r = evaluateCoverageGate({ floor: "66", linesPct: 10, complete: false });
    expect(r.status).toBe("skip");
    expect(r.exitCode).toBe(0);
  });
  it("fail when complete and lines below floor (exit 1)", () => {
    const r = evaluateCoverageGate({ floor: "66", linesPct: 65.9, complete: true });
    expect(r.status).toBe("fail");
    expect(r.exitCode).toBe(1);
    expect(r.message).toMatch(/65\.9.*66/);
  });
  it("pass when complete and lines at or above floor (exit 0)", () => {
    expect(evaluateCoverageGate({ floor: "66", linesPct: 66, complete: true }).status).toBe("pass");
    expect(evaluateCoverageGate({ floor: "66", linesPct: 80, complete: true }).exitCode).toBe(0);
  });
});
