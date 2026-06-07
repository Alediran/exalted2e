import { describe, it, expect } from "vitest";
import { isNewerVersion, selectPendingMigrations } from "../../module/migration/runner.mjs";

const M = [
  { version: "1.1.0" },
  { version: "1.2.0" },
  { version: "1.3.0" },
];

describe("isNewerVersion", () => {
  it("compares semver parts", () => {
    expect(isNewerVersion("1.2.0", "1.1.0")).toBe(true);
    expect(isNewerVersion("1.1.0", "1.1.0")).toBe(false);
    expect(isNewerVersion("1.1.0", "1.2.0")).toBe(false);
    expect(isNewerVersion("1.10.0", "1.9.0")).toBe(true);
  });
  it("treats missing/empty as 0", () => {
    expect(isNewerVersion("1.1.0", "")).toBe(true);
    expect(isNewerVersion("0.0.0", "")).toBe(false);
  });
});

describe("selectPendingMigrations", () => {
  it("empty stored runs all steps up to current, ascending", () => {
    expect(selectPendingMigrations("", "1.3.0", M).map(m => m.version)).toEqual(["1.1.0", "1.2.0", "1.3.0"]);
  });
  it("mid-list stored runs only newer steps", () => {
    expect(selectPendingMigrations("1.1.0", "1.3.0", M).map(m => m.version)).toEqual(["1.2.0", "1.3.0"]);
  });
  it("stored equal to current runs nothing", () => {
    expect(selectPendingMigrations("1.3.0", "1.3.0", M)).toEqual([]);
  });
  it("never runs steps newer than current", () => {
    expect(selectPendingMigrations("1.1.0", "1.2.0", M).map(m => m.version)).toEqual(["1.2.0"]);
  });
  it("returns steps sorted even if the registry is out of order", () => {
    const unsorted = [{ version: "1.3.0" }, { version: "1.1.0" }, { version: "1.2.0" }];
    expect(selectPendingMigrations("", "1.3.0", unsorted).map(m => m.version)).toEqual(["1.1.0", "1.2.0", "1.3.0"]);
  });
});
