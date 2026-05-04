/**
 * exalted2e.mjs – Main entry point for the Exalted 2nd Edition Foundry VTT system.
 */

// ── Imports ────────────────────────────────────────────────────────────────
import { EX2E }             from "./config.mjs";
import { ExaltedActor }     from "./documents/actor.mjs";
import { ExaltedItem }      from "./documents/item.mjs";
import { ExaltedCombat }    from "./documents/combat.mjs";
import { CharacterData }    from "./data/actor/character-data.mjs";
import { NpcData }          from "./data/actor/npc-data.mjs";
import { CharmData }        from "./data/item/charm-data.mjs";
import { SpellData }        from "./data/item/spell-data.mjs";
import { WeaponData }       from "./data/item/weapon-data.mjs";
import { ArmorData }        from "./data/item/armor-data.mjs";
import { BackgroundData }   from "./data/item/background-data.mjs";
import { IntimacyData }     from "./data/item/intimacy-data.mjs";
import { MeritFlawData }    from "./data/item/meritflaw-data.mjs";
import { KnackData }        from "./data/item/knack-data.mjs";
import { VirtueFlawData }   from "./data/item/virtueflaw-data.mjs";
import { ComboData }        from "./data/item/combo-data.mjs";
import { FormData }         from "./data/item/form-data.mjs";
import { AnimaPowerData }   from "./data/item/anima-power-data.mjs";
import { UrgeData }         from "./data/item/urge-data.mjs";
import { CharacterSheet }   from "./sheets/actor/character-sheet.mjs";
import { NpcSheet }         from "./sheets/actor/npc-sheet.mjs";
import { CharmSheet }       from "./sheets/item/charm-sheet.mjs";
import { SpellSheet }       from "./sheets/item/spell-sheet.mjs";
import { WeaponSheet }      from "./sheets/item/weapon-sheet.mjs";
import { ArmorSheet }       from "./sheets/item/armor-sheet.mjs";
import { GenericItemSheet } from "./sheets/item/generic-item-sheet.mjs";
import { KnackSheet }      from "./sheets/item/knack-sheet.mjs";
import { VirtueFlawSheet } from "./sheets/item/virtueflaw-sheet.mjs";
import { UrgeSheet }       from "./sheets/item/urge-sheet.mjs";
import { ComboSheet }       from "./sheets/item/combo-sheet.mjs";
import { FormSheet }        from "./sheets/item/form-sheet.mjs";
import { AnimaPowerSheet }  from "./sheets/item/anima-power-sheet.mjs";
import { XpCostsConfigDialog } from "./dialogs/xp-costs-config-dialog.mjs";
import { PermissionsConfigDialog } from "./dialogs/permissions-config-dialog.mjs";
import { registerHandlebarsHelpers } from "./helpers/handlebars.mjs";
import { ex2eCan } from "./helpers/permissions.mjs";
import { ActionQuickbar } from "./ui/action-quickbar.mjs";
import { TickWheel }                      from "./ui/tick-wheel.mjs";
import { JoinBattlePanel }                from "./ui/join-battle-panel.mjs";
import { refreshTokenAnimaGlow }          from "./ui/token-anima-glow.mjs";
import { countSuccesses } from "./rolls/dice-math.mjs";
import { planLedgerRefund } from "./rolls/activation-ledger.mjs";
import { Step2SocialDefenseDialog } from "./dialogs/step2-social-defense-dialog.mjs";
import { resolveStep2, computeMdvExcellencyCaps } from "./rolls/social-attack-math.mjs";
import {
  applySocialInfluenceEffects,
  clearSocialInfluenceEffects
} from "./ui/social-influence-effects.mjs";
import {
  applyRefusalMath,
  applyRefundMath
} from "./rolls/motivation-break-math.mjs";
import { aimHandler }     from "./combat/multi-tick-aim.mjs";
import { sorceryHandler } from "./combat/multi-tick-sorcery.mjs";
import { resolveKnockbackChain, onKnockdownResistClick } from "./combat/knockback.mjs";
import { _seedAnimaPowersCompendium } from "./helpers/anima-power-seeds.mjs";

// ── Init Hook ──────────────────────────────────────────────────────────────
Hooks.once("init", function () {
  console.log("Exalted 2e | Initialising system...");

  // Expose config on the game object
  game.exalted2e = { EX2E };

  // ── Document Classes ────────────────────────────────────────────────────
  CONFIG.Actor.documentClass  = ExaltedActor;
  CONFIG.Item.documentClass   = ExaltedItem;
  CONFIG.Combat.documentClass = ExaltedCombat;
  // Initiative is driven by Join Battle (Wits + Awareness) and the tick
  // advance after each action — Foundry's built-in per-combatant roll isn't
  // used, so give it a null formula.
  CONFIG.Combat.initiative = { formula: "0", decimals: 0 };
  // Swap the default d20 on the per-combatant Roll Initiative button for a d10
  // — Exalted rolls d10 pools. Foundry ships d10-grey.svg; no highlight
  // variant exists, so we reuse it for hover (the :hover drop-shadow still
  // makes the button feel interactive).
  CONFIG.Combat.initiativeIcon = {
    icon:  "/systems/exalted2e/assets/icons/d10.svg",
    hover: "/systems/exalted2e/assets/icons/d10-highlight.svg"
  };

  // ── Data Models ─────────────────────────────────────────────────────────
  CONFIG.Actor.dataModels = {
    character: CharacterData,
    npc:       NpcData
  };
  CONFIG.Item.dataModels = {
    charm:      CharmData,
    spell:      SpellData,
    weapon:     WeaponData,
    armor:      ArmorData,
    background: BackgroundData,
    intimacy:   IntimacyData,
    meritflaw:  MeritFlawData,
    knack:      KnackData,
    virtueflaw: VirtueFlawData,
    combo:      ComboData,
    form:       FormData,
    animapower: AnimaPowerData,
    urge:       UrgeData
  };

  // ── Sheet Registration ──────────────────────────────────────────────────
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.registerSheet("exalted2e", CharacterSheet, {
    types:     ["character"],
    makeDefault: true,
    label:     "EX2E.SheetCharacter"
  });
  foundry.documents.collections.Actors.registerSheet("exalted2e", NpcSheet, {
    types:     ["npc"],
    makeDefault: true,
    label:     "EX2E.SheetNpc"
  });

  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet("exalted2e", CharmSheet, {
    types:     ["charm"],
    makeDefault: true,
    label:     "EX2E.SheetCharm"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", SpellSheet, {
    types:     ["spell"],
    makeDefault: true,
    label:     "EX2E.SheetSpell"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", WeaponSheet, {
    types:     ["weapon"],
    makeDefault: true,
    label:     "EX2E.SheetWeapon"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", ArmorSheet, {
    types:     ["armor"],
    makeDefault: true,
    label:     "EX2E.SheetArmor"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", GenericItemSheet, {
    types:     ["background", "intimacy", "meritflaw"],
    makeDefault: true,
    label:     "EX2E.SheetGenericItem"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", KnackSheet, {
    types:     ["knack"],
    makeDefault: true,
    label:     "EX2E.SheetKnack"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", VirtueFlawSheet, {
    types:     ["virtueflaw"],
    makeDefault: true,
    label:     "EX2E.SheetVirtueFlaw"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", UrgeSheet, {
    types:       ["urge"],
    makeDefault: true,
    label:       "EX2E.UrgeItemType"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", ComboSheet, {
    types:     ["combo"],
    makeDefault: true,
    label:     "EX2E.SheetCombo"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", FormSheet, {
    types:     ["form"],
    makeDefault: true,
    label:     "EX2E.SheetForm"
  });
  foundry.documents.collections.Items.registerSheet("exalted2e", AnimaPowerSheet, {
    types:     ["animapower"],
    makeDefault: true,
    label:     "EX2E.SheetAnimaPower"
  });

  // ── System Settings ─────────────────────────────────────────────────────
  game.settings.register("exalted2e", "useErrataMaterials", {
    name:    "EX2E.SettingErrataMaterials",
    hint:    "EX2E.SettingErrataMaterialsHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: false,
    requiresReload: true
  });

  game.settings.register("exalted2e", "useIntimacyIntensity", {
    name:    "EX2E.SettingIntimacyIntensity",
    hint:    "EX2E.SettingIntimacyIntensityHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: false
  });

  // ── Automation Settings ────────────────────────────────────────────────
  game.settings.register("exalted2e", "autoApplyDamage", {
    name:    "EX2E.SettingAutoApplyDamage",
    hint:    "EX2E.SettingAutoApplyDamageHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: true
  });

  game.settings.register("exalted2e", "theCircleSeeded", {
    name:    "EX2E.SettingTheCircleSeeded",
    hint:    "EX2E.SettingTheCircleSeededHint",
    scope:   "world",
    config:  false,   // hidden — internal seed tracker
    type:    Boolean,
    default: false
  });

  // ── XP Cost Engine Config ──────────────────────────────────────────────
  // Stored as a single nested object so overrides per field can live
  // alongside one another; anything absent falls through to the defaults
  // baked into helpers/xp-cost-defaults.mjs.
  game.settings.register("exalted2e", "xpCosts", {
    name:    "EX2E.XpCostsConfigTitle",
    scope:   "world",
    config:  false,   // surfaced via the menu below instead of a checkbox
    type:    Object,
    default: {}
  });

  // ── Permissions ────────────────────────────────────────────────────────
  // Per-action minimum role, overlaid onto PERMISSION_DEFAULTS. Sparse —
  // only tweaked keys appear in storage.
  game.settings.register("exalted2e", "permissions", {
    name:    "EX2E.PermissionsConfigTitle",
    scope:   "world",
    config:  false,
    type:    Object,
    default: {}
  });

  game.settings.registerMenu("exalted2e", "xpCostsMenu", {
    name:       "EX2E.XpCostsConfigTitle",
    label:      "EX2E.XpCostsConfigButton",
    hint:       "EX2E.XpCostsConfigHint",
    icon:       "fa-solid fa-coins",
    type:       XpCostsConfigDialog,
    restricted: true   // GM-only
  });

  game.settings.registerMenu("exalted2e", "permissionsMenu", {
    name:       "EX2E.PermissionsConfigTitle",
    label:      "EX2E.PermissionsConfigButton",
    hint:       "EX2E.PermissionsConfigHint",
    icon:       "fa-solid fa-user-shield",
    type:       PermissionsConfigDialog,
    restricted: true   // GM-only
  });

  // ── Multi-tick action handlers ─────────────────────────────────────────
  // Single-slot per combatant; handlers register here so the wheel-tick
  // loop and commit dispatcher can fire onTick / onComplete /
  // onCommitOther / onAbort by actionKey.
  EX2E.multiTickHandlers.aim     = aimHandler;
  EX2E.multiTickHandlers.sorcery = sorceryHandler;

  // ── Handlebars Helpers ──────────────────────────────────────────────────
  registerHandlebarsHelpers();

  // Pre-load all sheet templates for performance
  _preloadTemplates();

  // ── CONFIG Additions ────────────────────────────────────────────────────
  CONFIG.EX2E = EX2E;

  // Enrich Foundry's built-in Prone status with the 2e "-1 external
  // penalty on non-reflexive physical actions" rule. Storing it on the
  // effect's flags means the penalty travels with the AE when Foundry
  // creates it from the token HUD — the roll pipelines aggregate every
  // active effect with a `flags.exalted2e.externalPenalty` and subtract.
  const proneEffect = CONFIG.statusEffects.find(e => e.id === "prone");
  if (proneEffect) {
    proneEffect.flags = foundry.utils.mergeObject(proneEffect.flags ?? {}, {
      exalted2e: { externalPenalty: { value: 1, type: "physical" } }
    });
  }

  console.log("Exalted 2e | System initialised.");
});

// ── Template Pre-loading ───────────────────────────────────────────────────
async function _preloadTemplates() {
  const templatePaths = [
    // Actor – Character
    "systems/exalted2e/templates/actor/character/header.hbs",
    "systems/exalted2e/templates/actor/character/tabs.hbs",
    "systems/exalted2e/templates/actor/character/tab-main.hbs",
    "systems/exalted2e/templates/actor/character/abilities-default.hbs",
    "systems/exalted2e/templates/actor/character/abilities-four.hbs",
    "systems/exalted2e/templates/actor/character/specialties-section.hbs",
    "systems/exalted2e/templates/actor/character/_splat.hbs",
    "systems/exalted2e/templates/actor/character/_lunar-heartsblood.hbs",
    "systems/exalted2e/templates/actor/character/tab-combat.hbs",
    "systems/exalted2e/templates/actor/character/tab-charms.hbs",
    "systems/exalted2e/templates/actor/character/tab-inventory.hbs",
    "systems/exalted2e/templates/actor/character/tab-biography.hbs",
    "systems/exalted2e/templates/actor/character/tab-experience.hbs",
    "systems/exalted2e/templates/actor/character/tab-effects.hbs",
    // Actor – NPC
    "systems/exalted2e/templates/actor/npc/header.hbs",
    "systems/exalted2e/templates/actor/npc/body.hbs",
    // Items
    "systems/exalted2e/templates/item/charm/header.hbs",
    "systems/exalted2e/templates/item/spell/header.hbs",
    "systems/exalted2e/templates/item/spell/body.hbs",
    "systems/exalted2e/templates/item/charm/tabs.hbs",
    "systems/exalted2e/templates/item/charm/tab-general.hbs",
    "systems/exalted2e/templates/item/charm/tab-attack.hbs",
    "systems/exalted2e/templates/item/weapon/header.hbs",
    "systems/exalted2e/templates/item/weapon/body.hbs",
    "systems/exalted2e/templates/item/armor/header.hbs",
    "systems/exalted2e/templates/item/armor/body.hbs",
    "systems/exalted2e/templates/item/generic/header.hbs",
    "systems/exalted2e/templates/item/generic/body.hbs",
    "systems/exalted2e/templates/item/knack/header.hbs",
    "systems/exalted2e/templates/item/knack/body.hbs",
    "systems/exalted2e/templates/item/virtueflaw/header.hbs",
    "systems/exalted2e/templates/item/virtueflaw/body.hbs",
    "systems/exalted2e/templates/item/form-sheet.hbs",
    "systems/exalted2e/templates/item/anima-power-sheet.hbs",
    // Chat / Dialogs
    "systems/exalted2e/templates/chat/roll-result.hbs",
    "systems/exalted2e/templates/chat/item-card.hbs",
    "systems/exalted2e/templates/dialog/roll-dialog.hbs",
    "systems/exalted2e/templates/dialog/add-specialty-dialog.hbs",
    "systems/exalted2e/templates/dialog/attack-dialog.hbs",
    "systems/exalted2e/templates/dialog/step2-defense-dialog.hbs",
    "systems/exalted2e/templates/dialog/counterattack-dialog.hbs",
    "systems/exalted2e/templates/dialog/flurry-declaration-dialog.hbs",
    "systems/exalted2e/templates/dialog/formula-builder-dialog.hbs",
    "systems/exalted2e/templates/dialog/virtueflaw-picker-dialog.hbs",
    "systems/exalted2e/templates/dialog/xp-costs-config-dialog.hbs",
    "systems/exalted2e/templates/dialog/shapeshift-dialog.hbs",
    "systems/exalted2e/templates/chat/attack-result.hbs",
    "systems/exalted2e/templates/chat/flurry-declared.hbs",
    "systems/exalted2e/templates/chat/action-declared.hbs",
    "systems/exalted2e/templates/chat/social-attack-card.hbs",
    "systems/exalted2e/templates/chat/shapeshift-card.hbs",
    "systems/exalted2e/templates/chat/limit-break-card.hbs",
    "systems/exalted2e/templates/dialog/social-attack-dialog.hbs"
  ];
  return foundry.applications.handlebars.loadTemplates(templatePaths);
}

// ── Unarmed Attacks ────────────────────────────────────────────────────────
// Every character carries an "Unarmed Attacks" weapon item with Clinch,
// Kick, and Punch modes baked in. The item is flagged unarmed=true so it
// can be recognised for deletion prevention and migration.
function _unarmedWeaponData() {
  return {
    name: game.i18n.localize("EX2E.UnarmedAttacks"),
    type: "weapon",
    flags: { exalted2e: { unarmed: true } },
    system: {
      equipped: true,
      artifact: false,
      modes: [
        {
          name: game.i18n.localize("EX2E.UnarmedClinch"),
          speed: 6, accuracy: 0, damage: 0, damageType: "bashing",
          overwhelming: 1, defense: 0, rate: 1, range: 0,
          minStrength: 1, minDexterity: 0, minMartialArts: 0,
          tags: ["Clinch", "Natural", "Piercing"]
        },
        {
          name: game.i18n.localize("EX2E.UnarmedKick"),
          speed: 5, accuracy: 0, damage: 3, damageType: "bashing",
          overwhelming: 1, defense: -2, rate: 2, range: 0,
          minStrength: 1, minDexterity: 2, minMartialArts: 0,
          tags: ["Natural"]
        },
        {
          name: game.i18n.localize("EX2E.UnarmedPunch"),
          speed: 5, accuracy: 1, damage: 0, damageType: "bashing",
          overwhelming: 1, defense: 2, rate: 3, range: 0,
          minStrength: 1, minDexterity: 0, minMartialArts: 0,
          tags: ["Natural"]
        }
      ]
    }
  };
}

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
    await actor.createEmbeddedDocuments("Item", [_unarmedWeaponData()]);
  } catch (err) {
    // Silently ignore if the actor was deleted while createEmbeddedDocuments
    // was in-flight (guard check passed but deletion raced the server round-trip).
    if (!actor._isBeingDeleted) throw err;
  }
}

Hooks.on("createActor", async (actor, _options, userId) => {
  // Only the creating user performs the creation, to avoid duplicate items
  // in multi-client sessions.
  if (userId !== game.user.id) return;
  await _ensureUnarmedWeapon(actor);
});

// Gate the deletion of effects flagged `gmOnlyRemoval`. Flaws seeded
// from the effects compendium (Creature of Darkness and friends) cannot
// be shaken off by the player on whose sheet they live — only the GM
// can clear them. `preDelete*` hooks cancel by returning false.
Hooks.on("preDeleteActiveEffect", (effect, options, userId) => {
  const user = game.users.get(userId);
  if (ex2eCan("protectedEffects", user)) return;
  if (!effect.flags?.exalted2e?.gmOnlyRemoval) return;
  ui.notifications.warn(game.i18n.localize("EX2E.EffectGMOnlyRemoval"));
  return false;
});

// Tear down a charm-spawned weapon when its tracking ActiveEffect is
// deleted — whether that happens because the charm was toggled off, the
// Effects tab trashed it, or Foundry's duration system expired it. We
// also flip the charm's `active` back to false so the toggleable state
// doesn't lie about having live effects.
Hooks.on("deleteActiveEffect", async (effect, _options, userId) => {
  if (userId !== game.user.id) return;
  const charmId = effect.flags?.exalted2e?.charmSource;
  if (!charmId) return;
  const actor = effect.parent;
  if (!actor || !actor.deleteEmbeddedDocuments) return;
  const weaponIds = actor.items
    .filter(i => i.type === "weapon" && i.getFlag("exalted2e", "charmSource") === charmId)
    .map(i => i.id);
  if (weaponIds.length) await actor.deleteEmbeddedDocuments("Item", weaponIds);
  const charm = actor.items.get(charmId);
  if (charm?.system?.active && !charm._isBeingDeleted) await charm.update({ "system.active": false });
});

// ── Ready Hook ─────────────────────────────────────────────────────────────
Hooks.once("ready", async function () {
  console.log("Exalted 2e | System ready.");

  // Action quickbar + tick wheel + JB panel — one instance of each per
  // client, refreshed from the same combat / combatant / active-effect
  // hooks. The JB panel is phase-1 only, the wheel and bar are phase-3.
  ActionQuickbar.instance.refresh();
  TickWheel.instance.refresh();
  JoinBattlePanel.instance.refresh();
  const hudRefresh = () => {
    ActionQuickbar.instance.refresh();
    TickWheel.instance.refresh();
    JoinBattlePanel.instance.refresh();
  };
  Hooks.on("updateCombat",      hudRefresh);
  Hooks.on("createCombat",      hudRefresh);
  Hooks.on("deleteCombat",      hudRefresh);
  Hooks.on("combatStart",       hudRefresh);
  Hooks.on("combatTurn",        hudRefresh);
  Hooks.on("createCombatant",   hudRefresh);
  Hooks.on("deleteCombatant",   hudRefresh);
  Hooks.on("updateCombatant",   hudRefresh);
  // Token selection — out-of-combat the quickbar resolves its actor from
  // the controlled token first, so refresh whenever selection changes.
  Hooks.on("controlToken",      hudRefresh);
  // Reflect DV-penalty AE changes (e.g., after rolling an attack, or
  // when a flurry DV AE is stamped) so the pending indicator updates.
  Hooks.on("createActiveEffect", hudRefresh);
  Hooks.on("deleteActiveEffect", hudRefresh);
  // Weapon equip toggles during a turn should re-evaluate the attack submenu.
  Hooks.on("updateItem",        hudRefresh);
  Hooks.on("createItem",        hudRefresh);
  Hooks.on("deleteItem",        hudRefresh);

  // Anima token glow — refresh on actor data change and on token redraw.
  // refreshToken fires on every pan/zoom frame, so skip when nothing changed.
  Hooks.on("updateActor", (actor) => {
    for (const token of actor.getActiveTokens()) {
      token._ex2eGlowCacheKey = null; // invalidate so next refreshToken rebuilds
      refreshTokenAnimaGlow(token);
    }
  });
  Hooks.on("refreshToken", (token) => {
    const actor = token.actor;
    if (!actor) return;
    const tier   = actor.system?.anima ?? "none";
    const colors = actor.getFlag?.("exalted2e", "animaColors") ?? [null, null, null];
    const cacheKey = `${tier}|${colors.join(",")}`;
    if (token._ex2eGlowCacheKey === cacheKey) return;
    token._ex2eGlowCacheKey = cacheKey;
    refreshTokenAnimaGlow(token);
  });

  // Migration: back-fill unarmed attacks onto existing characters that
  // pre-date this feature. GM-only to avoid write races.
  if (!game.user.isGM) return;
  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    if (_hasUnarmedWeapon(actor)) continue;
    await actor.createEmbeddedDocuments("Item", [_unarmedWeaponData()]);
  }

  // Migration: assign stable uids to any charms or spells that pre-date
  // the field. Runs once per world load; the inner loops are no-ops once
  // every item has a uid.
  for (const actor of game.actors) {
    const updates = [];
    for (const item of actor.items) {
      if (item.type === "charm" && !item.system.charmUid) {
        updates.push({ _id: item.id, "system.charmUid": foundry.utils.randomID() });
      } else if (item.type === "spell" && !item.system.spellUid) {
        updates.push({ _id: item.id, "system.spellUid": foundry.utils.randomID() });
      }
    }
    if (updates.length > 0) {
      await actor.updateEmbeddedDocuments("Item", updates);
    }
  }
  const worldCharms = game.items.filter(i => i.type === "charm" && !i.system.charmUid);
  if (worldCharms.length > 0) {
    await Item.updateDocuments(worldCharms.map(i => ({
      _id: i.id, "system.charmUid": foundry.utils.randomID()
    })));
  }
  const worldSpells = game.items.filter(i => i.type === "spell" && !i.system.spellUid);
  if (worldSpells.length > 0) {
    await Item.updateDocuments(worldSpells.map(i => ({
      _id: i.id, "system.spellUid": foundry.utils.randomID()
    })));
  }

  await _seedEffectsCompendium();
  await _seedAnimaPowersCompendium();
  await _seedTheCircleFolder();
});

// ── Quench (in-Foundry test harness) ──────────────────────────────────────
// Tests ship with the system bundle but only register when the Quench
// module is installed and active. Production users pay zero cost — the
// import never runs without Quench.
//
// IMPORTANT: this must run at `init`, not `ready`. Quench fires its
// `quenchReady` hook from inside its own `ready` handler; if we import
// the test entry point during our `ready` handler, our `Hooks.once`
// subscriber may register AFTER `quenchReady` has already fired, in
// which case the subscriber never runs and the panel shows no batches.
// Subscribing at `init` puts the once-listener in place before any
// `ready` handler runs.
Hooks.once("init", async function () {
  if (game.modules.get("quench")?.active) {
    try {
      await import("../tests/quench/index.mjs");
    } catch (err) {
      console.error("Exalted 2e | Quench test harness failed to load", err);
    }
  }
});

/**
 * Seed the `effects` compendium with built-in Exalted 2e condition
 * wrappers the first time a GM boots the system. Each entry is a
 * lightweight Item with its real payload carried as an embedded
 * ActiveEffect flagged `transfer: true`, so dragging the item onto an
 * actor applies the effect (see the preCreateItem hook below, which
 * discards the wrapper item and keeps only the effect).
 *
 * Additional wrappers can be appended to `_EFFECT_WRAPPER_SEEDS`.
 */
const _EFFECT_WRAPPER_SEEDS = [
  {
    name: "EX2E.CreatureOfDarkness",
    img:  "icons/svg/cowled.svg",
    // Canonically a Flaw — it has no in-game cost but cannot be shaken off.
    meritFlawType: "flaw",
    effect: {
      // Detection is flag-based rather than status-based so the token HUD
      // doesn't advertise the trait — CoD is supposed to be invisible to
      // observers. `gmOnlyRemoval` is enforced by the preDeleteActiveEffect
      // hook below.
      flags: {
        exalted2e: {
          creatureOfDarkness: true,
          gmOnlyRemoval:      true
        }
      },
      description: "Holy-keyword attacks deal aggravated damage to this character instead of bashing or lethal."
    }
  }
];

async function _seedEffectsCompendium() {
  const pack = game.packs.get("exalted2e.effects");
  if (!pack) return;
  const existing = await pack.getIndex();
  // Skip the seed pass if every expected entry already exists (indexed by name).
  const existingNames = new Set(existing.map(e => e.name));
  const todo = _EFFECT_WRAPPER_SEEDS.filter(s =>
    !existingNames.has(game.i18n.localize(s.name))
  );
  if (todo.length === 0) return;

  // The pack may be locked by default; unlock for seeding.
  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  try {
    for (const seed of todo) {
      const localizedName = game.i18n.localize(seed.name);
      await Item.create({
        name:  localizedName,
        type:  "meritflaw",
        img:   seed.img,
        flags: { exalted2e: { effectWrapper: true } },
        system: {
          meritFlawType: seed.meritFlawType ?? "merit",
          description:   seed.effect.description ?? ""
        },
        effects: [{
          name:     localizedName,
          img:      seed.img,
          // Permanent duration — no rounds / turns / seconds set.
          duration: {},
          // Flag-driven rather than status-driven, so nothing surfaces on
          // the token HUD (`statuses` is intentionally omitted).
          flags:    seed.effect.flags ?? {},
          transfer: true,
          disabled: false
        }]
      }, { pack: "exalted2e.effects" });
    }
    console.log(`Exalted 2e | Seeded ${todo.length} effect wrapper(s) into the effects compendium.`);
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
}

/**
 * Flag-based lookup for The Circle folder. Returns the Folder document
 * or null if the folder was never seeded (or the GM deleted it).
 * Survives renames because we key on the `exalted2e.theCircle` flag,
 * not on the folder's display name.
 */
function _getTheCircleFolder() {
  return game.folders?.find(f =>
    f.type === "Actor" && f.getFlag("exalted2e", "theCircle")) ?? null;
}

/**
 * True if `folderId` points to The Circle, or to any descendant
 * (sub-folder) of The Circle. Walks the parent pointer chain.
 * Returns false if `folderId` is null / unresolved, or if The Circle
 * doesn't currently exist in the world.
 */
function _isInTheCircle(folderId) {
  if (!folderId) return false;
  const circle = _getTheCircleFolder();
  if (!circle) return false;
  let cur = game.folders?.get(folderId);
  while (cur) {
    if (cur.id === circle.id) return true;
    cur = cur.folder ?? null;
  }
  return false;
}

/**
 * Create the "The Circle" Actor folder on first GM load of a world.
 * Tracked via the world setting `theCircleSeeded`; once true, we never
 * re-create the folder, even if the GM deleted it (respects GM intent).
 * For dev/testing, flip the setting back to false in the console and
 * reload.
 */
async function _seedTheCircleFolder() {
  if (game.settings.get("exalted2e", "theCircleSeeded")) return;
  try {
    await Folder.create({
      name:  game.i18n.localize("EX2E.TheCircleFolderName"),
      type:  "Actor",
      color: "#d4af37",
      flags: { exalted2e: { theCircle: true } }
    });
    await game.settings.set("exalted2e", "theCircleSeeded", true);
  } catch (err) {
    console.warn("[EX2E] Failed to seed The Circle folder:", err);
  }
}

/**
 * When an effect-wrapper item is dropped onto an actor, hijack the
 * creation: spawn the wrapper's embedded ActiveEffects directly on the
 * actor and cancel the item creation itself. Keeps the actor sheet from
 * accumulating bookkeeping "merit/flaw" entries that only exist to
 * carry the real effect payload.
 */
Hooks.on("preCreateItem", (item, data, options, userId) => {
  if (userId !== game.user.id) return;

  // Assign a stable charmUid on any new charm that doesn't already have
  // one. Fires for both world-level and actor-embedded charms. Imports
  // from a compendium carry the source's uid forward, which is exactly
  // what we want — prereqs stay linked across the copy.
  if (item.type === "charm" && !data.system?.charmUid) {
    item.updateSource({ "system.charmUid": foundry.utils.randomID() });
  }
  // Same treatment for spells so prereq / cross-reference plumbing we add
  // later can rely on a stable id.
  if (item.type === "spell" && !data.system?.spellUid) {
    item.updateSource({ "system.spellUid": foundry.utils.randomID() });
  }

  // ── Purchase Mode: XP-costing items on locked actors ──────────────────
  // Flag the item so the async createItem hook below can run the
  // confirmation flow. preCreateItem is synchronous; we can't `await`
  // a dialog here, so the item lands with a pending flag and the
  // post-create handler either strips the flag (on confirm) or
  // deletes the item (on cancel). Briefly visible but functional.
  const parentActor = item.parent;
  if (parentActor?.type === "character" &&
      parentActor.system?.purchaseLocked &&
      ["charm", "spell", "knack", "background"].includes(item.type)) {
    item.updateSource({ "flags.exalted2e.pendingPurchaseConfirm": true });
  }

  const actor = item.parent;
  if (!actor) return;
  const isWrapper = data.flags?.exalted2e?.effectWrapper
                 ?? item.getFlag("exalted2e", "effectWrapper");
  if (!isWrapper) return;

  const effects = (data.effects ?? []).map(e => {
    const clone = foundry.utils.deepClone(e);
    delete clone._id;
    return clone;
  });
  if (effects.length > 0) {
    // Fire-and-forget: preCreate hooks are synchronous. The creation
    // happens off the critical path, and cancelling below prevents the
    // wrapper item itself from ever landing on the actor.
    actor.createEmbeddedDocuments("ActiveEffect", effects);
    const label = game.i18n.localize(item.name ?? "");
    ui.notifications.info(game.i18n.format("EX2E.EffectAppliedFromWrapper", {
      name:  label,
      actor: actor.name
    }));
  }
  return false;
});

/**
 * Purchase Mode — post-persist confirmation for XP-costing item
 * additions. The sync preCreateItem hook flagged the item as pending;
 * here we run the async Purchase-confirm dialog and either strip the
 * flag (on confirm + apply XP + log entry) or delete the item outright.
 */
Hooks.on("createItem", async (item, options, userId) => {
  if (userId !== game.user.id) return;
  if (!item.getFlag("exalted2e", "pendingPurchaseConfirm")) return;
  const parent = item.parent;
  if (!parent) {
    await item.unsetFlag("exalted2e", "pendingPurchaseConfirm");
    return;
  }

  const { PurchaseConfirmDialog } = await import("./dialogs/purchase-confirm-dialog.mjs");
  const { computeXpCost } = await import("./helpers/xp-costs.mjs");

  const change = {
    kind:     "item",
    path:     `item:${item.type}`,
    oldValue: null,
    newValue: null,
    item
  };
  const costResult = computeXpCost(parent, change);
  const result = await PurchaseConfirmDialog.prompt({
    actor:        parent,
    change:       {
      traitLabel: costResult.description,
      oldValue:   "—",
      newValue:   "Added"
    },
    initialXp:    costResult.xp,
    initialNote:  "",
    showStubHint: !costResult.confident,
    description:  costResult.description
  });

  if (result === null) {
    await item.delete();
    return;
  }

  const entry = {
    timestamp:  Date.now(),
    userId:     game.user.id,
    userName:   game.user.name,
    traitPath:  change.path,
    traitLabel: costResult.description,
    oldValue:   "—",
    newValue:   "Added",
    xpCost:     result.xpCost,
    note:       result.note
  };
  await parent.update({
    "system.purchaseLog":      [...(parent.system.purchaseLog ?? []), entry],
    "system.experience.value": (parent.system.experience.value ?? 0) - result.xpCost
  });
  await item.unsetFlag("exalted2e", "pendingPurchaseConfirm");
});

// Gate deletion of items flagged `gmOnlyRemoval` — mirrors preDeleteActiveEffect.
Hooks.on("preDeleteItem", (item, options, userId) => {
  const user = game.users.get(userId);
  if (ex2eCan("protectedEffects", user)) return;
  if (!item.flags?.exalted2e?.gmOnlyRemoval) return;
  ui.notifications.warn(game.i18n.localize("EX2E.ItemGMOnlyRemoval"));
  return false;
});

/**
 * Purchase Mode — block deletion of XP-costing items while the owning
 * actor is locked. GM toggles the lock off to remove items intentionally.
 */
Hooks.on("preDeleteItem", (item, options, userId) => {
  if (userId !== game.user.id) return;
  const parent = item.parent;
  if (parent?.type !== "character") return;
  if (!parent.system?.purchaseLocked) return;
  if (!["charm", "spell", "knack", "background"].includes(item.type)) return;
  // Allow deletion of items still awaiting purchase confirmation —
  // this is the cancellation cleanup fired by the createItem hook,
  // not a user-initiated delete from the sheet.
  if (item.getFlag("exalted2e", "pendingPurchaseConfirm")) return;
  ui.notifications.warn(game.i18n.format("EX2E.PurchaseLockedItemDelete", {
    item: item.name
  }));
  return false;
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
  if (!enteringCircle || wasInCircle) return;
  foundry.utils.mergeObject(changes, {
    prototypeToken: {
      actorLink:   true,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY
    }
  });
});

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
    ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(virtueFlaw.system.description ?? "")
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

async function _applyFluxDamage(tier) {
  const flux = EX2E.DB_FLUX[tier];
  if (!flux) return;
  const targets = [...game.user.targets];
  if (targets.length === 0) {
    ui.notifications.warn(game.i18n.localize("EX2E.DBFluxNoTargets"));
    return;
  }
  for (const token of targets) {
    const target = token.actor;
    if (!target) continue;
    const lethalSoak = target.type === "character"
      ? (target.system.totalSoak?.lethal ?? 0)
      : (target.system.soak?.lethal        ?? 0);
    if (flux.soakExempt && lethalSoak > 0) continue;
    if (!flux.soakExempt
        && target.type === "character"
        && target.system.exaltType === "terrestrial") continue;
    await target.applyDamage(1, "lethal");
  }
}

Hooks.on("updateActor", async (actor, changes, options, userId) => {
  if (game.user.id !== userId) return;
  if (actor.type !== "character") return;
  if (actor.system.exaltType !== "terrestrial") return;
  if (changes.system?.scenePeripheral === undefined) return;

  const tierBefore = _animaTierFor(options.scenePeripheralBefore ?? 0);
  const tierAfter  = actor.system.anima;
  const fluxTiers  = new Set(["burning", "bonfire", "totemic"]);

  if (tierAfter === tierBefore) return;

  const combatant = game.combat?.combatants.find(c => c.actorId === actor.id);
  if (combatant) {
    if (fluxTiers.has(tierAfter)) {
      const currentTick = game.combat.combatant?.initiative ?? 0;
      const interval    = EX2E.DB_FLUX[tierAfter].interval;
      await combatant.setFlag("exalted2e", "fluxNextFireTick", currentTick + interval);
    } else if (fluxTiers.has(tierBefore)) {
      await combatant.unsetFlag("exalted2e", "fluxNextFireTick");
    }
  }

  if (!fluxTiers.has(tierAfter)) return;
  await _postDBFluxCard(actor, tierAfter);
});

Hooks.on("updateCombat", async (combat, changes, _options, userId) => {
  if (game.user.id !== userId) return;
  const newTick = changes?.flags?.exalted2e?.currentTick;
  if (newTick == null) return;

  for (const combatant of combat.combatants) {
    const nextFireTick = combatant.flags?.exalted2e?.fluxNextFireTick;
    if (nextFireTick == null) continue;
    if (newTick < nextFireTick) continue;

    const actor = combatant.actor;
    if (!actor) continue;
    const tier = actor.system.anima;
    if (!EX2E.DB_FLUX[tier]) continue;

    await _applyFluxDamage(tier);
    const interval = EX2E.DB_FLUX[tier].interval;
    await combatant.setFlag("exalted2e", "fluxNextFireTick", newTick + interval);
  }
});

// ── Combat Tracker Controls ────────────────────────────────────────────────
// Inject two Exalted-specific buttons into the combat tracker:
//   • Join Battle — GM rolls Wits+Awareness for every combatant and assigns
//     each one's starting tick.
//   • Finish Turn — opens a Speed prompt, advances the current combatant's
//     tick, and re-sorts the tracker.
Hooks.on("renderCombatTracker", (app, html, _data) => {
  const el = html instanceof HTMLElement ? html : (html?.[0] ?? html);
  if (!el?.querySelector) return;
  const combat = app.viewed;
  if (!combat) return;

  // Exalted 2e uses tick-based initiative, so Foundry's default
  // Previous/Next Round and Previous/Next Turn buttons don't map onto the
  // rules. Remove them on every render; "Finish Turn" replaces them.
  for (const action of ["previousRound", "previousTurn", "nextTurn", "nextRound"]) {
    el.querySelectorAll(`[data-action='${action}'], [data-control='${action}']`)
      .forEach(btn => btn.remove());
  }

  // Encounter-phase detection drives which buttons appear:
  //   • Phase 1 (not all combatants have JB yet): Roll JB buttons visible,
  //     Begin Encounter hidden. Players rolling individually via Foundry's
  //     per-combatant button keeps us in Phase 1 until everyone's rolled.
  //   • Phase 2 (everyone has JB, not started): Begin Encounter visible
  //     (Foundry default)
  //   • Phase 3 (started): Finish Turn visible
  //
  // We key phase detection off our own `joinBattleSuccesses` flag rather
  // than `initiative`, because Foundry can auto-populate initiative=0 when
  // combatants are created (auto-roll setting + null formula), which would
  // otherwise trip us into Phase 2 prematurely.
  const combatants = combat.combatants.contents ?? [...combat.combatants];
  const jbRolled = combatants.length > 0 && combatants.every(c => {
    const s = c.flags?.exalted2e?.joinBattleSuccesses;
    return typeof s === "number";
  });

  // Phase 1 — strip Foundry's Begin Encounter button until JB is rolled.
  // The JB roll buttons themselves live in the Join Battle HUD panel, so
  // this is the only thing left to do in the tracker DOM.
  if (!jbRolled) {
    el.querySelectorAll(`[data-action='startCombat'], [data-control='startCombat']`)
      .forEach(btn => btn.remove());
  }
  // Phase 2: native Begin Encounter is visible.
  // Phase 3: wheel UI + action quickbar handle all in-combat controls;
  // only Foundry's own End Encounter remains in the tracker footer.

  // ── Multi-tick action badge ────────────────────────────────────────────
  // Decorate combatant rows with the active multi-tick action's
  // progress (e.g., "Aiming (2/3)"). Cheap re-render — the tracker
  // re-renders on every combatant.update, which is exactly when the
  // badge needs to refresh.
  for (const c of combatants) {
    const action = c.flags?.exalted2e?.multiTickAction;
    if (!action) continue;
    const handler = EX2E.multiTickHandlers[action.actionKey];
    let text;
    if (typeof handler?.getBadgeText === "function") {
      text = handler.getBadgeText(action);
    } else {
      // Default: "{label} ({elapsed}/{total})" — Aim path
      const labelKey = handler?.badgeLabelKey ?? "EX2E.MultiTickActionGeneric";
      const label    = game.i18n.localize(labelKey);
      const elapsed  = action.ticksElapsed ?? 0;
      const total    = action.totalTicks   ?? 0;
      text = game.i18n.format("EX2E.MultiTickActionProgress",
                              { label, elapsed, total });
    }
    // Foundry v13's tracker rows expose `data-combatant-id`; fall back
    // to `data-id` for forward-compat with theme overrides.
    const row = el.querySelector(`[data-combatant-id="${c.id}"]`)
             ?? el.querySelector(`[data-id="${c.id}"]`);
    if (!row) continue;
    const nameEl = row.querySelector(".token-name") ?? row.querySelector(".name");
    if (!nameEl) continue;
    const badge = document.createElement("span");
    badge.classList.add("ex2e-mt-badge");
    badge.textContent = text;
    nameEl.appendChild(badge);
  }
});

// Clear multi-tick action flags whenever a combat is deleted (covers the
// "End Encounter" → delete path as well as out-of-band deletions).
Hooks.on("deleteCombat", async (combat) => {
  if (!combat?.combatants) return;
  const { clearAllMultiTickActions } = await import("./combat/multi-tick.mjs");
  // skipFlagUpdate: combatants are embedded in the combat being deleted,
  // so updating their flags would fail with "does not exist in combats".
  await clearAllMultiTickActions(combat, { skipFlagUpdate: true });
});

export async function _resolveLimitBreak(message, choice) {
  const lb = message.flags?.exalted2e?.limitBreak;
  if (!lb || lb.resolved) return;

  const actor = game.actors.get(lb.actorId);
  if (!actor) return;
  if (!actor?.testUserPermission(game.user, "OWNER")) {
    ui.notifications.warn(game.i18n.localize("EX2E.NotOwner"));
    return;
  }

  const updates = { "system.limit": 0 };

  if (choice === "full" && lb.virtueRating > 0) {
    const current = actor.system.willpower.value ?? 0;
    const max     = actor.system.willpower.max   ?? 0;
    updates["system.willpower.value"] = Math.min(current + lb.virtueRating, max);
  }

  await actor.update(updates);

  const virtueFlaw = actor.items.get(lb.virtueFlawId) ?? null;
  const enrichedDescription = virtueFlaw
    ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(virtueFlaw.system.description ?? "")
    : "";

  const newContent = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/limit-break-card.hbs",
    {
      actor,
      virtueFlaw,
      virtueRating:    lb.virtueRating,
      enrichedDescription,
      resolved:        true,
      choice,
      localizedVirtue: virtueFlaw
        ? game.i18n.localize(EX2E.virtues[virtueFlaw.system.baseVirtue] ?? "")
        : "",
    }
  );

  await message.update({
    content: newContent,
    "flags.exalted2e.limitBreak.resolved": true,
    "flags.exalted2e.limitBreak.choice":   choice,
  });
}

// ── Act of Villainy resolution ─────────────────────────────────────────────
export async function _resolveActOfVillainy(message, successes) {
  const aov   = message.flags?.exalted2e?.actOfVillainy;
  if (!aov || aov.rolled) return;
  const actor = game.actors.get(aov.actorId);
  if (!actor) return;
  const newTorment = Math.max(0, (actor.system.limit ?? 0) - successes);
  await actor.update({ "system.limit": newTorment });
  await message.update({
    flags: { exalted2e: { actOfVillainy: { ...aov, rolled: true } } }
  });
}

// ── Chat Listeners ─────────────────────────────────────────────────────────
Hooks.on("renderChatMessageHTML", (message, html) => {
  // Resolve the raw DOM element (html may be jQuery or HTMLElement)
  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // ── Reverse charm activation ──────────────────────────────────────────
  // Reverses everything the charm's activation ledger (stored on the
  // message's flags) recorded: refunds motes to the pools they came
  // from, restores willpower, flips sustained charms back off, tears
  // down spawned weapon artifacts, and disables the button so we don't
  // double-refund on subsequent clicks.
  el.querySelector?.(".btn-reverse-charm")?.addEventListener("click", async (ev) => {
    const record = message.flags?.exalted2e?.charmActivation;
    if (!record || record.reversed) return;

    const actor = record.actorId ? game.actors.get(record.actorId) : null;
    if (!actor?.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotOwner"));
      return;
    }

    const ledger = record.ledger ?? {};
    const { updates } = planLedgerRefund(ledger, actor.system);

    if (Object.keys(updates).length > 0) await actor.update(updates);

    // Undo toggle state and weapon artifacts on the charm itself.
    const charm = record.charmId ? actor.items.get(record.charmId) : null;
    if (charm) {
      if (ledger.toggledOn && charm.system.active) {
        await charm.update({ "system.active": false });
      } else if (ledger.toggledOff && !charm.system.active) {
        await charm.update({ "system.active": true });
      }
      if (ledger.spawnedWeapon) {
        await charm._removeCharmWeaponArtifacts();
      }
    }

    // Mark the record so the button can't fire again and the card's
    // Reverse row can be visually retired via the renderer below.
    await message.update({
      flags: { exalted2e: { charmActivation: { ...record, reversed: true } } }
    });

    // Visually retire the button in place (no full rerender needed).
    const btn = ev.currentTarget;
    btn.disabled = true;
    btn.classList.add("is-reversed");
    btn.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("EX2E.CharmReversed")}`;
    ui.notifications.info(game.i18n.localize("EX2E.CharmReversed"));
  });

  // Retire the button on subsequent renders if the record was already
  // reversed (e.g. message reload after a refund).
  if (message.flags?.exalted2e?.charmActivation?.reversed) {
    const btn = el.querySelector(".btn-reverse-charm");
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-reversed");
      btn.innerHTML = `<i class="fa-solid fa-check"></i> ${game.i18n.localize("EX2E.CharmReversed")}`;
    }
  }

  // ── Limit Break choice buttons ────────────────────────────────────────
  const lbCard = el.querySelector?.(".ex2e-limit-break-card");
  if (lbCard) {
    const lb = message.flags?.exalted2e?.limitBreak;
    if (lb && !lb.resolved) {
      lbCard.querySelector?.("[data-action='limitBreakFull']")
        ?.addEventListener("click", async () => { await _resolveLimitBreak(message, "full"); });
      lbCard.querySelector?.("[data-action='limitBreakPartial']")
        ?.addEventListener("click", async () => { await _resolveLimitBreak(message, "partial"); });
    }
  }

  // ── Apply Flux button ──────────────────────────────────────────────────────
  // Iterates `game.user.targets`. For burning/bonfire tiers, skips targets
  // with any natural lethal soak. For totemic, skips terrestrials only.
  // Range check is stubbed — canvas range-bands feature pending.
  const fluxBtn = el.querySelector?.(".btn-apply-flux");
  if (fluxBtn) {
    fluxBtn.addEventListener("click", async (ev) => {
      if (!game.user.isGM) return;
      await _applyFluxDamage(ev.currentTarget.dataset.tier);
    });
  }

  // ── Flurry card attack buttons ────────────────────────────────────────
  // Each attack-typed action in a declared flurry gets its own button that
  // kicks off the normal attack roll flow. The dice penalty is applied by
  // rollAttack through the combatant's flurry flag, so nothing extra is
  // required here beyond dispatching to it.
  el.querySelectorAll?.(".btn-flurry-attack").forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      const actorId   = ev.currentTarget.dataset.actorId;
      const weaponId  = ev.currentTarget.dataset.weaponId;
      const modeIndex = parseInt(ev.currentTarget.dataset.modeIndex) || 0;
      const actor     = actorId ? game.actors.get(actorId) : null;
      if (!actor?.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.NotOwner"));
        return;
      }
      const { ExaltedRoll } = await import("./rolls/exalted-roll.mjs");
      await ExaltedRoll.rollAttack(actor, weaponId, { modeIndex });
    });
  });

  // ── Defense picker on attack cards ────────────────────────────────────
  // Target's owner (or GM) picks Dodge or Parry; writes the choice into
  // message flags and re-renders the card into its resolved state.
  el.querySelectorAll?.(".btn-defend").forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      const defenseType = ev.currentTarget.dataset.defenseType;
      const attack      = message.flags?.exalted2e?.attack;
      if (!attack || attack.defense) return;

      const targetActor = attack.targetId ? game.actors.get(attack.targetId) : null;
      if (!targetActor?.testUserPermission(game.user, "OWNER")) {
        ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
        return;
      }
      const baseDV = defenseType === "dodge" ? attack.targetDodgeDV : attack.targetParryDV;

      // Filter the defender's Reflexive Step-2 Charms and pass them to the
      // dialog. The dialog opens every time the defender picks a defense —
      // it doubles as the confirmation step and renders an empty-state
      // message when no applicable charms exist.      
      const allStep2 = targetActor.items.filter(i =>
        i.type === "charm" &&
        i.system.charmType === "reflexive" &&
        (i.system.steps ?? []).includes(2)
      );

      // Determine the ability key relevant to this defense so we can locate
      // matching Excellency charms. Ability-based exalts key excellencies to
      // the ability (dodge / melee / martialArts); Lunars & Alchemicals key
      // them to the attribute (dexterity).
      const tSys        = targetActor.system;
      const isAttrBased = ["lunar", "alchemical"].includes(tSys.exaltType);
      const dex         = tSys.attributes?.dexterity?.value ?? 0;
      const meleeVal    = tSys.abilities?.melee?.value       ?? 0;
      const maVal       = tSys.abilities?.martialArts?.value ?? 0;
      const abilKey     = isAttrBased ? "dexterity"
                        : defenseType === "dodge" ? "dodge"
                        : (maVal > meleeVal ? "martialArts" : "melee");
      const abilVal     = isAttrBased ? 0 : (tSys.abilities?.[abilKey]?.value ?? 0);
      const keyVal      = dex + abilVal;

      // Pull the First/Second Excellency charms keyed to this ability out of
      // the regular list so they render as input sections instead of
      // checkboxes (mirrors the Attack Dialog's pattern).
      const firstExcCharm  = allStep2.find(c => c.system.excellency === "first"  && c.system.ability === abilKey);
      const secondExcCharm = allStep2.find(c => c.system.excellency === "second" && c.system.ability === abilKey);
      const excIds         = new Set([firstExcCharm, secondExcCharm].filter(Boolean).map(c => c.id));

      // Only offer charms keyed to abilities that actually apply to this
      // defense: Dodge charms for Dodge, Melee/Martial Arts for Parry.
      // Lunars & Alchemicals key defensive charms to Dexterity.
      const relevantAbilities = isAttrBased
        ? new Set(["dexterity"])
        : defenseType === "dodge"
          ? new Set(["dodge"])
          : new Set(["melee", "martialArts"]);
      const regularCharms = allStep2.filter(c =>
        !excIds.has(c.id) && relevantAbilities.has(c.system.ability)
      );

      const { Step2DefenseDialog } = await import("./dialogs/step2-defense-dialog.mjs");
      const result = await Step2DefenseDialog.prompt({
        charms:        regularCharms,
        defenseType,
        dv:            baseDV,
        targetName:    attack.targetName,
        excellency:    { first: !!firstExcCharm, second: !!secondExcCharm },
        firstExcMax:   keyVal,
        secondExcMax:  Math.ceil(keyVal / 2),
        firstExcLabel: firstExcCharm
          ? `${firstExcCharm.name} (${game.i18n.localize("EX2E.FirstExcellency")})`
          : game.i18n.localize("EX2E.FirstExcellency"),
        secondExcLabel: secondExcCharm
          ? `${secondExcCharm.name} (${game.i18n.localize("EX2E.SecondExcellency")})`
          : game.i18n.localize("EX2E.SecondExcellency")
      });
      if (!result) return;                          // user cancelled

      const activatedNames = [];
      // Track if the defender activated a Perfect Dodge / Perfect Parry
      // matching the chosen defense type. If so, the attack auto-misses —
      // Perfect Defenses trump Unblockable / Undodgeable and everything
      // downstream (no rerolls, no counterattacks, no damage).
      let perfectDefenseCharm = null;
      const perfectKeyword = defenseType === "parry" ? "Perfect Parry" : "Perfect Dodge";
      for (const id of result.charmIds) {
        const charm = targetActor.items.get(id);
        if (!charm) continue;
        const ok = await charm.activateCharm();
        if (!ok) continue;
        activatedNames.push(charm.name);
        if (!perfectDefenseCharm && (charm.system.keywords ?? []).includes(perfectKeyword)) {
          perfectDefenseCharm = charm.name;
        }
      }

      // Spend Excellency motes directly. charm.activateCharm() only pays the
      // fixed charm cost; Excellency cost is per die/success, collected from
      // the dialog inputs.
      const firstExcDice  = result.firstExcDice  ?? 0;
      const secondExcSucc = result.secondExcSucc ?? 0;
      const excMoteCost   = firstExcDice + (secondExcSucc * 2);
      if (excMoteCost > 0) {
        const spent = await targetActor.spendMotes(excMoteCost, result.moteType);
        if (!spent) return;
        if (firstExcCharm  && firstExcDice  > 0) activatedNames.push(firstExcCharm.name);
        if (secondExcCharm && secondExcSucc > 0) activatedNames.push(secondExcCharm.name);
      }

      // First Excellency adds dice to a roll — for a defensive DV, we roll
      // the purchased dice and only the resulting successes (10 = 2, 7-9 = 1)
      // bump the DV. Post the roll so the attacker can see what came up.
      let firstExcSuccesses = 0;
      if (firstExcDice > 0) {
        const excRoll = new Roll(`${firstExcDice}d10`);
        await excRoll.evaluate();
        for (const r of excRoll.terms[0].results) {
          if (r.result === 10)     firstExcSuccesses += 2;
          else if (r.result >= 7)  firstExcSuccesses += 1;
        }
      }

      // Second Excellency adds its successes directly; Third is not applied
      // to DVs here — it's used at Step 5 via the reroll button.
      const dv = baseDV + firstExcSuccesses + secondExcSucc;

      // Record defender-side Step-5 (Third Excellency reroll) eligibility.
      const defenderHasThirdExc = targetActor.items.some(c =>
        c.type === "charm" &&
        c.system.excellency === "third" &&
        c.system.ability === abilKey
      );

      // Record defender-side Step-9 (Counterattack) eligibility.
      const defenderHasCounterattack = targetActor.items.some(c =>
        c.type === "charm" &&
        (c.system.keywords ?? []).includes("Counterattack")
      );

      const newAttack = {
        ...attack,
        defense:                  { type: defenseType, dv },
        defenseCharms:            activatedNames,
        defenderHasThirdExc,
        defenderExcKey:           abilKey,
        defenderFirstExcDice:     firstExcDice,
        defenderSecondExcSucc:    secondExcSucc,
        defenderHasCounterattack,
        perfectDefenseCharm
      };

      const { renderAttackCardContent } = await import("./rolls/exalted-roll.mjs");
      const content = await renderAttackCardContent(newAttack);
      await message.update({
        content,
        flags: { exalted2e: { attack: newAttack } }
      });
    });
  });

  // ── Manual DV resolve (no target selected) ────────────────────────────
  // GM enters a DV in the card's input and clicks Resolve; the card is
  // re-rendered against that DV.
  el.querySelector?.(".btn-resolve-manual")?.addEventListener("click", async (ev) => {
    const card    = ev.currentTarget.closest(".ex2e-attack-card");
    const input   = card?.querySelector(".manual-dv-input");
    const attack  = message.flags?.exalted2e?.attack;
    if (!attack || attack.defense) return;
    if (!ex2eCan("combatFlow")) {
      ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
      return;
    }
    const dv = Math.max(0, parseInt(input?.value) || 0);
    const newAttack = { ...attack, defense: { type: "manual", dv } };
    const { renderAttackCardContent } = await import("./rolls/exalted-roll.mjs");
    const content = await renderAttackCardContent(newAttack);
    await message.update({
      content,
      flags: { exalted2e: { attack: newAttack } }
    });
  });

  // ── Step 4: Attacker Third-Excellency reroll ──────────────────────────
  // Attacker spends 4m to reroll the attack roll's failures (face < 7).
  // One-shot, and only when First/Second Excellency wasn't used.
  const recomputeDiceStats = (dice) => {
    const { rawSuccesses, ones, details } = countSuccesses(dice);
    // Preserve object identity in caller's array by mutating each element
    // with the fresh tally's succs/cls values.
    dice.forEach((d, i) => {
      d.succs = details[i].succs;
      d.cls   = details[i].cls;
    });
    return {
      dice,
      successes: Math.max(0, rawSuccesses),
      botch:     rawSuccesses <= 0 && ones > 0
    };
  };

  el.querySelector?.(".btn-attacker-reroll")?.addEventListener("click", async () => {
    const attack = message.flags?.exalted2e?.attack;
    if (!attack || !attack.defense) return;
    const attacker = game.actors.get(attack.actorId);
    if (!attacker?.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
      return;
    }

    // Find the attacker's Third Excellency charm so we pay its actual cost
    // (motes + willpower) rather than a hard-coded value.
    const thirdExcCharm = attacker.items.find(c =>
      c.type === "charm" &&
      c.system.excellency === "third" &&
      c.system.ability === attack.attackerExcKey
    );
    if (!thirdExcCharm) return;
    const ok = await thirdExcCharm.activateCharm();
    if (!ok) return;

    const newDice = attack.dice.map(d => ({ ...d }));
    const failIdxs = newDice
      .map((d, i) => d.face < 7 ? i : -1)
      .filter(i => i >= 0);

    if (failIdxs.length > 0) {
      const roll = new Roll(`${failIdxs.length}d10`);
      await roll.evaluate();
      const faces = roll.terms[0].results.map(r => r.result);
      failIdxs.forEach((idx, i) => { newDice[idx].face = faces[i]; });
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        flavor:  `${game.i18n.localize("EX2E.ThirdExcellency")} — ${game.i18n.localize("EX2E.AttackRoll")}`,
        sound:   CONFIG.sounds.dice
      });
    }

    const { dice: finalDice, successes, botch } = recomputeDiceStats(newDice);
    const newAttack = {
      ...attack,
      dice:      finalDice,
      successes,
      botch,
      thirdExcUsedByAttacker: true
    };
    const { renderAttackCardContent } = await import("./rolls/exalted-roll.mjs");
    const content = await renderAttackCardContent(newAttack);
    await message.update({
      content,
      flags: { exalted2e: { attack: newAttack } }
    });
  });

  // ── Step 5: Defender Third-Excellency DV bump ────────────────────────
  // Defender spends 4m to add floor(ability / 2) to their committed DV.
  // The ability is whichever was used to defend (dodge / melee / MA, or
  // dexterity for Lunars & Alchemicals) — stored as `defenderExcKey`.
  el.querySelector?.(".btn-defender-reroll")?.addEventListener("click", async () => {
    const attack = message.flags?.exalted2e?.attack;
    if (!attack || !attack.defense) return;
    const defender = game.actors.get(attack.targetId);
    if (!defender?.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
      return;
    }
    // Find the defender's Third Excellency charm so we pay its actual cost
    // (motes + willpower) rather than a hard-coded value.
    const thirdExcCharm = defender.items.find(c =>
      c.type === "charm" &&
      c.system.excellency === "third" &&
      c.system.ability === attack.defenderExcKey
    );
    if (!thirdExcCharm) return;
    const ok = await thirdExcCharm.activateCharm();
    if (!ok) return;

    // Resolve the ability value from the key captured at defense-commit.
    const sys = defender.system;
    const key = attack.defenderExcKey;
    const abilityValue = sys.attributes?.[key]?.value
                      ?? sys.abilities?.[key]?.value
                      ?? 0;
    const dvBonus = Math.floor(abilityValue / 2);

    const newAttack = {
      ...attack,
      defense: { ...attack.defense, dv: (attack.defense.dv ?? 0) + dvBonus },
      thirdExcUsedByDefender: true
    };
    const { renderAttackCardContent } = await import("./rolls/exalted-roll.mjs");
    const content = await renderAttackCardContent(newAttack);
    await message.update({
      content,
      flags: { exalted2e: { attack: newAttack } }
    });
  });

  // ── Skip-step buttons ────────────────────────────────────────────────
  // Attacker skips Step 4 (no Third-Exc reroll); defender skips Step 5 (no
  // DV bump). Advancing either flag lets renderAttackCardContent unlock
  // the next step or the final hit/miss/damage section.
  el.querySelector?.(".btn-attacker-pass")?.addEventListener("click", async () => {
    const attack = message.flags?.exalted2e?.attack;
    if (!attack || !attack.defense) return;
    const attacker = game.actors.get(attack.actorId);
    if (!attacker?.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
      return;
    }
    const newAttack = { ...attack, step4Passed: true };
    const { renderAttackCardContent } = await import("./rolls/exalted-roll.mjs");
    const content = await renderAttackCardContent(newAttack);
    await message.update({
      content,
      flags: { exalted2e: { attack: newAttack } }
    });
  });

  el.querySelector?.(".btn-defender-pass")?.addEventListener("click", async () => {
    const attack = message.flags?.exalted2e?.attack;
    if (!attack || !attack.defense) return;
    const defender = game.actors.get(attack.targetId);
    if (!defender?.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
      return;
    }
    const newAttack = { ...attack, step5Passed: true };
    const { renderAttackCardContent } = await import("./rolls/exalted-roll.mjs");
    const content = await renderAttackCardContent(newAttack);
    await message.update({
      content,
      flags: { exalted2e: { attack: newAttack } }
    });
  });

  // ── Step 9: Counterattack ────────────────────────────────────────────
  // Defender activates a Counterattack-keyword charm and fires a reflexive
  // attack back at the original attacker. The resulting attack card is
  // flagged `isCounterattack` so it doesn't offer its own Step 9.
  el.querySelector?.(".btn-counterattack")?.addEventListener("click", async () => {
    const attack = message.flags?.exalted2e?.attack;
    if (!attack || !attack.defense) return;
    const defender = game.actors.get(attack.targetId);
    if (!defender?.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
      return;
    }
    const originalAttacker = game.actors.get(attack.actorId);
    if (!originalAttacker) {
      ui.notifications.warn(game.i18n.format("EX2E.OriginalAttackerNotFound", { id: attack.actorId }));
      return;
    }

    const charms = defender.items.filter(i =>
      i.type === "charm" && (i.system.keywords ?? []).includes("Counterattack")
    );
    const equippedWeapons = defender.items.filter(i =>
      i.type === "weapon" && i.system.equipped
    );
    const weaponModes = equippedWeapons.flatMap(w =>
      (w.system.modes ?? []).map((mode, idx) => ({
        weaponId:  w.id,
        modeIndex: idx,
        label:     (w.system.modes.length > 1) ? `${w.name} — ${mode.name}` : w.name
      }))
    );

    const { CounterattackDialog } = await import("./dialogs/counterattack-dialog.mjs");
    const result = await CounterattackDialog.prompt({
      charms,
      weaponModes,
      targetName: originalAttacker.name
    });
    if (!result) return;

    const charm = defender.items.get(result.charmId);
    if (!charm) return;
    const ok = await charm.activateCharm();
    if (!ok) return;

    // Fire the counterattack. It will post its own attack card, flagged so
    // it can't recursively offer Step 9 on itself.
    const { ExaltedRoll } = await import("./rolls/exalted-roll.mjs");
    const counterMessage = await ExaltedRoll.rollAttack(defender, result.weaponId, {
      modeIndex:               result.modeIndex,
      isCounterattack:         true,
      originalAttackMessageId: message.id,
      explicitTargetActor:     originalAttacker
    });

    // Mark the original attack as having triggered its counterattack so the
    // Step 9 buttons disappear and Roll Damage unlocks.
    const newAttack = {
      ...attack,
      counterattackTriggered: true,
      counterattackMessageId: counterMessage?.id ?? null,
      counterattackCharm:     charm.name
    };
    const { renderAttackCardContent } = await import("./rolls/exalted-roll.mjs");
    const content = await renderAttackCardContent(newAttack);
    await message.update({
      content,
      flags: { exalted2e: { attack: newAttack } }
    });
  });

  el.querySelector?.(".btn-skip-counterattack")?.addEventListener("click", async () => {
    const attack = message.flags?.exalted2e?.attack;
    if (!attack || !attack.defense) return;
    const defender = game.actors.get(attack.targetId);
    if (!defender?.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.DefenseNotAllowed"));
      return;
    }
    const newAttack = { ...attack, step9Passed: true };
    const { renderAttackCardContent } = await import("./rolls/exalted-roll.mjs");
    const content = await renderAttackCardContent(newAttack);
    await message.update({
      content,
      flags: { exalted2e: { attack: newAttack } }
    });
  });

  // "Roll Damage" button on attack result cards
  el.querySelector?.(".btn-roll-damage")?.addEventListener("click", async (event) => {
    const card       = event.currentTarget.closest(".ex2e-attack-card");
    const damagePool = parseInt(card?.dataset.damagePool) || 0;
    const damageType = card?.dataset.damageType || "lethal";
    const overwhelming = parseInt(card?.dataset.overwhelming) || 0;
    const soakEl     = card?.querySelector(".soak-input");
    const soak       = parseInt(soakEl?.value ?? soakEl?.textContent) || 0;
    const targetId   = card?.dataset.targetId || null;

    if (damagePool <= 0) return;

    // Roll the damage pool
    const effectivePool = Math.max(damagePool - soak, overwhelming);
    const formula = `${effectivePool}d10`;
    const roll    = new Roll(formula);
    await roll.evaluate();

    // Fire the standard dice-roll feedback: Dice So Nice 3D animation
    // when the module is installed, and the vanilla dice sound otherwise
    // (DSN suppresses the sound automatically). Without this the damage
    // roll feels silent because the result is spliced into an existing
    // chat card rather than posted as its own roll message.
    if (game.dice3d?.showForRoll) {
      await game.dice3d.showForRoll(roll, game.user, true);
    } else {
      const audio = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
      audio?.play({
        src:      CONFIG.sounds.dice,
        volume:   game.settings.get("core", "globalInterfaceVolume") ?? 0.8,
        autoplay: true,
        loop:     false
      }, true);
    }

    const dice = roll.terms[0].results.map(r => r.result);
    let rawDamage = 0;
    const diceDetails = [];
    for (const face of dice) {
      let succs = 0;
      let cls   = "";
      if (face === 10)       { succs = 2; cls = "double-success"; rawDamage += 2; }
      else if (face >= 7)    { succs = 1; cls = "success";        rawDamage += 1; }
      else if (face === 1)   { cls = "one"; }
      else                   { cls = "miss"; }
      diceDetails.push({ face, succs, cls });
    }

    const damageTypeLabel = damageType === "lethal" ? "L" : damageType === "aggravated" ? "A" : "B";

    // Render the damage result
    const section = card.querySelector(".damage-roll-section");
    if (section) {
      let diceHtml = diceDetails.map(d =>
        `<div class="die-result ${d.cls}" title="${d.face}">${d.face}</div>`
      ).join("");

      const autoApply = game.settings.get("exalted2e", "autoApplyDamage");
      const showApplyBtn = rawDamage > 0 && targetId && !autoApply;
      const result = new DOMParser().parseFromString(`<div class="damage-result">
        <div class="dice-results">${diceHtml}</div>
        <div class="damage-summary">
          <span>${effectivePool}d10 (${damagePool} − ${soak} ${game.i18n.localize("EX2E.Soak")})</span>
        </div>
        <div class="roll-result ${rawDamage > 0 ? 'success' : 'failure'}">
          <span class="result-label ${rawDamage > 0 ? 'success' : 'failure'}-label">
            ${rawDamage > 0 ? `${rawDamage} ${damageTypeLabel} ${game.i18n.localize("EX2E.Damage")}` : game.i18n.localize("EX2E.NoDamage")}
          </span>
        </div>
        ${showApplyBtn ? `<button class="btn-roll btn-apply-damage" data-damage="${rawDamage}" data-damage-type="${damageType}" data-target-id="${targetId}" data-effective-pool="${effectivePool}"><i class="fa-solid fa-heart-crack"></i> ${game.i18n.localize("EX2E.ApplyDamage")}</button>` : ""}
      </div>`, 'text/html');

      section.replaceChildren();
      section.appendChild(result.body.firstChild);
    }

    // Auto-apply damage to target if setting enabled
    if (rawDamage > 0 && targetId && game.settings.get("exalted2e", "autoApplyDamage")) {
      const targetActor = game.actors.get(targetId);
      if (targetActor) {
        await targetActor.applyDamage(rawDamage, damageType);
      }
    }

    // Update the chat message to persist the damage result
    await message.update({ content: card.outerHTML });

    // Chain knockback resolution after the card is persisted (auto-apply only).
    // Order matches the manual-apply path: outer message.update commits the
    // damage result first, then the knockback chain re-renders on top with
    // the knockback / stun resolution sub-blocks.
    if (rawDamage > 0 && targetId && game.settings.get("exalted2e", "autoApplyDamage")) {
      const targetActor = game.actors.get(targetId);
      if (targetActor) {
        await resolveKnockbackChain(message, { effectivePool, rawDamage }).catch(err =>
          console.error("exalted2e | knockback chain failed", err)
        );
      }
    }
  });

  el.querySelector?.(".btn-apply-damage")?.addEventListener("click", async (applyEvent) => {
    const card = applyEvent.currentTarget.closest(".ex2e-attack-card");
    const btn = applyEvent.currentTarget;
    const dmg  = parseInt(btn.dataset.damage) || 0;
    const type = btn.dataset.damageType || "lethal";
    const tId  = btn.dataset.targetId;
    const effectivePool = parseInt(btn.dataset.effectivePool) || 0;
    const targetActor = game.actors.get(tId);
    if (targetActor && dmg > 0) {
      await targetActor.applyDamage(dmg, type);

      const section = card.querySelector(".damage-result");
      section.removeChild(btn);

      await message.update({ content: card.outerHTML });

      await resolveKnockbackChain(message, { effectivePool, rawDamage: dmg }).catch(err =>
        console.error("exalted2e | knockback chain failed", err)
      );
    }
  });

  el.querySelector?.(".btn-knockdown-resist")?.addEventListener("click", async () => {
    await onKnockdownResistClick(message);
  });

  // ── Social attack: defender Step-2 ────────────────────────────────────
  el.querySelector?.(".btn-social-step2")?.addEventListener("click", async (ev) => {
    await _resolveSocialAttackStep2(message);
  });

  // ── Social attack: Spend WP to resist ─────────────────────────────────
  el.querySelector?.(".btn-social-resist")?.addEventListener("click", async (ev) => {
    const record = message.flags?.exalted2e?.socialAttack;
    if (!record || record.resolution || record.reversed) return;

    const defender = game.actors.get(record.defenderId);
    if (!defender) return;
    if (!game.user.isGM && !defender.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
      return;
    }

    const wp = record.wpToResist;
    const current = defender.system?.willpower?.value ?? 0;
    if (current < wp) {
      ui.notifications.warn(game.i18n.localize("EX2E.InsufficientWillpower"));
      return;
    }

    await defender.update({ "system.willpower.value": current - wp });
    await message.update({
      "flags.exalted2e.socialAttack.resolution": {
        outcome:                       "resisted",
        wpSpentByDefender:             wp,
        erodedIntimacyId:              null,
        erodedIntimacyStrengthBefore:  null,
        erodedIntimacyStrengthAfter:   null,
        erodedIntimacyName:            null
      }
    });

    // Limit accrual: only for splats that use the classic Limit mechanic.
    // Other anti-virtue tracks (Resonance/Torment/Clarity) accrue from
    // their own splat-specific triggers, NOT from resisting unnatural
    // influence. Mortals have no Limit field worth ticking. The wp > 0
    // gate is intentional — a future motes-resist charm path (e.g.,
    // Solar Integrity-Protecting Prana) will set wp = 0 and skip this
    // block automatically, with no Limit accrued.
    if (record.unnaturalInfluence
        && wp > 0
        && defender.type === "character"
        && EX2E.LIMIT_ACCRUAL_SPLATS.includes(defender.system.exaltType)) {
      const sceneFlags    = defender.flags?.exalted2e?.socialScene ?? {};
      const attackerEntry = sceneFlags[record.attackerId] ?? {};
      if (!attackerEntry.unnaturalLimitGranted) {
        const currentLimit = defender.system.limit ?? 0;
        await defender.update({
          "system.limit": Math.min(10, currentLimit + 1),
          [`flags.exalted2e.socialScene.${record.attackerId}.unnaturalLimitGranted`]: true
        });
        ui.notifications.info(
          game.i18n.format("EX2E.LimitAccruedFromUnnatural", { actor: defender.name })
        );
      }
    }

    // Natural-influence WP drain counter: tracks cumulative WP this
    // attacker has drained from this defender via NON-charm social
    // attacks this scene. Once it reaches 2, future natural attacks
    // auto-fail at resolution (handled in rollSocialAttack).
    if (!record.unnaturalInfluence && wp > 0) {
      const sceneFlags = defender.flags?.exalted2e?.socialScene ?? {};
      const entry      = sceneFlags[record.attackerId] ?? {};
      const drained    = (entry.wpDrainedNatural ?? 0) + wp;
      await defender.update({
        [`flags.exalted2e.socialScene.${record.attackerId}.wpDrainedNatural`]: drained
      });
    }

    await _rerenderSocialAttackCard(message);
  });

  // ── Social attack: Accept ─────────────────────────────────────────────
  el.querySelector?.(".btn-social-accept")?.addEventListener("click", async (ev) => {
    const record = message.flags?.exalted2e?.socialAttack;
    if (!record || record.resolution || record.reversed) return;

    const defender = game.actors.get(record.defenderId);
    if (!defender) return;
    if (!game.user.isGM && !defender.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
      return;
    }

    if (record.intent === "erode") {
      const hasIntimacies = defender.items.some(i => i.type === "intimacy");
      if (!hasIntimacies) {
        const appliedInfluenceEffectIds = await applySocialInfluenceEffects(defender, {
          attackerId:      record.attackerId,
          sourceByKeyword: record.attackerSourceByKeyword ?? {},
          keywords:        record.attackerCharmKeywords  ?? []
        });
        await message.update({
          "flags.exalted2e.socialAttack.resolution": {
            outcome:                       "accepted-narration",
            wpSpentByDefender:             0,
            erodedIntimacyId:              null,
            erodedIntimacyStrengthBefore:  null,
            erodedIntimacyStrengthAfter:   null,
            erodedIntimacyName:            null
          },
          "flags.exalted2e.socialAttack.appliedInfluenceEffectIds": appliedInfluenceEffectIds
        });
      } else {
        await message.update({ "flags.exalted2e.socialAttack.pendingErodePick": true });
      }
    } else {
      const appliedInfluenceEffectIds = await applySocialInfluenceEffects(defender, {
        attackerId:      record.attackerId,
        sourceByKeyword: record.attackerSourceByKeyword ?? {},
        keywords:        record.attackerCharmKeywords  ?? []
      });
      await message.update({
        "flags.exalted2e.socialAttack.resolution": {
          outcome:                       "accepted-narration",
          wpSpentByDefender:             0,
          erodedIntimacyId:              null,
          erodedIntimacyStrengthBefore:  null,
          erodedIntimacyStrengthAfter:   null,
          erodedIntimacyName:            null
        },
        "flags.exalted2e.socialAttack.appliedInfluenceEffectIds": appliedInfluenceEffectIds
      });
    }
    await _rerenderSocialAttackCard(message);
  });

  // ── Social attack: Pick an Intimacy to erode ──────────────────────────
  el.querySelector?.(".btn-social-erode-confirm")?.addEventListener("click", async (ev) => {
    const record = message.flags?.exalted2e?.socialAttack;
    if (!record || record.resolution || record.reversed) return;

    const defender = game.actors.get(record.defenderId);
    if (!defender) return;
    if (!game.user.isGM && !defender.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
      return;
    }

    const select = el.querySelector(".social-erode-select");
    const intimacyId = select?.value;
    const intimacy = intimacyId ? defender.items.get(intimacyId) : null;
    if (!intimacy) return;

    const before = intimacy.system?.strength ?? 0;
    const after = Math.max(0, before - 1);
    await intimacy.update({ "system.strength": after });

    const appliedInfluenceEffectIds = await applySocialInfluenceEffects(defender, {
      attackerId:      record.attackerId,
      sourceByKeyword: record.attackerSourceByKeyword ?? {},
      keywords:        record.attackerCharmKeywords  ?? []
    });
    await message.update({
      "flags.exalted2e.socialAttack.resolution": {
        outcome:                       "accepted-eroded",
        wpSpentByDefender:             0,
        erodedIntimacyId:              intimacy.id,
        erodedIntimacyStrengthBefore:  before,
        erodedIntimacyStrengthAfter:   after,
        erodedIntimacyName:            intimacy.name
      },
      "flags.exalted2e.socialAttack.appliedInfluenceEffectIds": appliedInfluenceEffectIds
    });
    await message.update({ "flags.exalted2e.socialAttack.pendingErodePick": false });
    await _rerenderSocialAttackCard(message);
  });

  // ── Social attack: Reverse ────────────────────────────────────────────
  el.querySelector?.(".btn-social-reverse")?.addEventListener("click", async (ev) => {
    const record = message.flags?.exalted2e?.socialAttack;
    if (!record || record.reversed) return;
    const resolution = record.resolution;
    if (!resolution) {
      ui.notifications.warn(game.i18n.localize("EX2E.NothingToReverse"));
      return;
    }

    const attacker = game.actors.get(record.attackerId);
    if (!attacker) return;
    if (!game.user.isGM && !attacker.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
      return;
    }

    const defender = game.actors.get(record.defenderId);

    // Refund defender WP (existing 3a behavior — only meaningful for the
    // "resisted" outcome; perfect-defended and resisted-via-motes both
    // store wpSpentByDefender = 0).
    if (defender && resolution.wpSpentByDefender > 0) {
      const current = defender.system?.willpower?.value ?? 0;
      const max = defender.system?.willpower?.max ?? 10;
      const restored = Math.min(max, current + resolution.wpSpentByDefender);
      await defender.update({ "system.willpower.value": restored });
    }

    // Refund eroded intimacy strength (existing 3a).
    if (defender && resolution.erodedIntimacyId && resolution.erodedIntimacyStrengthBefore !== null) {
      const intimacy = defender.items.get(resolution.erodedIntimacyId);
      if (intimacy) {
        await intimacy.update({ "system.strength": resolution.erodedIntimacyStrengthBefore });
      }
    }

    // 3b addition: refund defender Excellency motes back to the same pools.
    const mb = record.defenderMoteSpend;
    if (defender && mb && (mb.fromPrimary > 0 || mb.fromSecondary > 0)) {
      const primary   = defender.system.motes?.[mb.primaryPool]   ?? { value: 0, max: 0 };
      const secondary = defender.system.motes?.[mb.secondaryPool] ?? { value: 0, max: 0 };
      await defender.update({
        [`system.motes.${mb.primaryPool}.value`]:
          Math.min(primary.max ?? 0, (primary.value ?? 0) + (Number(mb.fromPrimary) || 0)),
        [`system.motes.${mb.secondaryPool}.value`]:
          Math.min(secondary.max ?? 0, (secondary.value ?? 0) + (Number(mb.fromSecondary) || 0))
      });
    }

    // 3c-1: refund attacker Excellency motes (per-pool, capped at max).
    if (record.attackerExcMoteCost > 0) {
      const pool    = record.attackerMoteType === "personal" ? "personal" : "peripheral";
      const current = attacker.system?.motes?.[pool]?.value ?? 0;
      const max     = attacker.system?.motes?.[pool]?.max   ?? current;
      const capped  = Math.min(max, current + record.attackerExcMoteCost);
      await attacker.update({ [`system.motes.${pool}.value`]: capped });
    }

    // 3c-1: clear marker AEs stamped on Accept.
    if (defender && Array.isArray(record.appliedInfluenceEffectIds) && record.appliedInfluenceEffectIds.length > 0) {
      await clearSocialInfluenceEffects(defender, record.appliedInfluenceEffectIds);
    }

    // 3c-2: refund permanent Willpower if the defender refused this attack
    if (defender && record.defenderPermWpDelta) {
      const w = defender.system?.willpower ?? { max: 0, value: 0 };
      const restored = applyRefundMath(
        w.max ?? 0,
        w.value ?? 0,
        record.defenderPermWpDelta.valueDelta ?? 0
      );
      await defender.update({
        "system.willpower.max":   restored.max,
        "system.willpower.value": restored.value
      }, { bypassPurchaseLock: true });
      // Decrement campaign successfulHits + defenderPermWpSpent
      const attackerId = record.attackerId;
      const existing   = defender.flags?.exalted2e?.motivationBreaks?.[attackerId];
      if (existing) {
        await defender.update({
          [`flags.exalted2e.motivationBreaks.${attackerId}.successfulHits`]:
            Math.max(0, (existing.successfulHits ?? 0) - 1),
          [`flags.exalted2e.motivationBreaks.${attackerId}.defenderPermWpSpent`]:
            Math.max(0, (existing.defenderPermWpSpent ?? 0) - 1)
        });
      }
    }

    // 3c-2: restore the broken motivation if this attack broke it
    if (defender && record.brokenInThisAttack) {
      await defender.update({ "system.motivation": record.brokenFromMotivation ?? "" });
      const attackerId = record.attackerId;
      const existing   = defender.flags?.exalted2e?.motivationBreaks?.[attackerId];
      if (existing) {
        await defender.update({
          [`flags.exalted2e.motivationBreaks.${attackerId}.status`]: "active",
          [`flags.exalted2e.motivationBreaks.${attackerId}.successfulHits`]:
            Math.max(0, (existing.successfulHits ?? 0) - 1)
        });
      }
    }

    // 3c-2: decrement campaign attemptCount (this attack is being unwound entirely).
    // If attemptCount reaches 0, unset the campaign flag entirely.
    if (defender && record.isMotivationBreak) {
      const attackerId = record.attackerId;
      const existing   = defender.flags?.exalted2e?.motivationBreaks?.[attackerId];
      if (existing) {
        const newCount = Math.max(0, (existing.attemptCount ?? 0) - 1);
        if (newCount === 0) {
          await defender.update({
            [`flags.exalted2e.motivationBreaks.-=${attackerId}`]: null
          });
        } else {
          await defender.update({
            [`flags.exalted2e.motivationBreaks.${attackerId}.attemptCount`]: newCount
          });
        }
      }
    }

    // Mark reversed AND reset Step-2 / resolution so the card returns to
    // step2-pending (the user can re-resolve). Per-charm activations
    // posted during Step-2 have their own Reverse buttons — NOT auto-
    // reversed here, mirroring physical Step-2 behavior.
    await message.update({
      "flags.exalted2e.socialAttack.reversed":                  true,
      "flags.exalted2e.socialAttack.step2Resolved":             false,
      "flags.exalted2e.socialAttack.step2Result":               null,
      "flags.exalted2e.socialAttack.defenderCharmIds":          [],
      "flags.exalted2e.socialAttack.defenderMoteSpend":         null,
      "flags.exalted2e.socialAttack.effectiveMDV":              null,
      "flags.exalted2e.socialAttack.hit":                       null,
      "flags.exalted2e.socialAttack.wpToResist":                null,
      "flags.exalted2e.socialAttack.perfectDefense":            false,
      "flags.exalted2e.socialAttack.motesResistApplied":        false,
      "flags.exalted2e.socialAttack.resolution":                null,
      "flags.exalted2e.socialAttack.appliedInfluenceEffectIds": [],
      "flags.exalted2e.socialAttack.defenderPermWpDelta":       null,
      "flags.exalted2e.socialAttack.brokenInThisAttack":        false,
      "flags.exalted2e.socialAttack.brokenFromMotivation":      null
    });
    await _rerenderSocialAttackCard(message);
  });

  // ── Social attack: Refuse Motivation Break ─────────────────────────────
  el.querySelector?.(".btn-motivation-refuse")?.addEventListener("click", async (ev) => {
    const record = message.flags?.exalted2e?.socialAttack;
    if (!record || !record.isMotivationBreak) return;
    if (record.resolution || record.reversed) return;

    const defender = game.actors.get(record.defenderId);
    if (!defender) return;
    if (!game.user.isGM && !defender.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
      return;
    }

    const w = defender.system?.willpower ?? { max: 0, value: 0 };
    if ((w.max ?? 0) <= 0) {
      ui.notifications.warn(game.i18n.localize("EX2E.MotivationBreakNoPermWp"));
      return;
    }

    const before = { max: w.max, value: w.value };
    const after  = applyRefusalMath(before.max, before.value);
    const delta  = {
      maxDelta:   after.max   - before.max,
      valueDelta: after.value - before.value
    };

    await defender.update({
      "system.willpower.max":   after.max,
      "system.willpower.value": after.value
    }, { bypassPurchaseLock: true });

    // Bump campaign tracker successfulHits + defenderPermWpSpent
    const attackerId = record.attackerId;
    const existing   = defender.flags?.exalted2e?.motivationBreaks?.[attackerId];
    if (existing) {
      await defender.update({
        [`flags.exalted2e.motivationBreaks.${attackerId}.successfulHits`]:
          (existing.successfulHits ?? 0) + 1,
        [`flags.exalted2e.motivationBreaks.${attackerId}.defenderPermWpSpent`]:
          (existing.defenderPermWpSpent ?? 0) + 1
      });
    }

    await message.update({
      "flags.exalted2e.socialAttack.defenderPermWpDelta": delta,
      "flags.exalted2e.socialAttack.resolution": {
        outcome:                       "break-refused",
        wpSpentByDefender:             0,
        erodedIntimacyId:              null,
        erodedIntimacyStrengthBefore:  null,
        erodedIntimacyStrengthAfter:   null,
        erodedIntimacyName:            null
      }
    });
    await _rerenderSocialAttackCard(message);
  });

  // ── Social attack: Break Motivation ────────────────────────────────────
  el.querySelector?.(".btn-motivation-break")?.addEventListener("click", async (ev) => {
    const record = message.flags?.exalted2e?.socialAttack;
    if (!record || !record.isMotivationBreak) return;
    if (record.resolution || record.reversed) return;

    const defender = game.actors.get(record.defenderId);
    if (!defender) return;
    if (!game.user.isGM && !defender.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
      return;
    }

    const brokenFromMotivation = defender.system?.motivation ?? "";
    const targetMotivation     = record.targetMotivation ?? "";

    // Flip the defender's motivation
    await defender.update({ "system.motivation": targetMotivation });

    // Mark campaign as broken + bump successfulHits
    const attackerId = record.attackerId;
    const existing   = defender.flags?.exalted2e?.motivationBreaks?.[attackerId];
    if (existing) {
      await defender.update({
        [`flags.exalted2e.motivationBreaks.${attackerId}.status`]:         "broken",
        [`flags.exalted2e.motivationBreaks.${attackerId}.successfulHits`]:
          (existing.successfulHits ?? 0) + 1
      });
    }

    await message.update({
      "flags.exalted2e.socialAttack.brokenInThisAttack":   true,
      "flags.exalted2e.socialAttack.brokenFromMotivation": brokenFromMotivation,
      "flags.exalted2e.socialAttack.resolution": {
        outcome:                       "broken",
        wpSpentByDefender:             0,
        erodedIntimacyId:              null,
        erodedIntimacyStrengthBefore:  null,
        erodedIntimacyStrengthAfter:   null,
        erodedIntimacyName:            null
      }
    });
    await _rerenderSocialAttackCard(message);
  });

  // ── Act of Villainy: player rolls the virtue pool ─────────────────────
  const aovCard = el.querySelector?.(".ex2e-act-of-villainy-card");
  if (aovCard) {
    const aov = message.flags?.exalted2e?.actOfVillainy;
    if (aov && !aov.rolled) {
      aovCard.querySelector("[data-action='rollActOfVillainy']")
        ?.addEventListener("click", async (ev) => {
          const btn = ev.currentTarget;
          if (btn.disabled) return;
          btn.disabled = true;

          const actor = game.actors.get(aov.actorId);
          if (!actor?.isOwner) {
            ui.notifications.warn(game.i18n.localize("EX2E.NotOwner"));
            btn.disabled = false;
            return;
          }

          try {
            const { ExaltedRoll } = await import("./rolls/exalted-roll.mjs");
            const roll   = new ExaltedRoll({
              pool:      aov.pool,
              stunt:     aov.stunt,
              actorName: aov.actorName,
              flavor:    game.i18n.localize("EX2E.SplatActOfVillainy")
            });
            const result = await roll.evaluate();
            await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
            await _resolveActOfVillainy(message, result.successes);
          } catch (err) {
            console.error("exalted2e | Act of Villainy roll failed", err);
            btn.disabled = false;
          }
        });
    }

    if (aov?.rolled) {
      const btn = aovCard.querySelector("[data-action='rollActOfVillainy']");
      if (btn) btn.disabled = true;
    }
  }

  // ── Oath Botch button (GM-only) ───────────────────────────────────────
  // Injects an "Oath Botch (N)" button into any roll card whose speaker
  // is an actor carrying at least one oathBotch AE. N = highest
  // bindingEssence across all oathBotch AEs on that actor.
  if (game.user.isGM) {
    const speakerActor = game.actors.get(message.speaker?.actor);
    if (speakerActor) {
      const oathAEs = speakerActor.effects.filter(
        e => e.flags?.exalted2e?.oathBotch != null
      );
      if (oathAEs.length > 0) {
        const n = Math.max(...oathAEs.map(e => e.flags.exalted2e.oathBotch.bindingEssence));
        const descriptions = oathAEs
          .map(e => e.flags.exalted2e.oathBotch.description || game.i18n.localize("EX2E.SacredOath"))
          .join("; ");

        const btn = document.createElement("button");
        btn.className = "btn-roll btn-oath-botch";
        btn.textContent = game.i18n.format("EX2E.OathBotchButton", { n });
        el.appendChild(btn);

        btn.addEventListener("click", async () => {
          const title = `${game.i18n.localize("EX2E.OathBotchCardTitle")} — ${speakerActor.name}`;
          const body  = game.i18n.format("EX2E.OathBotchCardBody", { n });
          await ChatMessage.create({
            content: `<div class="ex2e-oath-botch-card"><h3>${title}</h3><p><em>${descriptions}</em></p><p>${body}</p></div>`,
            flags: {
              exalted2e: {
                oathBotchApplied: { actorId: speakerActor.id, bindingEssence: n, description: descriptions }
              }
            }
          });
        });
      }
    }
  }
});

// ── Auto-clear social-scene state on combat deletion ──────────────────────
// `endCombat()` (overridden in ExaltedCombat) handles the normal "End
// Combat" button flow. This hook covers the parallel path where a GM
// deletes the combat document directly — both routes funnel through
// the same `clearSocialScene` helper.
Hooks.on("deleteCombat", async () => {
  const { clearSocialScene } = await import("./ui/social-scene.mjs");
  await clearSocialScene({ silent: true });
});

// ── Social attack: defender Step-2 orchestrator ──────────────────────────
/**
 * Open the Step-2 social-defense dialog, apply the defender's choices
 * (charm activations, Excellency mote spend, perfect-defense / motes-resist
 * keyword detection), and update the chat-card flags with the resolved
 * hit/wpToResist outcome. Triggers a card rerender at the end.
 */
async function _resolveSocialAttackStep2(message) {
  const record = message.flags?.exalted2e?.socialAttack;
  // Re-defend after Reverse is allowed: Task 8 resets `step2Resolved` to
  // false but leaves `reversed: true` as a visual indicator. The atomic
  // update below clears `reversed` when the new outcome stamps over the
  // prior one. Bail only on missing record or already-resolved Step-2.
  if (!record || record.step2Resolved) return;

  const defender = game.actors.get(record.defenderId);
  if (!defender) return;
  if (!game.user.isGM && !defender.testUserPermission(game.user, "OWNER")) {
    ui.notifications.warn(game.i18n.localize("EX2E.NotOwnerSocial"));
    return;
  }

  // Collect candidate charms: defender's Reflexive Step-2 charms whose
  // ability is one of the social-defense kit OR carry a Step-2 social
  // keyword. Heuristic — refines in 3c when keywords drive attacker
  // tagging.
  const SOCIAL_DEFENSE_ABILITIES = new Set([
    "integrity", "presence", "performance", "investigation", "bureaucracy"
  ]);
  const STEP2_KEYWORDS = new Set([
    "Perfect Mental Defense", "Resist Unnatural Mental Influence"
  ]);
  const candidates = defender.items.filter(i => {
    if (i.type !== "charm") return false;
    if (i.system?.charmType !== "reflexive") return false;
    if (!(i.system?.steps ?? []).includes(2)) return false;
    const ability = i.system?.ability ?? "";
    if (SOCIAL_DEFENSE_ABILITIES.has(ability)) return true;
    const kws = i.system?.keywords ?? [];
    return kws.some(k => STEP2_KEYWORDS.has(k));
  });

  // Excellency wiring: same pattern as the attacker AttackDialog.
  const exaltType   = defender.system?.exaltType ?? "";
  const isAttrBased = exaltType === "lunar" || exaltType === "alchemical";
  const allCharms   = defender.items.filter(i => i.type === "charm");
  const excKey      = isAttrBased
    ? (record.intent === "erode" ? "manipulation" : "stamina")
    : (record.intent === "erode" ? "presence"     : "integrity");
  const firstExc    = allCharms.find(c => c.system.excellency === "first"  && c.system.ability === excKey);
  const secondExc   = allCharms.find(c => c.system.excellency === "second" && c.system.ability === excKey);

  const { firstExcMax, secondExcMax } = computeMdvExcellencyCaps(record.intent, defender);

  const dialogResult = await Step2SocialDefenseDialog.prompt({
    charms:            candidates,
    intent:            record.intent,
    defenderMDV:       record.preStep2EffectiveMDV ?? 0,
    attackerSuccesses: record.rollSuccesses ?? 0,
    targetName:        defender.name,
    excellency:        { first: !!firstExc, second: !!secondExc },
    firstExcMax,
    secondExcMax,
    firstExcLabel:     firstExc?.name  ?? game.i18n.localize("EX2E.FirstExcellency"),
    secondExcLabel:    secondExc?.name ?? game.i18n.localize("EX2E.SecondExcellency")
  });
  if (!dialogResult) return;       // cancelled — card stays in step2-pending

  // Activate each selected charm via the standard activation pipeline —
  // each charm posts its own card with its own Reverse button.
  const activatedKeywords = new Set();
  const activatedCharmIds = [];
  for (const charmId of dialogResult.charmIds) {
    const charm = defender.items.get(charmId);
    if (!charm) continue;
    await charm.activateCharm({ skipXpConfirm: true, via: "step2-social" });
    activatedCharmIds.push(charmId);
    for (const kw of (charm.system?.keywords ?? [])) {
      activatedKeywords.add(kw);
    }
  }

  // Spend defender Excellency motes. firstExcDice = 1m each, secondExcSucc
  // = 2m each. Use defender.spendMotes for the per-pool breakdown so the
  // Reverse handler can refund accurately.
  const totalMoteCost = (dialogResult.firstExcDice ?? 0) + (dialogResult.secondExcSucc ?? 0) * 2;
  let defenderMoteSpend = null;
  if (totalMoteCost > 0) {
    defenderMoteSpend = await defender.spendMotes(totalMoteCost, dialogResult.moteType);
    // spendMotes emits EX2E.NotEnoughMotes itself on failure; just bail.
    if (!defenderMoteSpend) return;
  }

  // Resolve the Step-2 outcome.
  const resolved = resolveStep2({
    rollSuccesses:           record.rollSuccesses,
    baseMDV:                 record.baseMDV,
    stackingMod:             record.stackingMod,
    mdvShiftFromApp:         record.mdvShiftFromApp,
    isUnnatural:             record.unnaturalInfluence,
    autoFailedByNaturalCap:  record.autoFailedByNaturalCap,
    firstExcDice:            dialogResult.firstExcDice  ?? 0,
    secondExcSucc:           dialogResult.secondExcSucc ?? 0,
    activatedKeywords,
    umiCostSum:              record.umiCostSum ?? 0
  });

  // Auto-stamp resolution for perfect-defense and motes-resist outcomes.
  let resolution = null;
  if (resolved.perfectDefense) {
    resolution = {
      outcome:                       "perfect-defended",
      wpSpentByDefender:             0,
      erodedIntimacyId:              null,
      erodedIntimacyStrengthBefore:  null,
      erodedIntimacyStrengthAfter:   null,
      erodedIntimacyName:            null
    };
  } else if (resolved.motesResistApplied && resolved.hit) {
    resolution = {
      outcome:                       "resisted-via-motes",
      wpSpentByDefender:             0,
      erodedIntimacyId:              null,
      erodedIntimacyStrengthBefore:  null,
      erodedIntimacyStrengthAfter:   null,
      erodedIntimacyName:            null
    };
  }

  // Update the chat-card flags in one atomic write. `reversed: false`
  // is included so re-defending after a Reverse correctly clears the
  // "reversed" indicator from the prior outcome (Task 8 sets reversed
  // to true on Reverse — this resets it to a fresh state).
  const updates = {
    "flags.exalted2e.socialAttack.reversed":           false,
    "flags.exalted2e.socialAttack.step2Resolved":      true,
    "flags.exalted2e.socialAttack.step2Result":        dialogResult,
    "flags.exalted2e.socialAttack.defenderCharmIds":   activatedCharmIds,
    "flags.exalted2e.socialAttack.defenderMoteSpend":  defenderMoteSpend,
    "flags.exalted2e.socialAttack.effectiveMDV":       resolved.effectiveMDV,
    "flags.exalted2e.socialAttack.hit":                resolved.hit,
    "flags.exalted2e.socialAttack.wpToResist":         resolved.wpToResist,
    "flags.exalted2e.socialAttack.perfectDefense":     resolved.perfectDefense,
    "flags.exalted2e.socialAttack.motesResistApplied": resolved.motesResistApplied
  };
  if (resolution) {
    updates["flags.exalted2e.socialAttack.resolution"] = resolution;
  }
  await message.update(updates);
  await _rerenderSocialAttackCard(message);
}

// ── Social attack re-render helper ─────────────────────────────────────────
/**
 * Re-render the social-attack chat card after a state change. Rebuilds
 * the context by spreading the ledger (which carries the pool-breakdown
 * fields) and re-computing the live
 * permission / affordability / picker flags from current actor state.
 */
async function _rerenderSocialAttackCard(message) {
  const record = message.flags?.exalted2e?.socialAttack;
  if (!record) return;

  const attacker = game.actors.get(record.attackerId);
  const defender = game.actors.get(record.defenderId);
  const pendingErodePick = message.flags?.exalted2e?.socialAttack?.pendingErodePick === true;

  const intimacies = defender
    ? defender.items.filter(i => i.type === "intimacy").map(i => ({
        id:     i.id,
        name:   i.name,
        system: {
          subject:  i.system?.subject  ?? "",
          strength: i.system?.strength ?? 0
        }
      }))
    : [];

  const intentLabel = game.i18n.localize({
    build:  "EX2E.IntentBuild",
    erode:  "EX2E.IntentErode",
    compel: "EX2E.IntentCompel"
  }[record.intent] ?? "EX2E.SocialAttack");

  const cardContext = {
    ...record,
    intentLabel,
    attackerName:     attacker?.name ?? "",
    attackerImg:      attacker?.img  ?? "",
    defenderName:     defender?.name ?? "",
    defenderImg:      defender?.img  ?? "",
    canDefend:        !record.step2Resolved && (game.user.isGM || (defender && defender.testUserPermission(game.user, "OWNER"))),
    canRespond:       game.user.isGM || (defender && defender.testUserPermission(game.user, "OWNER")),
    canAffordResist:  (defender?.system?.willpower?.value ?? 0) >= (record.wpToResist ?? 0),
    canReverse:       game.user.isGM || (attacker && attacker.testUserPermission(game.user, "OWNER")),
    // 3c-2: Motivation-break display flags
    canRefuse: record.isMotivationBreak
            && record.step2Resolved
            && record.hit === true
            && !record.resolution
            && (defender?.system?.willpower?.max ?? 0) > 0
            && (game.user.isGM || (defender && defender.testUserPermission(game.user, "OWNER"))),
    canBreak: record.isMotivationBreak
           && record.step2Resolved
           && record.hit === true
           && !record.resolution
           && (game.user.isGM || (defender && defender.testUserPermission(game.user, "OWNER"))),
    motivationBreakProgressLabel: record.isMotivationBreak
      ? game.i18n.format("EX2E.MotivationBreakChatCampaignProgress", {
          count:  record.campaignAttemptCount ?? 0,
          target: record.targetMotivation     ?? ""
        })
      : "",
    motivationBreakRefusedLabel: record.resolution?.outcome === "break-refused"
      ? game.i18n.format("EX2E.MotivationBreakResolutionRefused", {
          defender: defender?.name ?? ""
        })
      : "",
    motivationBreakBrokenLabel: record.resolution?.outcome === "broken"
      ? game.i18n.format("EX2E.MotivationBreakResolutionBroken", {
          defender: defender?.name ?? "",
          target:   record.targetMotivation ?? ""
        })
      : "",
    defenderIntimacies: intimacies,
    showErodePicker:  record.intent === "erode" && pendingErodePick && !record.resolution,
    // 3c-1: derived display fields for attacker activated charms + Excellency
    attackerCharmNames: (record.attackerCharmIds ?? [])
      .map(id => attacker?.items?.get(id)?.name)
      .filter(n => !!n),
    hasAttackerCharms: (record.attackerCharmIds ?? []).length > 0,
    hasAttackerExcellency: (record.attackerExcMoteCost ?? 0) > 0,
    attackerExcellencyLabel: ((record.attackerExcMoteCost ?? 0) > 0)
      ? game.i18n.format("EX2E.AttackerExcellencyApplied", {
          dice: record.attackerFirstExcDice  ?? 0,
          succ: record.attackerSecondExcSucc ?? 0,
          cost: record.attackerExcMoteCost   ?? 0
        })
      : ""
  };

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/exalted2e/templates/chat/social-attack-card.hbs",
    cardContext
  );
  await message.update({ content });
}
