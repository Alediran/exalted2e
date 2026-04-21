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
import { WeaponData }       from "./data/item/weapon-data.mjs";
import { ArmorData }        from "./data/item/armor-data.mjs";
import { BackgroundData }   from "./data/item/background-data.mjs";
import { IntimacyData }     from "./data/item/intimacy-data.mjs";
import { MeritFlawData }    from "./data/item/meritflaw-data.mjs";
import { KnackData }        from "./data/item/knack-data.mjs";
import { VirtueFlawData }   from "./data/item/virtueflaw-data.mjs";
import { CharacterSheet }   from "./sheets/actor/character-sheet.mjs";
import { NpcSheet }         from "./sheets/actor/npc-sheet.mjs";
import { CharmSheet }       from "./sheets/item/charm-sheet.mjs";
import { WeaponSheet }      from "./sheets/item/weapon-sheet.mjs";
import { ArmorSheet }       from "./sheets/item/armor-sheet.mjs";
import { GenericItemSheet } from "./sheets/item/generic-item-sheet.mjs";
import { KnackSheet }      from "./sheets/item/knack-sheet.mjs";
import { VirtueFlawSheet } from "./sheets/item/virtueflaw-sheet.mjs";
import { registerHandlebarsHelpers } from "./helpers/handlebars.mjs";
import { ActionQuickbar, finishTurnFor } from "./ui/action-quickbar.mjs";

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
    weapon:     WeaponData,
    armor:      ArmorData,
    background: BackgroundData,
    intimacy:   IntimacyData,
    meritflaw:  MeritFlawData,
    knack:      KnackData,
    virtueflaw: VirtueFlawData
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

  // ── Handlebars Helpers ──────────────────────────────────────────────────
  registerHandlebarsHelpers();

  // Pre-load all sheet templates for performance
  _preloadTemplates();

  // ── CONFIG Additions ────────────────────────────────────────────────────
  CONFIG.EX2E = EX2E;

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
    "systems/exalted2e/templates/item/charm/body.hbs",
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
    // Chat / Dialogs
    "systems/exalted2e/templates/chat/roll-result.hbs",
    "systems/exalted2e/templates/chat/item-card.hbs",
    "systems/exalted2e/templates/dialog/roll-dialog.hbs",
    "systems/exalted2e/templates/dialog/add-specialty-dialog.hbs",
    "systems/exalted2e/templates/dialog/attack-dialog.hbs",
    "systems/exalted2e/templates/dialog/step2-defense-dialog.hbs",
    "systems/exalted2e/templates/dialog/counterattack-dialog.hbs",
    "systems/exalted2e/templates/dialog/finish-turn-dialog.hbs",
    "systems/exalted2e/templates/dialog/flurry-declaration-dialog.hbs",
    "systems/exalted2e/templates/dialog/formula-builder-dialog.hbs",
    "systems/exalted2e/templates/dialog/virtueflaw-picker-dialog.hbs",
    "systems/exalted2e/templates/chat/attack-result.hbs",
    "systems/exalted2e/templates/chat/flurry-declared.hbs",
    "systems/exalted2e/templates/chat/action-declared.hbs"
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
  await actor.createEmbeddedDocuments("Item", [_unarmedWeaponData()]);
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
  if (game.users.get(userId)?.isGM) return;
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
  if (charm?.system?.active) await charm.update({ "system.active": false });
});

// ── Ready Hook ─────────────────────────────────────────────────────────────
Hooks.once("ready", async function () {
  console.log("Exalted 2e | System ready.");

  // Action quickbar — one instance per client, refreshed from combat /
  // combatant / active-effect hooks below.
  ActionQuickbar.instance.refresh();
  const qbRefresh = () => ActionQuickbar.instance.refresh();
  Hooks.on("updateCombat",      qbRefresh);
  Hooks.on("createCombat",      qbRefresh);
  Hooks.on("deleteCombat",      qbRefresh);
  Hooks.on("combatStart",       qbRefresh);
  Hooks.on("combatTurn",        qbRefresh);
  Hooks.on("createCombatant",   qbRefresh);
  Hooks.on("deleteCombatant",   qbRefresh);
  Hooks.on("updateCombatant",   qbRefresh);
  // Reflect DV-penalty AE changes (e.g., after rolling an attack, or
  // when a flurry DV AE is stamped) so the pending indicator updates.
  Hooks.on("createActiveEffect", qbRefresh);
  Hooks.on("deleteActiveEffect", qbRefresh);
  // Weapon equip toggles during a turn should re-evaluate the attack submenu.
  Hooks.on("updateItem",        qbRefresh);
  Hooks.on("createItem",        qbRefresh);
  Hooks.on("deleteItem",        qbRefresh);

  // Migration: back-fill unarmed attacks onto existing characters that
  // pre-date this feature. GM-only to avoid write races.
  if (!game.user.isGM) return;
  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    if (_hasUnarmedWeapon(actor)) continue;
    await actor.createEmbeddedDocuments("Item", [_unarmedWeaponData()]);
  }
  await _seedEffectsCompendium();
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
 * When an effect-wrapper item is dropped onto an actor, hijack the
 * creation: spawn the wrapper's embedded ActiveEffects directly on the
 * actor and cancel the item creation itself. Keeps the actor sheet from
 * accumulating bookkeeping "merit/flaw" entries that only exist to
 * carry the real effect payload.
 */
Hooks.on("preCreateItem", (item, data, options, userId) => {
  if (userId !== game.user.id) return;
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
  const hasCombatants = combatants.length > 0;
  const jbRolled = hasCombatants && combatants.every(c => {
    const s = c.flags?.exalted2e?.joinBattleSuccesses;
    return typeof s === "number";
  });
  const started = combat.started;

  // Phase 1 — strip Foundry's Begin Encounter button until JB is rolled.
  if (!jbRolled) {
    el.querySelectorAll(`[data-action='startCombat'], [data-control='startCombat']`)
      .forEach(btn => btn.remove());
  }

  // Anchor our phase-specific button inside the tracker's controls area.
  // Foundry v13 renders controls inside a footer part; older markup used a
  // `.combat-controls` element. Fall back progressively so the button always
  // has a home even if the DOM shifts.
  const endBtn = el.querySelector("[data-action='endCombat']")
              ?? el.querySelector(".combat-control-end");
  const anchorParent = endBtn?.parentElement
                    ?? el.querySelector("[data-application-part='footer']")
                    ?? el.querySelector(".combat-controls")
                    ?? el.querySelector("footer");
  if (!anchorParent) return;

  // Clear any ex2e button from a previous render before re-adding this phase's.
  el.querySelectorAll(".ex2e-jb-btn, .ex2e-jb-npc-btn, .ex2e-finish-turn-btn, .ex2e-flurry-btn").forEach(b => b.remove());

  const insertBtn = (btn) => {
    if (endBtn && anchorParent.contains(endBtn)) {
      anchorParent.insertBefore(btn, endBtn);
    } else {
      anchorParent.appendChild(btn);
    }
  };

  if (!jbRolled && hasCombatants && game.user.isGM) {
    // Phase 1: two Roll Join Battle buttons. Insert the NPC-only one first
    // so insertBefore(endBtn) leaves them in the order [NPC JB, All JB, End].
    const npcJbBtn = document.createElement("button");
    npcJbBtn.type = "button";
    npcJbBtn.classList.add("combat-control", "ex2e-jb-npc-btn");
    npcJbBtn.title = game.i18n.localize("EX2E.RollJoinBattleNPC");
    npcJbBtn.innerHTML = `<i class="fa-solid fa-skull"></i> ${game.i18n.localize("EX2E.RollJoinBattleNPC")}`;
    npcJbBtn.addEventListener("click", async () => {
      await combat.rollJoinBattleForNPCs();
    });
    insertBtn(npcJbBtn);

    const jbBtn = document.createElement("button");
    jbBtn.type = "button";
    // `combat-control` is Foundry's own tracker-button class — it gives the
    // button the native sidebar look.
    jbBtn.classList.add("combat-control", "ex2e-jb-btn");
    jbBtn.title = game.i18n.localize("EX2E.JoinBattle");
    jbBtn.innerHTML = `<i class="fa-solid fa-dice-d10"></i> ${game.i18n.localize("EX2E.RollJoinBattle")}`;
    jbBtn.addEventListener("click", async () => {
      await combat.rollJoinBattle();
    });
    insertBtn(jbBtn);
  } else if (started) {
    // Phase 3: Declare Flurry + Finish Turn — visible to the active combatant's owner / GM.
    const current = combat.combatant;
    const canFinish = current
      && (game.user.isGM || current.actor?.testUserPermission(game.user, "OWNER"));
    if (canFinish) {
      const flurry = current.flags?.exalted2e?.flurry ?? null;

      // Declare Flurry — only offered while no flurry is active for this turn.
      // Inserted first so visual order reads: [Declare Flurry] [Finish Turn] [End].
      if (!flurry && current.actor) {
        const flurryBtn = document.createElement("button");
        flurryBtn.type = "button";
        flurryBtn.classList.add("combat-control", "ex2e-flurry-btn");
        flurryBtn.title = game.i18n.localize("EX2E.FlurryDeclare");
        flurryBtn.innerHTML = `<i class="fa-solid fa-burst"></i> ${game.i18n.localize("EX2E.FlurryDeclare")}`;
        flurryBtn.addEventListener("click", async () => {
          const { FlurryDeclarationDialog } = await import("./dialogs/flurry-declaration-dialog.mjs");
          const result = await FlurryDeclarationDialog.prompt({ actor: current.actor });
          if (!result) return;
          // Stamp the DV penalty as an effect (cleared automatically at this
          // combatant's next turn via dvRefreshable), and record the flurry
          // on the combatant so rollAttack picks up the dice penalty and
          // Finish Turn uses the correct Speed.
          if (result.dvPenalty > 0) {
            await current.actor.applyDVPenalty("flurry", result.dvPenalty, {
              label: game.i18n.format("EX2E.FlurryDvPenaltyLabel", { n: result.count })
            });
          }
          await current.setFlag("exalted2e", "flurry", {
            actions:     result.actions,
            count:       result.count,
            dicePenalty: result.dicePenalty,
            speed:       result.speed,
            dvPenalty:   result.dvPenalty
          });
          // Post a chat card summarising the flurry. Attack-typed actions
          // in the card carry buttons that kick off each attack roll using
          // the normal pipeline (rollAttack picks the dice penalty up from
          // the combatant flag we just set).
          const flurryCardContent = await foundry.applications.handlebars.renderTemplate(
            "systems/exalted2e/templates/chat/flurry-declared.hbs",
            {
              actorId:     current.actor.id,
              actorName:   current.actor.name,
              actions:     result.actions,
              count:       result.count,
              dicePenalty: result.dicePenalty,
              speed:       result.speed,
              dvPenalty:   result.dvPenalty
            }
          );
          await ChatMessage.create({
            content: flurryCardContent,
            speaker: ChatMessage.getSpeaker({ actor: current.actor })
          });
        });
        insertBtn(flurryBtn);
      }

      const finishBtn = document.createElement("button");
      finishBtn.type = "button";
      finishBtn.classList.add("combat-control", "ex2e-finish-turn-btn");
      const finishLabel = flurry
        ? game.i18n.format("EX2E.FinishFlurryTurn", { speed: flurry.speed })
        : game.i18n.localize("EX2E.FinishTurn");
      finishBtn.title = finishLabel;
      finishBtn.innerHTML = `<i class="fa-solid fa-forward-step"></i> ${finishLabel}`;
      finishBtn.addEventListener("click", async () => {
        // Shared with the action quickbar: prefers a declared flurry's
        // Speed, then a pendingAction flag from the quickbar, and finally
        // falls back to the manual FinishTurnDialog.
        await finishTurnFor(combat, current);
      });
      insertBtn(finishBtn);
    }
  }
  // Phase 2: nothing to inject — Foundry's native Begin Encounter is visible.
});

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
    const updates = {};

    // Refund motes back to the exact pools they were drawn from.
    const mb = ledger.moteBreakdown;
    if (mb && (mb.fromPrimary > 0 || mb.fromSecondary > 0)) {
      const primary   = actor.system.motes?.[mb.primaryPool]   ?? { value: 0, max: 0 };
      const secondary = actor.system.motes?.[mb.secondaryPool] ?? { value: 0, max: 0 };
      updates[`system.motes.${mb.primaryPool}.value`]   = Math.min(primary.max   ?? 0, (primary.value   ?? 0) + (mb.fromPrimary   ?? 0));
      updates[`system.motes.${mb.secondaryPool}.value`] = Math.min(secondary.max ?? 0, (secondary.value ?? 0) + (mb.fromSecondary ?? 0));
    }

    // Refund willpower (capped at max).
    const wpRefund = Number(ledger.willpower) || 0;
    if (wpRefund > 0) {
      const wp = actor.system.willpower ?? { value: 0, max: 0 };
      updates["system.willpower.value"] = Math.min(wp.max ?? 0, (wp.value ?? 0) + wpRefund);
    }

    // Refund XP (capped at `total`, the earned-XP ceiling).
    const xpRefund = Number(ledger.xp) || 0;
    if (xpRefund > 0) {
      const xp = actor.system.experience ?? { value: 0, total: 0 };
      updates["system.experience.value"] = Math.min(xp.total ?? 0, (xp.value ?? 0) + xpRefund);
    }

    // Heal each health-type column by the exact amount the activation
    // inflicted. We write the whole `system.health` object in one go so
    // prepareDerivedData runs a single reconcile pass.
    const bRefund = Number(ledger.bashing)    || 0;
    const lRefund = Number(ledger.lethal)     || 0;
    const aRefund = Number(ledger.aggravated) || 0;
    if (bRefund > 0 || lRefund > 0 || aRefund > 0) {
      const h = foundry.utils.deepClone(actor.system.health ?? {});
      if (bRefund > 0) h.bashing    = Math.max(0, (h.bashing    ?? 0) - bRefund);
      if (lRefund > 0) h.lethal     = Math.max(0, (h.lethal     ?? 0) - lRefund);
      if (aRefund > 0) h.aggravated = Math.max(0, (h.aggravated ?? 0) - aRefund);
      updates["system.health"] = h;
    }

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
    if (!game.user.isGM) {
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
    let rawSuccesses = 0;
    let ones = 0;
    for (const d of dice) {
      if (d.face === 10)     { d.succs = 2; d.cls = "double-success"; rawSuccesses += 2; }
      else if (d.face >= 7)  { d.succs = 1; d.cls = "success";        rawSuccesses += 1; }
      else if (d.face === 1) { d.succs = 0; d.cls = "one"; ones += 1; }
      else                   { d.succs = 0; d.cls = "miss"; }
    }
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
        ${showApplyBtn ? `<button class="btn-roll btn-apply-damage" data-damage="${rawDamage}" data-damage-type="${damageType}" data-target-id="${targetId}"><i class="fa-solid fa-heart-crack"></i> ${game.i18n.localize("EX2E.ApplyDamage")}</button>` : ""}
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
  });

  el.querySelector?.(".btn-apply-damage")?.addEventListener("click", async (applyEvent) => {
    const card = applyEvent.currentTarget.closest(".ex2e-attack-card");
    const btn = applyEvent.currentTarget;
    const dmg  = parseInt(btn.dataset.damage) || 0;
    const type = btn.dataset.damageType || "lethal";
    const tId  = btn.dataset.targetId;
    const targetActor = game.actors.get(tId);
    if (targetActor && dmg > 0) {
      await targetActor.applyDamage(dmg, type);
      
      const section = card.querySelector(".damage-result");
      section.removeChild(btn);

      await message.update({ content: card.outerHTML });
    }
  });
});
