import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";
import { _resolveLimitBreak, _resolveActOfVillainy } from "../../module/hooks/chat-cards.mjs";

// ── module-level mocks (hoisted before imports) ──────────────────────────────

vi.mock("../../module/config.mjs", () => ({
  EX2E: {
    virtues: {
      valor:      "EX2E.VirtueValor",
      compassion: "EX2E.VirtueCompassion",
      conviction: "EX2E.VirtueConviction",
      temperance: "EX2E.VirtueTemperance",
    }
  }
}));

vi.mock("../../module/helpers/localize-description.mjs", () => ({
  itemDescription: vi.fn().mockReturnValue("Virtue flaw description")
}));

vi.mock("../../module/documents/item.mjs", () => ({
  evaluateCharmFormula: vi.fn()
}));

vi.mock("../../module/helpers/permissions.mjs", () => ({
  ex2eCan: vi.fn()
}));

vi.mock("../../module/helpers/targeting.mjs", () => ({
  resolveUserActor: vi.fn(),
  pickTargetActor:  vi.fn(),
  checkAttackRange: vi.fn(),
}));

vi.mock("../../module/rolls/attack-math.mjs", () => ({
  computeAttackOutcome: vi.fn()
}));

vi.mock("../../module/rolls/activation-ledger.mjs", () => ({
  planLedgerRefund: vi.fn()
}));

vi.mock("../../module/rolls/dice-math.mjs", () => ({
  countSuccesses: vi.fn()
}));

vi.mock("../../module/ui/social-influence-effects.mjs", () => ({
  applySocialInfluenceEffects: vi.fn(),
  clearSocialInfluenceEffects: vi.fn(),
}));

vi.mock("../../module/rolls/motivation-break-math.mjs", () => ({
  applyRefusalMath: vi.fn(),
  applyRefundMath:  vi.fn(),
}));

vi.mock("../../module/combat/knockback.mjs", () => ({
  resolveKnockbackChain:    vi.fn(),
  onKnockdownResistClick:   vi.fn(),
}));

vi.mock("../../module/rolls/social-attack-math.mjs", () => ({
  resolveStep2:             vi.fn(),
  computeMdvExcellencyCaps: vi.fn(),
}));

vi.mock("../../module/dialogs/step2-social-defense-dialog.mjs", () => ({
  Step2SocialDefenseDialog: vi.fn()
}));

vi.mock("../../module/dialogs/gm-roll-pool-dialog.mjs", () => ({
  computeGmRollPool: vi.fn()
}));

vi.mock("../../module/rolls/unit-action-roll.mjs", () => ({
  rollExhaustion: vi.fn()
}));

vi.mock("../../module/rolls/charm-event-math.mjs", () => ({
  getTargetPenaltyChanges:  vi.fn(),
  collectStatusApplyCharms: vi.fn(),
}));

vi.mock("../../module/hooks/actor-lifecycle.mjs", () => ({
  _applyStatusEffect: vi.fn(),
  _applyFluxDamage:   vi.fn(),
}));

vi.mock("../../module/combat/limit-break-effect.mjs", () => ({
  buildLimitBreakEffectData: vi.fn().mockReturnValue({ name: "Limit Break AE" })
}));

vi.mock("../../module/hooks/_chat-card-helpers.mjs", () => ({
  computeExcellencyKey:       vi.fn(),
  computeStep2MoteCost:       vi.fn(),
  buildStep2FlagUpdates:      vi.fn(),
  isActorSentient:            vi.fn(),
  computeMoteRecoveryAmount:  vi.fn(),
  scaleTargetEffectByDamage:  vi.fn(),
}));

// ── test environment setup ────────────────────────────────────────────────────

beforeAll(() => {
  if (!foundry.applications.ux) foundry.applications.ux = {};
  if (!foundry.applications.ux.TextEditor) {
    foundry.applications.ux.TextEditor = { implementation: {} };
  }
  foundry.applications.ux.TextEditor.implementation.enrichHTML =
    vi.fn().mockResolvedValue("<p>Enriched</p>");
});

beforeEach(() => {
  vi.clearAllMocks();
  foundry.applications.ux.TextEditor.implementation.enrichHTML
    .mockResolvedValue("<p>Enriched</p>");
});

// ── helpers ───────────────────────────────────────────────────────────────────

function makeVirtueFlaw(overrides = {}) {
  return {
    id:     overrides.id   ?? "vf-item-1",
    name:   overrides.name ?? "Foolish Valor",
    system: {
      baseVirtue:   overrides.baseVirtue  ?? "valor",
      descriptions: overrides.descriptions ?? {},
    },
  };
}

function makeActor(overrides = {}) {
  return {
    id:   "actor-1",
    name: "Solar Exalt",
    system: {
      willpower: {
        value: overrides.willpowerValue ?? 5,
        max:   overrides.willpowerMax   ?? 10,
      },
      limit: overrides.limit ?? 8,
    },
    testUserPermission: vi.fn().mockReturnValue(overrides.hasPermission ?? true),
    update:             vi.fn().mockResolvedValue(undefined),
    items: {
      get: vi.fn().mockReturnValue(overrides.virtueFlaw ?? null),
    },
    effects:                overrides.effects ?? [],
    createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
  };
}

function makeLimitBreak(overrides = {}) {
  return {
    actorId:      overrides.actorId      ?? "actor-1",
    resolved:     overrides.resolved     ?? false,
    virtueRating: overrides.virtueRating ?? 3,
    virtueFlawId: overrides.virtueFlawId ?? "vf-item-1",
  };
}

function makeMessage(flagOverrides = {}) {
  return {
    flags: { exalted2e: { ...flagOverrides } },
    update: vi.fn().mockResolvedValue(undefined),
  };
}

// ── _resolveLimitBreak – guard conditions ─────────────────────────────────────

describe("_resolveLimitBreak – guard conditions", () => {
  it("returns early when message has no limitBreak flag", async () => {
    const message = makeMessage({});
    const actor   = makeActor();
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("returns early when limitBreak.resolved is true", async () => {
    const lb      = makeLimitBreak({ resolved: true });
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor();
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("returns early when actor is not found", async () => {
    const lb      = makeLimitBreak();
    const message = makeMessage({ limitBreak: lb });
    game.actors.get.mockReturnValue(null);
    await expect(_resolveLimitBreak(message, "spare")).resolves.toBeUndefined();
    expect(message.update).not.toHaveBeenCalled();
  });

  it("warns when actor is not owned and returns early", async () => {
    const lb      = makeLimitBreak();
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor({ hasPermission: false });
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    expect(ui.notifications.warn).toHaveBeenCalledWith("EX2E.NotOwner");
    expect(actor.update).not.toHaveBeenCalled();
  });
});

// ── _resolveLimitBreak – actor update ─────────────────────────────────────────

describe("_resolveLimitBreak – actor update", () => {
  it("always resets system.limit to 0", async () => {
    const lb      = makeLimitBreak({ virtueRating: 0 });
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor();
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    expect(actor.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.limit": 0 })
    );
  });

  it("adds virtueRating to willpower when choice='full' and virtueRating > 0", async () => {
    const lb      = makeLimitBreak({ virtueRating: 2 });
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor({ willpowerValue: 5, willpowerMax: 10 });
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "full");
    expect(actor.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.willpower.value": 7 })
    );
  });

  it("clamps willpower to max when virtueRating would exceed it", async () => {
    const lb      = makeLimitBreak({ virtueRating: 5 });
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor({ willpowerValue: 8, willpowerMax: 10 });
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "full");
    expect(actor.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.willpower.value": 10 })
    );
  });

  it("does not update willpower when choice='spare'", async () => {
    const lb      = makeLimitBreak({ virtueRating: 3 });
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor({ willpowerValue: 5 });
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    const updateArg = actor.update.mock.calls[0][0];
    expect(updateArg).not.toHaveProperty("system.willpower.value");
  });

  it("does not update willpower when choice='full' but virtueRating is 0", async () => {
    const lb      = makeLimitBreak({ virtueRating: 0 });
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor({ willpowerValue: 5 });
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "full");
    const updateArg = actor.update.mock.calls[0][0];
    expect(updateArg).not.toHaveProperty("system.willpower.value");
  });
});

// ── _resolveLimitBreak – virtue flaw AE ──────────────────────────────────────

describe("_resolveLimitBreak – virtue flaw active effect", () => {
  it("creates limit break AE when virtueFlaw found and no existing effect", async () => {
    const vf      = makeVirtueFlaw();
    const lb      = makeLimitBreak({ virtueFlawId: "vf-item-1" });
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor({ virtueFlaw: vf, effects: [] });
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith(
      "ActiveEffect",
      [{ name: "Limit Break AE" }]
    );
  });

  it("skips AE creation when a limitBreakEffect AE already exists (dedup guard)", async () => {
    const vf           = makeVirtueFlaw();
    const existingAE   = { flags: { exalted2e: { limitBreakEffect: true } } };
    const lb           = makeLimitBreak({ virtueFlawId: "vf-item-1" });
    const message      = makeMessage({ limitBreak: lb });
    const actor        = makeActor({ virtueFlaw: vf, effects: [existingAE] });
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("skips AE creation when no virtueFlaw is found", async () => {
    const lb      = makeLimitBreak({ virtueFlawId: "vf-item-1" });
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor({ virtueFlaw: null });
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("passes empty enrichedDescription to template when no virtueFlaw", async () => {
    const lb      = makeLimitBreak({ virtueFlawId: "vf-item-1" });
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor({ virtueFlaw: null });
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ enrichedDescription: "" })
    );
  });

  it("calls enrichHTML when virtueFlaw is found", async () => {
    const vf      = makeVirtueFlaw();
    const lb      = makeLimitBreak({ virtueFlawId: "vf-item-1" });
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor({ virtueFlaw: vf, effects: [] });
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    expect(foundry.applications.ux.TextEditor.implementation.enrichHTML)
      .toHaveBeenCalled();
  });
});

// ── _resolveLimitBreak – message update ──────────────────────────────────────

describe("_resolveLimitBreak – message update", () => {
  it("updates message with resolved=true", async () => {
    const lb      = makeLimitBreak();
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor();
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    expect(message.update).toHaveBeenCalledWith(
      expect.objectContaining({ "flags.exalted2e.limitBreak.resolved": true })
    );
  });

  it("updates message with the choice passed", async () => {
    const lb      = makeLimitBreak();
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor();
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "full");
    expect(message.update).toHaveBeenCalledWith(
      expect.objectContaining({ "flags.exalted2e.limitBreak.choice": "full" })
    );
  });

  it("renders the limit-break card template before updating", async () => {
    const lb      = makeLimitBreak();
    const message = makeMessage({ limitBreak: lb });
    const actor   = makeActor();
    game.actors.get.mockReturnValue(actor);
    await _resolveLimitBreak(message, "spare");
    expect(foundry.applications.handlebars.renderTemplate).toHaveBeenCalledWith(
      "systems/exalted2e/templates/chat/limit-break-card.hbs",
      expect.any(Object)
    );
  });
});

// ── _resolveActOfVillainy – guard conditions ──────────────────────────────────

describe("_resolveActOfVillainy – guard conditions", () => {
  it("returns early when message has no actOfVillainy flag", async () => {
    const message = makeMessage({});
    await _resolveActOfVillainy(message, 5);
    expect(message.update).not.toHaveBeenCalled();
  });

  it("returns early when actOfVillainy.rolled is true", async () => {
    const aov     = { actorId: "actor-1", rolled: true };
    const message = makeMessage({ actOfVillainy: aov });
    await _resolveActOfVillainy(message, 5);
    expect(message.update).not.toHaveBeenCalled();
  });

  it("returns early when actor is not found", async () => {
    const aov     = { actorId: "actor-1", rolled: false };
    const message = makeMessage({ actOfVillainy: aov });
    game.actors.get.mockReturnValue(null);
    await expect(_resolveActOfVillainy(message, 5)).resolves.toBeUndefined();
    expect(message.update).not.toHaveBeenCalled();
  });
});

// ── _resolveActOfVillainy – torment math ─────────────────────────────────────

describe("_resolveActOfVillainy – torment reduction", () => {
  it("reduces actor limit by the number of successes", async () => {
    const aov     = { actorId: "actor-1", rolled: false };
    const message = makeMessage({ actOfVillainy: aov });
    const actor   = makeActor({ limit: 8 });
    game.actors.get.mockReturnValue(actor);
    await _resolveActOfVillainy(message, 3);
    expect(actor.update).toHaveBeenCalledWith({ "system.limit": 5 });
  });

  it("floors torment at 0 when successes exceed current limit", async () => {
    const aov     = { actorId: "actor-1", rolled: false };
    const message = makeMessage({ actOfVillainy: aov });
    const actor   = makeActor({ limit: 3 });
    game.actors.get.mockReturnValue(actor);
    await _resolveActOfVillainy(message, 10);
    expect(actor.update).toHaveBeenCalledWith({ "system.limit": 0 });
  });

  it("reduces to exactly 0 when successes equal current limit", async () => {
    const aov     = { actorId: "actor-1", rolled: false };
    const message = makeMessage({ actOfVillainy: aov });
    const actor   = makeActor({ limit: 5 });
    game.actors.get.mockReturnValue(actor);
    await _resolveActOfVillainy(message, 5);
    expect(actor.update).toHaveBeenCalledWith({ "system.limit": 0 });
  });

  it("marks actOfVillainy as rolled in message update", async () => {
    const aov     = { actorId: "actor-1", rolled: false };
    const message = makeMessage({ actOfVillainy: aov });
    const actor   = makeActor({ limit: 8 });
    game.actors.get.mockReturnValue(actor);
    await _resolveActOfVillainy(message, 3);
    expect(message.update).toHaveBeenCalledWith({
      flags: {
        exalted2e: {
          actOfVillainy: { actorId: "actor-1", rolled: true }
        }
      }
    });
  });

  it("spreads existing aov fields when marking rolled", async () => {
    const aov     = { actorId: "actor-1", rolled: false, extraField: "preserved" };
    const message = makeMessage({ actOfVillainy: aov });
    const actor   = makeActor({ limit: 5 });
    game.actors.get.mockReturnValue(actor);
    await _resolveActOfVillainy(message, 2);
    expect(message.update).toHaveBeenCalledWith({
      flags: {
        exalted2e: {
          actOfVillainy: { actorId: "actor-1", rolled: true, extraField: "preserved" }
        }
      }
    });
  });
});
