import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import { rollSpellAttack } from "../../module/rolls/spell-attack.mjs";
import { evaluateCharmFormula } from "../../module/documents/item.mjs";

vi.mock("../../module/rolls/exalted-roll.mjs", () => ({
  ExaltedRoll: class MockExaltedRoll {
    constructor(opts) { this._opts = opts; }
    async evaluate() { return { successes: 5 }; }
  }
}));

vi.mock("../../module/documents/item.mjs", () => ({
  evaluateCharmFormula: vi.fn().mockReturnValue(5)
}));

vi.mock("../../module/helpers/targeting.mjs", () => ({
  pickTargetActor:   vi.fn().mockResolvedValue(null),
  placeAreaTemplate: vi.fn().mockResolvedValue(null),
  checkAttackRange:  vi.fn().mockReturnValue(true),
}));

// ── test environment setup ────────────────────────────────────────────────────

beforeAll(() => {
  foundry.applications.api.DialogV2 = {
    prompt: vi.fn().mockResolvedValue({ stunt: 0, dvType: "dodge" })
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  evaluateCharmFormula.mockReturnValue(5);
  foundry.applications.api.DialogV2.prompt.mockResolvedValue({ stunt: 0, dvType: "dodge" });
});

function makeActor(overrides = {}) {
  return {
    id:   overrides.id   ?? "actor-1",
    name: overrides.name ?? "Sorcerer",
    getRollData: vi.fn().mockReturnValue({}),
    currentDodgeDV: overrides.currentDodgeDV ?? 4,
    currentParryDV: overrides.currentParryDV ?? 3,
  };
}

function makeSpell(overrides = {}) {
  return {
    name: overrides.name ?? "Death of Obsidian Butterflies",
    system: {
      spellAttack: {
        enabled:     overrides.enabled     ?? true,
        pool:        overrides.pool        ?? "@dex",
        accuracy:    overrides.accuracy    ?? 2,
        damage:      overrides.damage      ?? "@successes+3",
        overwhelming: overrides.overwhelming ?? 1,
        damageType:  overrides.damageType  ?? "lethal",
        ignoresArmor: overrides.ignoresArmor ?? false,
        area:        overrides.area        ?? null,
      },
      ...overrides.systemExtra
    }
  };
}

// ── early guards ──────────────────────────────────────────────────────────────

describe("rollSpellAttack – guard conditions", () => {
  it("returns undefined when actor is null", async () => {
    const result = await rollSpellAttack(null, makeSpell());
    expect(result).toBeUndefined();
  });

  it("returns undefined when spell is null", async () => {
    const result = await rollSpellAttack(makeActor(), null);
    expect(result).toBeUndefined();
  });

  it("returns undefined when spellAttack.enabled is false", async () => {
    const result = await rollSpellAttack(makeActor(), makeSpell({ enabled: false }));
    expect(result).toBeUndefined();
  });

  it("returns undefined when spellAttack is missing entirely", async () => {
    const spell = { name: "Test", system: {} };
    const result = await rollSpellAttack(makeActor(), spell);
    expect(result).toBeUndefined();
  });

  it("does not call evaluateCharmFormula when actor is null", async () => {
    await rollSpellAttack(null, makeSpell());
    expect(evaluateCharmFormula).not.toHaveBeenCalled();
  });
});

// ── happy path (no targets) ───────────────────────────────────────────────────

describe("rollSpellAttack – no targets", () => {
  it("calls evaluateCharmFormula for pool calculation", async () => {
    game.user = { targets: { first: () => null } };
    await rollSpellAttack(makeActor(), makeSpell());
    expect(evaluateCharmFormula).toHaveBeenCalled();
  });

  it("calls ChatMessage.create to post result card", async () => {
    game.user = { targets: { first: () => null } };
    await rollSpellAttack(makeActor(), makeSpell());
    expect(ChatMessage.create).toHaveBeenCalled();
  });

  it("renders template with actor name and spell name", async () => {
    game.user = { targets: { first: () => null } };
    await rollSpellAttack(makeActor({ name: "The Sorcerer" }), makeSpell({ name: "Lightning Trap" }));
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ actorName: "The Sorcerer", spellName: "Lightning Trap" })
    );
  });

  it("computes totalPool = max(1, basePool + accuracy)", async () => {
    evaluateCharmFormula.mockReturnValue(4); // basePool = 4
    game.user = { targets: { first: () => null } };
    await rollSpellAttack(makeActor(), makeSpell({ accuracy: 3 }));
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ pool: 7 }) // 4 + 3 + stunt(0)
    );
  });

  it("passes successes to template", async () => {
    game.user = { targets: { first: () => null } };
    await rollSpellAttack(makeActor(), makeSpell());
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ successes: 5 })
    );
  });
});

// ── single target hit ─────────────────────────────────────────────────────────

describe("rollSpellAttack – single target", () => {
  it("compares successes to dodge DV when dvType='dodge'", async () => {
    const target = {
      name: "Mortal Guard",
      currentDodgeDV: 3,
      currentParryDV: 5,
    };
    game.user = { targets: { first: () => ({ actor: target }) } };
    foundry.applications.api.DialogV2.prompt.mockResolvedValue({ stunt: 0, dvType: "dodge" });
    // successes=5 > dodgeDV=3 → hit
    await rollSpellAttack(makeActor(), makeSpell());
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ hit: true, hitDV: 3 })
    );
  });

  it("compares successes to parry DV when dvType='parry'", async () => {
    const target = {
      name: "Shielded Guard",
      currentDodgeDV: 3,
      currentParryDV: 7,
    };
    game.user = { targets: { first: () => ({ actor: target }) } };
    foundry.applications.api.DialogV2.prompt.mockResolvedValue({ stunt: 0, dvType: "parry" });
    // successes=5 < parryDV=7 → miss
    await rollSpellAttack(makeActor(), makeSpell());
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ hit: false, hitDV: 7 })
    );
  });

  it("includes damageTypeLabel in template data", async () => {
    game.user = { targets: { first: () => null } };
    await rollSpellAttack(makeActor(), makeSpell({ damageType: "aggravated" }));
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ damageTypeLabel: "EX2E.DamageAggravated" })
    );
  });

  it("returns undefined when DialogV2.prompt is cancelled", async () => {
    game.user = { targets: { first: () => null } };
    foundry.applications.api.DialogV2.prompt.mockResolvedValue(null);
    const result = await rollSpellAttack(makeActor(), makeSpell());
    expect(result).toBeUndefined();
  });
});
