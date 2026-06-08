/**
 * register-handlebars.mjs – Handlebars helper registration + template pre-load.
 * Called once from the "init" hook in module/exalted2e.mjs.
 */
import { registerHandlebarsHelpers } from "../helpers/handlebars.mjs";

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
    // Actor – Unit (mass combat)
    "systems/exalted2e/templates/actor/unit/unit-sheet.hbs",
    "systems/exalted2e/templates/actor/unit/_magnitude-track.hbs",
    // Items
    "systems/exalted2e/templates/item/charm/header.hbs",
    "systems/exalted2e/templates/item/spell/header.hbs",
    "systems/exalted2e/templates/item/spell/tabs.hbs",
    "systems/exalted2e/templates/item/spell/body.hbs",
    "systems/exalted2e/templates/item/spell/tab-effects.hbs",
    "systems/exalted2e/templates/item/charm/tabs.hbs",
    "systems/exalted2e/templates/item/charm/tab-general.hbs",
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
    "systems/exalted2e/templates/item/resplendency/header.hbs",
    "systems/exalted2e/templates/item/resplendency/body.hbs",
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
    "systems/exalted2e/templates/dialog/resplendent-paradox-dialog.hbs",
    "systems/exalted2e/templates/chat/attack-result.hbs",
    "systems/exalted2e/templates/chat/flurry-declared.hbs",
    "systems/exalted2e/templates/chat/action-declared.hbs",
    "systems/exalted2e/templates/chat/social-attack-card.hbs",
    "systems/exalted2e/templates/chat/shapeshift-card.hbs",
    "systems/exalted2e/templates/chat/limit-break-card.hbs",
    "systems/exalted2e/templates/chat/hazard-resistance.hbs",
    "systems/exalted2e/templates/dialog/social-attack-dialog.hbs",
    "systems/exalted2e/templates/chat/mass-combat-result.hbs",
    "systems/exalted2e/templates/dialog/parts/excellency-pips.hbs",
    "systems/exalted2e/templates/chat/clinch-established.hbs",
    "systems/exalted2e/templates/chat/clinch-action.hbs",
    "systems/exalted2e/templates/chat/thaumaturgy-result.hbs",
    "systems/exalted2e/templates/item/thaum-art-sheet.hbs",
    "systems/exalted2e/templates/item/procedure-sheet.hbs",
    "systems/exalted2e/templates/actor/character/tab-thaumaturgy.hbs",
    "systems/exalted2e/templates/actor/vehicle/header.hbs",
    "systems/exalted2e/templates/actor/vehicle/body.hbs",
    "systems/exalted2e/templates/chat/blasphemy-alert.hbs",
    "systems/exalted2e/templates/ui/ghost-contest.hbs",
    "systems/exalted2e/templates/chat/ghost-summon-result.hbs",
    "systems/exalted2e/templates/chat/demon-summon-result.hbs",
    "systems/exalted2e/templates/chat/spell-attack-result.hbs",
    "systems/exalted2e/templates/chat/gremlin-syndrome-alert.hbs",
    "systems/exalted2e/templates/chat/resplendency-activation.hbs",
    "systems/exalted2e/templates/chat/resplendent-paradox.hbs",
    "systems/exalted2e/templates/dialog/manse-power-picker-dialog.hbs",
    "systems/exalted2e/templates/chat/manse-construction-card.hbs",
    "systems/exalted2e/templates/chat/affliction-card.hbs",
  ];
  return foundry.applications.handlebars.loadTemplates(templatePaths);
}

// ── Public entry point ─────────────────────────────────────────────────────
export function registerHandlebars() {
  // ── Handlebars Helpers ──────────────────────────────────────────────────
  registerHandlebarsHelpers();

  // Pre-load all sheet templates for performance
  _preloadTemplates();
}
