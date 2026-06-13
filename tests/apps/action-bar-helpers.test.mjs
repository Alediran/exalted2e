import { describe, it, expect } from "vitest";
import {
  buildPinnableRows,
  orderActionRows,
} from "../../module/apps/_action-bar-helpers.mjs";

// ── buildPinnableRows ─────────────────────────────────────────────────────────

describe("buildPinnableRows", () => {
  it("always includes cast as the first row", () => {
    const rows = buildPinnableRows({});
    expect(rows[0].key).toBe("cast");
  });

  it("cast row has correct labelKey and icon", () => {
    const rows = buildPinnableRows({});
    expect(rows[0].labelKey).toBe("EX2E.ActionCast");
    expect(rows[0].icon).toBe("fa-solid fa-hat-wizard");
  });

  it("excludes clinchOnly actions", () => {
    const actions = {
      guard:      { labelKey: "EX2E.ActionGuard",  icon: "fa-solid fa-shield", clinchOnly: false },
      clinchHold: { labelKey: "EX2E.ClinchHold",   icon: "fa-solid fa-hand",   clinchOnly: true  },
    };
    const rows = buildPinnableRows(actions);
    expect(rows.map(r => r.key)).not.toContain("clinchHold");
    expect(rows.map(r => r.key)).toContain("guard");
  });

  it("uses fallback icon fa-solid fa-circle when action has none", () => {
    const actions = { guard: { labelKey: "EX2E.ActionGuard" } };
    const rows = buildPinnableRows(actions);
    expect(rows.find(r => r.key === "guard").icon).toBe("fa-solid fa-circle");
  });

  it("uses the action icon when one is provided", () => {
    const actions = { guard: { labelKey: "EX2E.ActionGuard", icon: "fa-solid fa-shield" } };
    const rows = buildPinnableRows(actions);
    expect(rows.find(r => r.key === "guard").icon).toBe("fa-solid fa-shield");
  });

  it("preserves labelKey for each non-clinch action", () => {
    const actions = { guard: { labelKey: "EX2E.ActionGuard", icon: "fa-solid fa-shield" } };
    const rows = buildPinnableRows(actions);
    expect(rows.find(r => r.key === "guard").labelKey).toBe("EX2E.ActionGuard");
  });

  it("returns only the cast row when all actions are clinchOnly", () => {
    const actions = {
      clinchHold:  { labelKey: "EX2E.ClinchHold",  clinchOnly: true },
      clinchCrush: { labelKey: "EX2E.ClinchCrush", clinchOnly: true },
    };
    expect(buildPinnableRows(actions)).toHaveLength(1);
  });

  it("returns empty config → only cast row", () => {
    expect(buildPinnableRows({})).toHaveLength(1);
  });

  it("includes multiple non-clinch actions in iteration order", () => {
    const actions = {
      guard: { labelKey: "EX2E.ActionGuard" },
      dash:  { labelKey: "EX2E.ActionDash"  },
    };
    const rows = buildPinnableRows(actions);
    expect(rows.map(r => r.key)).toEqual(["cast", "guard", "dash"]);
  });
});

// ── orderActionRows ────────────────────────────────────────────────────────────

describe("orderActionRows", () => {
  const allRows = [
    { key: "cast",  labelKey: "EX2E.ActionCast",  icon: "fa-solid fa-hat-wizard" },
    { key: "guard", labelKey: "EX2E.ActionGuard",  icon: "fa-solid fa-shield" },
    { key: "dash",  labelKey: "EX2E.ActionDash",   icon: "fa-solid fa-person-running" },
  ];

  it("marks pinned rows as checked: true", () => {
    const rows = orderActionRows(["guard"], allRows);
    expect(rows.find(r => r.key === "guard").checked).toBe(true);
  });

  it("marks unpinned rows as checked: false", () => {
    const rows = orderActionRows(["guard"], allRows);
    expect(rows.find(r => r.key === "dash").checked).toBe(false);
  });

  it("pinned rows appear before unpinned rows", () => {
    const rows = orderActionRows(["dash"], allRows);
    expect(rows.findIndex(r => r.key === "dash")).toBeLessThan(
      rows.findIndex(r => r.key === "cast")
    );
  });

  it("pinned rows appear in their saved order (not default order)", () => {
    const rows = orderActionRows(["dash", "guard"], allRows);
    expect(rows.findIndex(r => r.key === "dash")).toBeLessThan(
      rows.findIndex(r => r.key === "guard")
    );
  });

  it("unpinned rows follow the default pinnableRows order", () => {
    const rows = orderActionRows(["dash"], allRows);
    // cast comes before guard in allRows, so cast should appear before guard in unpinned tail
    expect(rows.findIndex(r => r.key === "cast")).toBeLessThan(
      rows.findIndex(r => r.key === "guard")
    );
  });

  it("ignores unknown keys in the pinned array", () => {
    const rows = orderActionRows(["unknown"], allRows);
    expect(rows).toHaveLength(3);
    expect(rows.every(r => !r.checked)).toBe(true);
  });

  it("empty pinned array → all rows unchecked in default order", () => {
    const rows = orderActionRows([], allRows);
    expect(rows.every(r => !r.checked)).toBe(true);
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.key)).toEqual(["cast", "guard", "dash"]);
  });

  it("all pinned → all rows checked", () => {
    const rows = orderActionRows(["cast", "guard", "dash"], allRows);
    expect(rows.every(r => r.checked)).toBe(true);
    expect(rows).toHaveLength(3);
  });

  it("total row count equals pinnableRows length regardless of pin state", () => {
    const rows = orderActionRows(["guard"], allRows);
    expect(rows).toHaveLength(3);
  });

  it("does not mutate the original pinnableRows entries", () => {
    const snapshot = allRows.map(r => ({ ...r }));
    orderActionRows(["guard"], allRows);
    expect(allRows).toEqual(snapshot);
  });
});
