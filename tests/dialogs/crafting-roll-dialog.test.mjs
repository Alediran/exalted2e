import { vi, describe, it, expect } from "vitest";
import { CraftingRollDialog } from "../../module/dialogs/crafting-roll-dialog.mjs";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeActor(overrides = {}) {
  return {
    system: {
      exaltType: overrides.exaltType ?? "solar",
      attributes: {
        dexterity:    { value: overrides.dexterity    ?? 3 },
        perception:   { value: overrides.perception   ?? 4 },
        intelligence: { value: overrides.intelligence ?? 3 },
      },
      abilities: {
        craft: { value: overrides.craft ?? 3, specialties: [] },
      },
    },
    items: overrides.items ?? [],
  };
}

function makeProject(overrides = {}) {
  return {
    targetResources: overrides.targetResources ?? 3,
    isPerfect:       overrides.isPerfect       ?? false,
    size:            overrides.size            ?? "small",
    ...overrides,
  };
}

function makeDialog(options = {}) {
  const actor   = options.actor   ?? makeActor();
  const project = options.project ?? makeProject();
  const resolve = vi.fn();
  const dialog  = new CraftingRollDialog({ actor, project, ...options }, resolve);
  return { dialog, resolve, actor, project };
}

// ── constructor ───────────────────────────────────────────────────────────────

describe("CraftingRollDialog constructor", () => {
  it("stores project", () => {
    const { dialog, project } = makeDialog();
    expect(dialog._project).toBe(project);
  });

  it("stores actor", () => {
    const { dialog, actor } = makeDialog();
    expect(dialog._actor).toBe(actor);
  });

  it("defaults _craftExcellencies to []", () => {
    const { dialog } = makeDialog();
    expect(dialog._craftExcellencies).toEqual([]);
  });

  it("defaults _resolved to false", () => {
    const { dialog } = makeDialog();
    expect(dialog._resolved).toBe(false);
  });

  it("defaults _rollResult to null", () => {
    const { dialog } = makeDialog();
    expect(dialog._rollResult).toBeNull();
  });

  it("defaults _secondExcSucc to 0", () => {
    const { dialog } = makeDialog();
    expect(dialog._secondExcSucc).toBe(0);
  });

  it("defaults _assistantBonus to 0", () => {
    const { dialog } = makeDialog();
    expect(dialog._assistantBonus).toBe(0);
  });

  it("defaults firstExcMax to 0 when not provided", () => {
    const { dialog } = makeDialog();
    expect(dialog.firstExcMax).toBe(0);
  });

  it("defaults secondExcMax to 0 when not provided", () => {
    const { dialog } = makeDialog();
    expect(dialog.secondExcMax).toBe(0);
  });

  it("accepts firstExcMax and secondExcMax from options", () => {
    const { dialog } = makeDialog({ firstExcMax: 6, secondExcMax: 3 });
    expect(dialog.firstExcMax).toBe(6);
    expect(dialog.secondExcMax).toBe(3);
  });
});

// ── _prepareContext (preroll) ─────────────────────────────────────────────────

describe("CraftingRollDialog._prepareContext preroll", () => {
  it("returns phase 'preroll' when _rollResult is null", async () => {
    const { dialog } = makeDialog();
    const ctx = await dialog._prepareContext({});
    expect(ctx.phase).toBe("preroll");
  });

  it("computes difficulty from craftingDifficulty (targetResources for non-perfect)", async () => {
    const { dialog } = makeDialog({ project: makeProject({ targetResources: 3, isPerfect: false }) });
    const ctx = await dialog._prepareContext({});
    expect(ctx.difficulty).toBe(3);
  });

  it("difficulty adds 5 for perfect projects", async () => {
    const { dialog } = makeDialog({ project: makeProject({ targetResources: 3, isPerfect: true }) });
    const ctx = await dialog._prepareContext({});
    expect(ctx.difficulty).toBe(8);
  });

  it("materialsResources is max(0, target-1) for non-perfect", async () => {
    const { dialog } = makeDialog({ project: makeProject({ targetResources: 3, isPerfect: false }) });
    const ctx = await dialog._prepareContext({});
    expect(ctx.materialsResources).toBe(2);
  });

  it("materialsResources is min(5, target+2) for perfect", async () => {
    const { dialog } = makeDialog({ project: makeProject({ targetResources: 3, isPerfect: true }) });
    const ctx = await dialog._prepareContext({});
    expect(ctx.materialsResources).toBe(5);
  });

  it("materialsResources never goes below 0", async () => {
    const { dialog } = makeDialog({ project: makeProject({ targetResources: 0, isPerfect: false }) });
    const ctx = await dialog._prepareContext({});
    expect(ctx.materialsResources).toBe(0);
  });

  it("capExceeded is false when craft >= targetResources", async () => {
    const actor = makeActor({ craft: 3 });
    const { dialog } = makeDialog({ actor, project: makeProject({ targetResources: 3 }) });
    const ctx = await dialog._prepareContext({});
    expect(ctx.capExceeded).toBe(false);
  });

  it("capExceeded is true when craft < targetResources", async () => {
    const actor = makeActor({ craft: 2 });
    const { dialog } = makeDialog({ actor, project: makeProject({ targetResources: 3 }) });
    const ctx = await dialog._prepareContext({});
    expect(ctx.capExceeded).toBe(true);
  });

  it("basePool for solar small = min(dex,per,int) + craft", async () => {
    const actor = makeActor({ dexterity: 3, perception: 4, intelligence: 3, craft: 3 });
    const { dialog } = makeDialog({ actor, project: makeProject({ size: "small" }) });
    const ctx = await dialog._prepareContext({});
    expect(ctx.basePool).toBe(6);
  });

  it("attrOptions is null for solar", async () => {
    const { dialog } = makeDialog({ actor: makeActor({ exaltType: "solar" }) });
    const ctx = await dialog._prepareContext({});
    expect(ctx.attrOptions).toBeNull();
  });

  it("attrOptions includes dexterity for lunar with size=small", async () => {
    const { dialog } = makeDialog({
      actor:   makeActor({ exaltType: "lunar" }),
      project: makeProject({ size: "small" }),
    });
    const ctx = await dialog._prepareContext({});
    expect(ctx.attrOptions).not.toBeNull();
    expect(ctx.attrOptions.some(o => o.value === "dexterity")).toBe(true);
  });

  it("attrOptions excludes dexterity for lunar with size=large", async () => {
    const { dialog } = makeDialog({
      actor:   makeActor({ exaltType: "lunar" }),
      project: makeProject({ size: "large" }),
    });
    const ctx = await dialog._prepareContext({});
    expect(ctx.attrOptions.some(o => o.value === "dexterity")).toBe(false);
    expect(ctx.attrOptions.some(o => o.value === "perception")).toBe(true);
  });

  it("sets firstExcMax to pool for ability-based exalt", async () => {
    const actor = makeActor({ exaltType: "solar", dexterity: 3, perception: 4, intelligence: 3, craft: 3 });
    const { dialog } = makeDialog({ actor, project: makeProject({ size: "small" }) });
    await dialog._prepareContext({});
    expect(dialog.firstExcMax).toBe(6);
  });

  it("sets secondExcMax to ceil(pool/2) for ability-based exalt", async () => {
    const actor = makeActor({ exaltType: "solar", dexterity: 3, perception: 4, intelligence: 3, craft: 3 });
    const { dialog } = makeDialog({ actor, project: makeProject({ size: "small" }) });
    await dialog._prepareContext({});
    expect(dialog.secondExcMax).toBe(3);
  });

  it("builds 5 workshopOptions", async () => {
    const { dialog } = makeDialog();
    const ctx = await dialog._prepareContext({});
    expect(ctx.workshopOptions).toHaveLength(5);
  });

  it("selects masters workshop by default when project.workshop is unset", async () => {
    const { dialog } = makeDialog();
    const ctx = await dialog._prepareContext({});
    const masters = ctx.workshopOptions.find(o => o.value === "masters");
    expect(masters.selected).toBe(true);
  });

  it("excellency flags false when no excellency charms provided", async () => {
    const { dialog } = makeDialog();
    const ctx = await dialog._prepareContext({});
    expect(ctx.excellency.first).toBe(false);
    expect(ctx.excellency.second).toBe(false);
    expect(ctx.excellency.third).toBe(false);
  });
});

// ── _prepareContext (result) ──────────────────────────────────────────────────

describe("CraftingRollDialog._prepareContext result", () => {
  function makeResultDialog(rollResult, projectOverrides = {}, actorOverrides = {}) {
    const actor   = makeActor(actorOverrides);
    const project = makeProject(projectOverrides);
    const resolve = vi.fn();
    const dialog  = new CraftingRollDialog({ actor, project }, resolve);
    dialog._rollResult = rollResult;
    return { dialog, resolve };
  }

  it("returns phase 'result' when _rollResult is set", async () => {
    const { dialog } = makeResultDialog({ successes: 5, botch: false });
    const ctx = await dialog._prepareContext({});
    expect(ctx.phase).toBe("result");
  });

  it("totals successes: rawSuccesses + _secondExcSucc + _assistantBonus", async () => {
    const { dialog } = makeResultDialog({ successes: 4, botch: false });
    dialog._secondExcSucc  = 2;
    dialog._assistantBonus = 1;
    const ctx = await dialog._prepareContext({});
    expect(ctx.successes).toBe(7);
  });

  it("computes threshold = max(0, successes - difficulty)", async () => {
    const { dialog } = makeResultDialog(
      { successes: 5, botch: false },
      { targetResources: 3 }
    );
    const ctx = await dialog._prepareContext({});
    expect(ctx.threshold).toBe(2);
  });

  it("threshold is 0 when successes are below difficulty", async () => {
    const { dialog } = makeResultDialog(
      { successes: 1, botch: false },
      { targetResources: 3 }
    );
    const ctx = await dialog._prepareContext({});
    expect(ctx.threshold).toBe(0);
  });

  it("outcome.tier is 'success' for threshold 0-2", async () => {
    const { dialog } = makeResultDialog(
      { successes: 5, botch: false },
      { targetResources: 3 }
    );
    const ctx = await dialog._prepareContext({});
    expect(ctx.outcome.tier).toBe("success");
  });

  it("outcome.tier is 'botched' when botch=true", async () => {
    const { dialog } = makeResultDialog({ successes: 0, botch: true });
    const ctx = await dialog._prepareContext({});
    expect(ctx.outcome.tier).toBe("botched");
  });

  it("tierLabel uses capitalized tier key", async () => {
    const { dialog } = makeResultDialog(
      { successes: 5, botch: false },
      { targetResources: 3 }
    );
    const ctx = await dialog._prepareContext({});
    expect(ctx.tierLabel).toBe("EX2E.CraftingTierSuccess");
  });

  it("includes difficulty in result context", async () => {
    const { dialog } = makeResultDialog(
      { successes: 5, botch: false },
      { targetResources: 4 }
    );
    const ctx = await dialog._prepareContext({});
    expect(ctx.difficulty).toBe(4);
  });
});

// ── _onClose ──────────────────────────────────────────────────────────────────

describe("CraftingRollDialog._onClose", () => {
  it("resolves false when not yet resolved", () => {
    const { dialog, resolve } = makeDialog();
    dialog._onClose({});
    expect(resolve).toHaveBeenCalledWith(false);
  });

  it("does not call resolve again when already resolved", () => {
    const { dialog, resolve } = makeDialog();
    dialog._resolved = true;
    dialog._onClose({});
    expect(resolve).not.toHaveBeenCalled();
  });
});

// ── static open ───────────────────────────────────────────────────────────────

describe("CraftingRollDialog.open", () => {
  it("returns a Promise", () => {
    const actor   = makeActor();
    const project = makeProject();
    const result  = CraftingRollDialog.open(project, actor);
    expect(result).toBeInstanceOf(Promise);
  });
});
