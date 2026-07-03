import { vi, describe, it, expect } from "vitest";
import { ArtifactCraftingDialog } from "../../module/dialogs/artifact-crafting-dialog.mjs";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeActor(overrides = {}) {
  return {
    system: {
      exaltType: overrides.exaltType ?? "solar",
      attributes: {
        dexterity:    { value: overrides.dexterity    ?? 3 },
        perception:   { value: overrides.perception   ?? 4 },
        intelligence: { value: overrides.intelligence ?? 4 },
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
    targetSuccesses:  overrides.targetSuccesses  ?? 20,
    currentSuccesses: overrides.currentSuccesses ?? 5,
    rating:           overrides.rating           ?? 3,
    ...overrides,
  };
}

function makeDialog(options = {}) {
  const actor   = options.actor   ?? makeActor();
  const project = options.project ?? makeProject();
  const resolve = vi.fn();
  const dialog  = new ArtifactCraftingDialog({ actor, project, ...options }, resolve);
  return { dialog, resolve, actor, project };
}

// ── constructor ───────────────────────────────────────────────────────────────

describe("ArtifactCraftingDialog constructor", () => {
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

  it("accepts craftExcellencies override", () => {
    const exc = [{ system: { excellency: "first" } }];
    const { dialog } = makeDialog({ craftExcellencies: exc });
    expect(dialog._craftExcellencies).toBe(exc);
  });

  it("defaults _craftCharms to []", () => {
    const { dialog } = makeDialog();
    expect(dialog._craftCharms).toEqual([]);
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

  it("defaults _firstExcMax to 0", () => {
    const { dialog } = makeDialog();
    expect(dialog._firstExcMax).toBe(0);
  });

  it("defaults _secondExcMax to 0", () => {
    const { dialog } = makeDialog();
    expect(dialog._secondExcMax).toBe(0);
  });

  it("defaults _attribute to 'dexterity'", () => {
    const { dialog } = makeDialog();
    expect(dialog._attribute).toBe("dexterity");
  });
});

// ── _prepareContext (preroll) ─────────────────────────────────────────────────

describe("ArtifactCraftingDialog._prepareContext preroll", () => {
  it("returns phase 'preroll' when _rollResult is null", async () => {
    const { dialog } = makeDialog();
    const ctx = await dialog._prepareContext({});
    expect(ctx.phase).toBe("preroll");
  });

  it("computes progressPct from currentSuccesses / targetSuccesses", async () => {
    const { dialog } = makeDialog({
      project: makeProject({ targetSuccesses: 20, currentSuccesses: 5 }),
    });
    const ctx = await dialog._prepareContext({});
    expect(ctx.progressPct).toBe(25);
  });

  it("caps progressPct at 100", async () => {
    const { dialog } = makeDialog({
      project: makeProject({ targetSuccesses: 10, currentSuccesses: 50 }),
    });
    const ctx = await dialog._prepareContext({});
    expect(ctx.progressPct).toBe(100);
  });

  it("exposes target and current", async () => {
    const { dialog } = makeDialog({
      project: makeProject({ targetSuccesses: 20, currentSuccesses: 5 }),
    });
    const ctx = await dialog._prepareContext({});
    expect(ctx.target).toBe(20);
    expect(ctx.current).toBe(5);
  });

  it("sets basePool from artifactPool (attr + craft)", async () => {
    const actor = makeActor({ dexterity: 3, craft: 3 });
    const { dialog } = makeDialog({ actor });
    const ctx = await dialog._prepareContext({});
    expect(ctx.basePool).toBe(6);
  });

  it("sets difficulty from project.rating", async () => {
    const { dialog } = makeDialog({ project: makeProject({ rating: 4 }) });
    const ctx = await dialog._prepareContext({});
    expect(ctx.difficulty).toBe(4);
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

  it("sets _firstExcMax to pool for ability-based exalt", async () => {
    const actor = makeActor({ exaltType: "solar", dexterity: 3, craft: 3 });
    const { dialog } = makeDialog({ actor });
    await dialog._prepareContext({});
    expect(dialog._firstExcMax).toBe(6);
  });

  it("sets _secondExcMax to ceil(pool/2) for ability-based exalt", async () => {
    const actor = makeActor({ exaltType: "solar", dexterity: 3, craft: 3 });
    const { dialog } = makeDialog({ actor });
    await dialog._prepareContext({});
    expect(dialog._secondExcMax).toBe(3);
  });

  it("uses attrVal only (not pool) for _firstExcMax when lunar", async () => {
    const actor = makeActor({ exaltType: "lunar", dexterity: 3, craft: 5 });
    const { dialog } = makeDialog({ actor });
    await dialog._prepareContext({});
    expect(dialog._firstExcMax).toBe(3);
  });

  it("excellency labels fall back to i18n keys when no charm found", async () => {
    const { dialog } = makeDialog();
    const ctx = await dialog._prepareContext({});
    expect(ctx.firstExcLabel).toBe("EX2E.FirstExcellency");
    expect(ctx.secondExcLabel).toBe("EX2E.SecondExcellency");
    expect(ctx.thirdExcLabel).toBe("EX2E.ThirdExcellency");
  });

  it("assistantBonus is 0 when project has no assistants", async () => {
    const { dialog } = makeDialog();
    const ctx = await dialog._prepareContext({});
    expect(ctx.assistantBonus).toBe(0);
  });
});

// ── _prepareContext (result) ──────────────────────────────────────────────────

describe("ArtifactCraftingDialog._prepareContext result", () => {
  function makeResultDialog(rollResult, projectOverrides = {}, actorOverrides = {}) {
    const actor   = makeActor(actorOverrides);
    const project = makeProject(projectOverrides);
    const resolve = vi.fn();
    const dialog  = new ArtifactCraftingDialog({ actor, project }, resolve);
    dialog._rollResult = rollResult;
    return { dialog, resolve };
  }

  it("returns phase 'result' when _rollResult is set", async () => {
    const { dialog } = makeResultDialog({ successes: 10, botch: false });
    const ctx = await dialog._prepareContext({});
    expect(ctx.phase).toBe("result");
  });

  it("totals successes: rawSuccesses + _secondExcSucc + _assistantBonus", async () => {
    const { dialog } = makeResultDialog({ successes: 8, botch: false });
    dialog._secondExcSucc  = 2;
    dialog._assistantBonus = 1;
    const ctx = await dialog._prepareContext({});
    expect(ctx.successes).toBe(11);
  });

  it("outcome.tier is 'progress' when total is below targetSuccesses", async () => {
    const { dialog } = makeResultDialog(
      { successes: 5, botch: false },
      { targetSuccesses: 20, currentSuccesses: 5 }
    );
    const ctx = await dialog._prepareContext({});
    expect(ctx.outcome.tier).toBe("progress");
  });

  it("outcome.tier is 'completed' when total reaches targetSuccesses", async () => {
    const { dialog } = makeResultDialog(
      { successes: 15, botch: false },
      { targetSuccesses: 20, currentSuccesses: 5 }
    );
    const ctx = await dialog._prepareContext({});
    expect(ctx.outcome.tier).toBe("completed");
  });

  it("outcome.tier is 'botched' when botch=true and currentSuccesses=0", async () => {
    const { dialog } = makeResultDialog(
      { successes: 0, botch: true },
      { targetSuccesses: 20, currentSuccesses: 0 }
    );
    const ctx = await dialog._prepareContext({});
    expect(ctx.outcome.tier).toBe("botched");
  });

  it("progressPct is computed from outcome.newSuccesses / target", async () => {
    const { dialog } = makeResultDialog(
      { successes: 10, botch: false },
      { targetSuccesses: 20, currentSuccesses: 5 }
    );
    const ctx = await dialog._prepareContext({});
    expect(ctx.progressPct).toBe(75);
  });

  it("tierLabel uses capitalized tier key", async () => {
    const { dialog } = makeResultDialog(
      { successes: 5, botch: false },
      { targetSuccesses: 20, currentSuccesses: 5 }
    );
    const ctx = await dialog._prepareContext({});
    expect(ctx.tierLabel).toBe("EX2E.ArtifactTierProgress");
  });

  it("exposes botch flag in context", async () => {
    const { dialog } = makeResultDialog({ successes: 7, botch: false });
    const ctx = await dialog._prepareContext({});
    expect(ctx.botch).toBe(false);
  });
});

// ── _onClose ──────────────────────────────────────────────────────────────────

describe("ArtifactCraftingDialog._onClose", () => {
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

describe("ArtifactCraftingDialog.open", () => {
  it("returns a Promise", () => {
    const actor   = makeActor();
    const project = makeProject();
    const result  = ArtifactCraftingDialog.open(project, actor);
    expect(result).toBeInstanceOf(Promise);
  });
});
