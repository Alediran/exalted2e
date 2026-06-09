/**
 * actor-lifecycle.mjs — Actor lifecycle hook registrations.
 *
 * Extracted from module/exalted2e.mjs. Registered once at top level via
 * registerActorLifecycleHooks(), called from the entry point at the position
 * of the earliest moved hook (createActor).
 */

import { EX2E }               from "../config.mjs";
import { itemDescription }    from "../helpers/localize-description.mjs";
import { unarmedWeaponData }  from "../migration/unarmed-weapon.mjs";
import { _isInTheCircle }     from "../setup/seeders.mjs";
import { checkHazardImmunity } from "../helpers/hazard-immunity.mjs";

// ── Unarmed Attacks ────────────────────────────────────────────────────────
// Every character carries an "Unarmed Attacks" weapon item with Clinch,
// Kick, and Punch modes baked in. The item is flagged unarmed=true so it
// can be recognised for deletion prevention and migration.

function _hasUnarmedWeapon(actor) {
  return actor.items.some(i =>
    i.type === "weapon" && i.getFlag("exalted2e", "unarmed")
  );
}

async function _ensureUnarmedWeapon(actor) {
  if (actor.type !== "character") return;
  if (_hasUnarmedWeapon(actor)) return;
  if (actor._isBeingDeleted) return;
  try {
    await actor.createEmbeddedDocuments("Item", [unarmedWeaponData()]);
  } catch (err) {
    // Silently ignore if the actor was deleted while createEmbeddedDocuments
    // was in-flight (guard check passed but deletion raced the server round-trip).
    if (!actor._isBeingDeleted) throw err;
  }
}

// ── Status effect application helper ──────────────────────────────────────
export async function _applyStatusEffect(actor, onFail, status) {
  const effectData = {
    name:     status,
    img:      "icons/svg/aura.svg",
    flags:    { exalted2e: { charmStatus: status, onFail } },
    disabled: false,
    transfer: false
  };
  await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  ui.notifications.info(game.i18n.format("EX2E.StatusApplied", { name: actor.name, status }));
}

// ── Limit Break Detection ──────────────────────────────────────────────────
// Track actors that already have an unresolved Limit Break card in this
// session, so a duplicate card isn't posted if multiple updates land at 10
// in the same tick. The Set entry is cleared whenever limit drops back below
// 10 (either by button resolution or manual GM adjustment).
export const _limitBreakPending = new Set();

async function _postLimitBreakCard(actor) {
  const virtueFlaw = actor.items.find(i => i.type === "virtueflaw") ?? null;
  let virtueRating = 0;
  if (virtueFlaw) {
    virtueRating = actor.system.virtues?.[virtueFlaw.system.baseVirtue]?.value ?? 0;
  }

  const enrichedDescription = virtueFlaw
    ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemDescription(virtueFlaw))
    : "";

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/limit-break-card.hbs",
    {
      actor,
      virtueFlaw,
      virtueRating,
      enrichedDescription,
      resolved:       false,
      choice:         null,
      localizedVirtue: virtueFlaw
        ? game.i18n.localize(EX2E.virtues[virtueFlaw.system.baseVirtue] ?? "")
        : "",
    }
  );

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: {
      exalted2e: {
        limitBreak: {
          actorId:      actor.id,
          virtueFlawId: virtueFlaw?.id ?? null,
          baseVirtue:   virtueFlaw?.system.baseVirtue ?? null,
          virtueRating,
          resolved:     false,
          choice:       null,
        }
      }
    },
  });
}

// ── Pattern Bite Detection ─────────────────────────────────────────────────
export const _patternBitePending = new Set();

async function _triggerPatternBite(actor) {
  let table = game.tables.getName("Pattern Bite");
  if (!table) {
    const pack = game.packs.get("exalted2e.paradox-bites");
    if (pack) {
      const index = await pack.getIndex();
      const entry = index.find(e => e.name === "Pattern Bite");
      if (entry) table = await pack.getDocument(entry._id);
    }
  }
  if (!table) {
    await ChatMessage.create({
      content:  game.i18n.localize("EX2E.PatternBiteFallback"),
      speaker:  ChatMessage.getSpeaker({ actor }),
    });
  } else {
    await table.draw();
  }
  await actor.update({ "system.splat.sidereal.paradox": 0 });
}

// ── Resonance Eruption Detection ──────────────────────────────────────────
export const _resonanceEruptionPending = new Set();

async function _triggerResonanceEruption(actor) {
  const essenceLevel = actor.system.essence?.value ?? 1;
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/resonance-eruption-card.hbs",
    { actor, essenceLevel }
  );
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: { exalted2e: { resonanceEruption: { actorId: actor.id, essenceLevel } } },
  });

  if (!game.user.isGM) return;
  const { EruptionAllocationDialog } = await import(
    "../dialogs/eruption-allocation-dialog.mjs"
  );
  EruptionAllocationDialog.open(actor, 10);
}

// ── DB Flux Detection ──────────────────────────────────────────────────────
// Detect when a terrestrial character's anima enters or escalates through a
// flux tier. Posts a flux card so the GM can apply the ambient damage.
// `options.scenePeripheralBefore` is passed by `spendMotes` and the sheet's
// nudge handler; unknown callers default to 0 (conservative: may post a
// card even if already in-tier, but never silently suppress one).

function _animaTierFor(sp) {
  const T = EX2E.ANIMA_THRESHOLDS;
  if      (sp >= T.totemic) return "totemic";
  else if (sp >= T.bonfire) return "bonfire";
  else if (sp >= T.burning) return "burning";
  else if (sp >= T.glowing) return "glowing";
  else if (sp >= T.dim)     return "dim";
  else                      return "none";
}

async function _postDBFluxCard(actor, tier) {
  const flux    = EX2E.DB_FLUX[tier];
  const range   = Math.floor(Math.round(actor.system.essence.value / 3));
  const name    = `EX2E.DBFlux${tier.charAt(0).toUpperCase() + tier.slice(1)}`;
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/db-flux-card.hbs",
    {
      actorName:  actor.name,
      actorId:    actor.id,
      tier,
      tierLabel:  game.i18n.localize(name),
      interval:   flux.interval,
      soakExempt: flux.soakExempt,
      range,
    }
  );
  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: { exalted2e: { dbFlux: { actorId: actor.id, tier } } }
  });
}

// Elemental aspect → hex color for the Anima Flux region ring.
const _ANIMA_FLUX_COLORS = {
  air:   0xB0D0F0,
  earth: 0xE0C030,
  fire:  0xDC143C,
  water: 0x2050A0,
  wood:  0x30B050,
};

const _FLUX_TIERS = new Set(["burning", "bonfire", "totemic"]);

/**
 * Create or destroy the Anima Flux Scene Region for a DB actor.
 * Uses an emanation shape with token attachment so Foundry moves the region
 * natively when the token moves — no updateToken hook required.
 */
async function _createOrUpdateFluxRegion(actor) {
  const scene = canvas.ready ? canvas.scene : null;
  const existingRegion = scene?.regions.find(r => r.flags?.exalted2e?.animaFluxActorId === actor.id);
  if (!_FLUX_TIERS.has(actor.system.anima)) {
    if (existingRegion) await existingRegion.delete();
    return;
  }
  if (!scene) return;
  const tokenDoc = scene.tokens.find(t => t.actor?.id === actor.id);
  if (!tokenDoc) return;
  const gs     = scene.grid.size;
  const radius = Math.max(gs, Math.floor((actor.system.essence.value ?? 1) / 3) * gs);
  const color  = _ANIMA_FLUX_COLORS[actor.system.caste] ?? 0xFF8C00;
  // Circle center in canvas pixels.
  const cx     = tokenDoc.x + (tokenDoc.width  * gs) / 2;
  const cy     = tokenDoc.y + (tokenDoc.height * gs) / 2;
  if (existingRegion) await existingRegion.delete();
  await scene.createEmbeddedDocuments("Region", [{
    name:               `${actor.name} – Anima Flux`,
    color:              `#${color.toString(16).padStart(6, "0")}`,
    visibility:         CONST.REGION_VISIBILITY.ALWAYS,
    shapes:             [{ type: "circle", x: cx, y: cy, radius }],
    attachment:         { token: tokenDoc.id },
    displayMeasurements: false,
    behaviors:          [],
    flags:              { exalted2e: { animaFlux: true, animaFluxActorId: actor.id, animaFluxColor: color } },
  }]);
}

export async function _applyFluxDamage(actor, tier) {
  const flux = EX2E.DB_FLUX[tier];
  if (!flux) return;

  let usingRegion = false;
  let targets;
  if (canvas.ready) {
    const region = canvas.scene?.regions.find(r => r.flags?.exalted2e?.animaFluxActorId === actor?.id);
    if (region) {
      usingRegion = true;
      targets = [...region.tokens].filter(t => t.actor?.id !== actor.id);
    }
  }
  if (!usingRegion) {
    targets = [...game.user.targets].map(t => t.document ?? t);
  }
  if (targets.length === 0) {
    if (!usingRegion) ui.notifications.warn(game.i18n.localize("EX2E.DBFluxNoTargets"));
    return;
  }
  for (const tokenDoc of targets) {
    const target = tokenDoc.actor;
    if (!target) continue;
    if (checkHazardImmunity(target, true)) continue;
    const lethalSoak = target.type === "character"
      ? (target.system.totalSoak?.lethal ?? 0)
      : (target.system.soak?.lethal        ?? 0);
    if (flux.soakExempt && lethalSoak > 0) continue;
    if (!flux.soakExempt && target.type === "character" && target.system.exaltType === "terrestrial") continue;
    await target.applyDamage(1, "lethal");
  }
}

// ── Anima Flux Region — visual helper ──────────────────────────────────────
// Exported so the future hooks/regions task can import it without touching
// this module.
export function _drawAnimaFluxRing(region) {
  foundry.canvas.borders.drawBorder(
    region._animaFluxRing,
    g => region.animationState.polygonTree.drawShape(g),
    { color: region._animaFluxColor ?? 0xFF8C00 }
  );
}

export function registerActorLifecycleHooks() {

  Hooks.on("createActor", async (actor, _options, userId) => {
    // Only the creating user performs the creation, to avoid duplicate items
    // in multi-client sessions.
    if (userId !== game.user.id) return;
    await _ensureUnarmedWeapon(actor);
  });

  /**
   * When a new Actor is created inside The Circle (including nested
   * sub-folders), auto-configure its prototype token as linked and
   * Friendly. Applies to any actor type — the folder is the marker for
   * "this is a PC-side actor", independent of the Foundry `type` field.
   *
   * Uses `updateSource` (same lifecycle phase as preCreate) so the new
   * config lands atomically with the rest of the creation payload.
   */
  Hooks.on("preCreateActor", (actor, data, options, userId) => {
    if (userId !== game.user.id) return;
    if (!_isInTheCircle(data.folder)) return;
    actor.updateSource({
      "prototypeToken.actorLink":   true,
      "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY
    });
  });

  /**
   * When an existing Actor is moved into The Circle (including any of
   * its sub-folders) from outside, auto-configure the prototype token —
   * same rules as the creation path. Asymmetric by design: moving out
   * of The Circle does NOT revert the config, and sub-folder reshuffles
   * inside The Circle do not re-fire.
   *
   * Mutates `changes` in place so the folder move and the prototype-token
   * tweaks persist atomically — no cascading update, no re-entry.
   */
  Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
    if (userId !== game.user.id) return;
    if (!("folder" in changes)) return;
    const enteringCircle = _isInTheCircle(changes.folder);
    const wasInCircle    = _isInTheCircle(actor.folder?.id ?? null);

    if (enteringCircle && !wasInCircle) {
      // Moving into The Circle: link token and set Friendly disposition.
      foundry.utils.mergeObject(changes, {
        prototypeToken: {
          actorLink:   true,
          disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY
        }
      });
    } else if (wasInCircle && !enteringCircle) {
      // Moving out of The Circle: restore prototype token defaults.
      foundry.utils.mergeObject(changes, {
        prototypeToken: {
          actorLink:   false,
          disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL
        }
      });
    }
  });

  // ── Limit Break Detection ────────────────────────────────────────────────
  Hooks.on("updateActor", async (actor, changes, _options, userId) => {
    if (game.user.id !== userId) return;
    if (actor.type !== "character") return;
    if (!EX2E.LIMIT_ACCRUAL_SPLATS.includes(actor.system.exaltType)) return;

    const newLimit = foundry.utils.getProperty(changes, "system.limit");

    // Clear the pending guard whenever Limit is anything other than 10.
    if (newLimit !== undefined && newLimit !== 10) {
      _limitBreakPending.delete(actor.id);
      return;
    }

    if (newLimit !== 10) return;
    if (_limitBreakPending.has(actor.id)) return;
    _limitBreakPending.add(actor.id);
    try {
      await _postLimitBreakCard(actor);
    } catch (err) {
      _limitBreakPending.delete(actor.id);
      throw err;
    }
  });

  // ── Gremlin Syndrome Detection (Alchemical) ────────────────────────────────
  // Mirrors the Limit-Break detection hook. At Dissonance 10 the Alchemical
  // succumbs: stamp the creatureOfVoid AE and whisper the GM an alert card.
  // Dropping below 10 clears the guard and removes the AE (GM-reversible).
  Hooks.on("updateActor", async (actor, changes, _options, userId) => {
    if (game.user.id !== userId) return;
    if (actor.type !== "character") return;
    if (actor.system.exaltType !== "alchemical") return;

    const newDis = foundry.utils.getProperty(changes, "system.splat.alchemical.dissonance");
    if (newDis === undefined) return;

    const { _gremlinPending, stampGremlinAE, removeGremlinAE, postGremlinAlert } =
      await import("../combat/gremlin-syndrome.mjs");

    if (newDis < 10) {
      try {
        await removeGremlinAE(actor);
      } catch (err) {
        console.error("exalted2e | Failed to remove Gremlin Syndrome AE:", err);
      }
      _gremlinPending.delete(actor.id);
      return;
    }
    if (_gremlinPending.has(actor.id)) return;
    _gremlinPending.add(actor.id);
    try {
      await stampGremlinAE(actor);
      await postGremlinAlert(actor);
    } catch (err) {
      _gremlinPending.delete(actor.id);
      throw err;
    }
  });

  // ── Pattern Bite Detection ───────────────────────────────────────────────
  Hooks.on("updateActor", async (actor, changes, _options, userId) => {
    if (game.user.id !== userId) return;
    if (actor.type !== "character") return;
    if (actor.system.exaltType !== "sidereal") return;

    const newParadox = foundry.utils.getProperty(changes, "system.splat.sidereal.paradox");

    if (newParadox !== undefined && newParadox !== 10) {
      _patternBitePending.delete(actor.id);
      return;
    }
    if (newParadox !== 10) return;
    if (_patternBitePending.has(actor.id)) return;
    _patternBitePending.add(actor.id);
    try {
      await _triggerPatternBite(actor);
    } finally {
      _patternBitePending.delete(actor.id);
    }
  });

  // ── Resonance Eruption Detection ─────────────────────────────────────────
  Hooks.on("updateActor", async (actor, changes, _options, userId) => {
    if (game.user.id !== userId) return;
    if (actor.type !== "character") return;
    if (actor.system.exaltType !== "abyssal") return;

    const newLimit = foundry.utils.getProperty(changes, "system.limit");

    if (newLimit !== undefined && newLimit !== 10) {
      _resonanceEruptionPending.delete(actor.id);
      return;
    }
    if (newLimit !== 10) return;
    if (_resonanceEruptionPending.has(actor.id)) return;
    _resonanceEruptionPending.add(actor.id);
    try {
      await _triggerResonanceEruption(actor);
    } finally {
      _resonanceEruptionPending.delete(actor.id);
    }
  });

  // ── DB Flux Detection ────────────────────────────────────────────────────
  // Detect when a terrestrial character's anima enters or escalates through a
  // flux tier. Posts a flux card so the GM can apply the ambient damage.
  // `options.scenePeripheralBefore` is passed by `spendMotes` and the sheet's
  // nudge handler; unknown callers default to 0 (conservative: may post a
  // card even if already in-tier, but never silently suppress one).
  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (game.user.id !== userId) return;
    if (actor.type !== "character") return;
    if (actor.system.exaltType !== "terrestrial") return;
    if (changes.system?.scenePeripheral === undefined) return;

    const tierBefore = _animaTierFor(options.scenePeripheralBefore ?? 0);
    const tierAfter  = actor.system.anima;

    if (tierAfter === tierBefore) return;

    const combatant = game.combat?.combatants.find(c => c.actorId === actor.id);
    if (combatant) {
      if (_FLUX_TIERS.has(tierAfter)) {
        const currentTick = game.combat.combatant?.initiative ?? 0;
        const interval    = EX2E.DB_FLUX[tierAfter].interval;
        await combatant.setFlag("exalted2e", "fluxNextFireTick", currentTick + interval);
      } else if (_FLUX_TIERS.has(tierBefore)) {
        await combatant.unsetFlag("exalted2e", "fluxNextFireTick");
      }
    }

    await _createOrUpdateFluxRegion(actor);

    if (!_FLUX_TIERS.has(tierAfter)) return;
    await _postDBFluxCard(actor, tierAfter);
  });

  // ── Unit: sync engaged/disbanded token status effects on actor update ─────
  Hooks.on("updateActor", async (actor, changes) => {
    if (actor.type !== "unit") return;
    const tokens = actor.getActiveTokens();
    if (!tokens.length) return;

    if ("engaged" in (changes.system ?? {})) {
      const active = changes.system.engaged;
      await actor.toggleStatusEffect("unit-engaged", { active });
    }

    if ("disbanded" in (changes.system ?? {})) {
      const active = changes.system.disbanded;
      await actor.toggleStatusEffect("unit-disbanded", { active });
    }
  });

}
