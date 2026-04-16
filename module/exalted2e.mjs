/**
 * exalted2e.mjs – Main entry point for the Exalted 2nd Edition Foundry VTT system.
 */

// ── Imports ────────────────────────────────────────────────────────────────
import { EX2E }             from "./config.mjs";
import { ExaltedActor }     from "./documents/actor.mjs";
import { ExaltedItem }      from "./documents/item.mjs";
import { CharacterData }    from "./data/actor/character-data.mjs";
import { NpcData }          from "./data/actor/npc-data.mjs";
import { CharmData }        from "./data/item/charm-data.mjs";
import { WeaponData }       from "./data/item/weapon-data.mjs";
import { ArmorData }        from "./data/item/armor-data.mjs";
import { BackgroundData }   from "./data/item/background-data.mjs";
import { IntimacyData }     from "./data/item/intimacy-data.mjs";
import { MeritFlawData }    from "./data/item/meritflaw-data.mjs";
import { KnackData }        from "./data/item/knack-data.mjs";
import { CharacterSheet }   from "./sheets/actor/character-sheet.mjs";
import { NpcSheet }         from "./sheets/actor/npc-sheet.mjs";
import { CharmSheet }       from "./sheets/item/charm-sheet.mjs";
import { WeaponSheet }      from "./sheets/item/weapon-sheet.mjs";
import { ArmorSheet }       from "./sheets/item/armor-sheet.mjs";
import { GenericItemSheet } from "./sheets/item/generic-item-sheet.mjs";
import { KnackSheet }      from "./sheets/item/knack-sheet.mjs";
import { registerHandlebarsHelpers } from "./helpers/handlebars.mjs";

// ── Init Hook ──────────────────────────────────────────────────────────────
Hooks.once("init", function () {
  console.log("Exalted 2e | Initialising system...");

  // Expose config on the game object
  game.exalted2e = { EX2E };

  // ── Document Classes ────────────────────────────────────────────────────
  CONFIG.Actor.documentClass = ExaltedActor;
  CONFIG.Item.documentClass  = ExaltedItem;

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
    knack:      KnackData
  };

  // ── Sheet Registration ──────────────────────────────────────────────────
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("exalted2e", CharacterSheet, {
    types:     ["character"],
    makeDefault: true,
    label:     "EX2E.SheetCharacter"
  });
  Actors.registerSheet("exalted2e", NpcSheet, {
    types:     ["npc"],
    makeDefault: true,
    label:     "EX2E.SheetNpc"
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("exalted2e", CharmSheet, {
    types:     ["charm"],
    makeDefault: true,
    label:     "EX2E.SheetCharm"
  });
  Items.registerSheet("exalted2e", WeaponSheet, {
    types:     ["weapon"],
    makeDefault: true,
    label:     "EX2E.SheetWeapon"
  });
  Items.registerSheet("exalted2e", ArmorSheet, {
    types:     ["armor"],
    makeDefault: true,
    label:     "EX2E.SheetArmor"
  });
  Items.registerSheet("exalted2e", GenericItemSheet, {
    types:     ["background", "intimacy", "meritflaw"],
    makeDefault: true,
    label:     "EX2E.SheetGenericItem"
  });
  Items.registerSheet("exalted2e", KnackSheet, {
    types:     ["knack"],
    makeDefault: true,
    label:     "EX2E.SheetKnack"
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
    // Actor – NPC
    "systems/exalted2e/templates/actor/npc/header.hbs",
    "systems/exalted2e/templates/actor/npc/body.hbs",
    // Items
    "systems/exalted2e/templates/item/charm/header.hbs",
    "systems/exalted2e/templates/item/charm/body.hbs",
    "systems/exalted2e/templates/item/weapon/header.hbs",
    "systems/exalted2e/templates/item/weapon/body.hbs",
    "systems/exalted2e/templates/item/armor/header.hbs",
    "systems/exalted2e/templates/item/armor/body.hbs",
    "systems/exalted2e/templates/item/generic/header.hbs",
    "systems/exalted2e/templates/item/generic/body.hbs",
    "systems/exalted2e/templates/item/knack/header.hbs",
    "systems/exalted2e/templates/item/knack/body.hbs",
    // Chat / Dialogs
    "systems/exalted2e/templates/chat/roll-result.hbs",
    "systems/exalted2e/templates/chat/item-card.hbs",
    "systems/exalted2e/templates/dialog/roll-dialog.hbs",
    "systems/exalted2e/templates/dialog/add-specialty-dialog.hbs",
    "systems/exalted2e/templates/dialog/attack-dialog.hbs",
    "systems/exalted2e/templates/chat/attack-result.hbs"
  ];
  return loadTemplates(templatePaths);
}

// ── Ready Hook ─────────────────────────────────────────────────────────────
Hooks.once("ready", function () {
  console.log("Exalted 2e | System ready.");
});

// ── Chat Listeners ─────────────────────────────────────────────────────────
Hooks.on("renderChatMessage", (message, html) => {
  // Resolve the raw DOM element (html may be jQuery or HTMLElement)
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  
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
