import { vi, describe, it, expect, beforeEach } from "vitest";
import { registerHandlebars } from "../../module/setup/register-handlebars.mjs";

describe("registerHandlebars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Handlebars.helpers = {};
  });

  // ── Template pre-loading ──────────────────────────────────────────────────

  it("calls loadTemplates exactly once", () => {
    registerHandlebars();
    expect(foundry.applications.handlebars.loadTemplates).toHaveBeenCalledTimes(1);
  });

  it("passes an array of template paths to loadTemplates", () => {
    registerHandlebars();
    const [paths] = foundry.applications.handlebars.loadTemplates.mock.calls[0];
    expect(Array.isArray(paths)).toBe(true);
    expect(paths.length).toBeGreaterThan(0);
  });

  it("includes actor character tab templates", () => {
    registerHandlebars();
    const [paths] = foundry.applications.handlebars.loadTemplates.mock.calls[0];
    expect(paths).toContain("systems/exalted2e/templates/actor/character/header.hbs");
    expect(paths).toContain("systems/exalted2e/templates/actor/character/tab-combat.hbs");
    expect(paths).toContain("systems/exalted2e/templates/actor/character/tab-charms.hbs");
  });

  it("includes item charm and weapon templates", () => {
    registerHandlebars();
    const [paths] = foundry.applications.handlebars.loadTemplates.mock.calls[0];
    expect(paths).toContain("systems/exalted2e/templates/item/charm/header.hbs");
    expect(paths).toContain("systems/exalted2e/templates/item/weapon/header.hbs");
  });

  it("includes chat and dialog templates", () => {
    registerHandlebars();
    const [paths] = foundry.applications.handlebars.loadTemplates.mock.calls[0];
    expect(paths).toContain("systems/exalted2e/templates/chat/roll-result.hbs");
    expect(paths).toContain("systems/exalted2e/templates/dialog/attack-dialog.hbs");
  });

  it("includes NPC and unit actor templates", () => {
    registerHandlebars();
    const [paths] = foundry.applications.handlebars.loadTemplates.mock.calls[0];
    expect(paths).toContain("systems/exalted2e/templates/actor/npc/header.hbs");
    expect(paths).toContain("systems/exalted2e/templates/actor/unit/unit-sheet.hbs");
  });

  // ── Handlebars helper registration ────────────────────────────────────────

  it("registers Handlebars helpers", () => {
    registerHandlebars();
    expect(Handlebars.registerHelper).toHaveBeenCalled();
  });

  it("registers the dotRating helper", () => {
    registerHandlebars();
    const names = Handlebars.registerHelper.mock.calls.map(([name]) => name);
    expect(names).toContain("dotRating");
  });

  it("registers arithmetic helpers (add, sub, mul)", () => {
    registerHandlebars();
    const names = Handlebars.registerHelper.mock.calls.map(([name]) => name);
    expect(names).toContain("add");
    expect(names).toContain("sub");
    expect(names).toContain("mul");
  });

  it("registers comparison helpers (gt, gte, lt, lte, eq, neq)", () => {
    registerHandlebars();
    const names = Handlebars.registerHelper.mock.calls.map(([name]) => name);
    for (const h of ["gt", "gte", "lt", "lte", "eq", "neq"]) {
      expect(names, `missing helper: ${h}`).toContain(h);
    }
  });

  it("registers the motePool helper", () => {
    registerHandlebars();
    const names = Handlebars.registerHelper.mock.calls.map(([name]) => name);
    expect(names).toContain("motePool");
  });

  it("registers the healthTrack helper", () => {
    registerHandlebars();
    const names = Handlebars.registerHelper.mock.calls.map(([name]) => name);
    expect(names).toContain("healthTrack");
  });

  it("only registers capitalize if not already present in Handlebars.helpers", () => {
    Handlebars.helpers.capitalize = () => {};
    registerHandlebars();
    const capitalizeCalls = Handlebars.registerHelper.mock.calls.filter(([n]) => n === "capitalize");
    expect(capitalizeCalls).toHaveLength(0);
  });

  it("registers capitalize when it is not already in Handlebars.helpers", () => {
    delete Handlebars.helpers.capitalize;
    registerHandlebars();
    const capitalizeCalls = Handlebars.registerHelper.mock.calls.filter(([n]) => n === "capitalize");
    expect(capitalizeCalls).toHaveLength(1);
  });
});
