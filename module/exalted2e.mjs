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
    knack:      KnackData,
    virtueflaw: VirtueFlawData
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
  Items.registerSheet("exalted2e", VirtueFlawSheet, {
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
    "systems/exalted2e/templates/item/virtueflaw/header.hbs",
    "systems/exalted2e/templates/item/virtueflaw/body.hbs",
    // Chat / Dialogs
    "systems/exalted2e/templates/chat/roll-result.hbs",
    "systems/exalted2e/templates/chat/item-card.hbs",
    "systems/exalted2e/templates/dialog/roll-dialog.hbs",
    "systems/exalted2e/templates/dialog/add-specialty-dialog.hbs",
    "systems/exalted2e/templates/dialog/attack-dialog.hbs",
    "systems/exalted2e/templates/dialog/step2-defense-dialog.hbs",
    "systems/exalted2e/templates/dialog/virtueflaw-picker-dialog.hbs",
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
      const regularCharms  = allStep2.filter(c => !excIds.has(c.id));

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
      for (const id of result.charmIds) {
        const charm = targetActor.items.get(id);
        if (!charm) continue;
        const ok = await charm.activateCharm();
        if (ok) activatedNames.push(charm.name);
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

      const newAttack = {
        ...attack,
        defense:                { type: defenseType, dv },
        defenseCharms:          activatedNames,
        defenderHasThirdExc,
        defenderExcKey:         abilKey,
        defenderFirstExcDice:   firstExcDice,
        defenderSecondExcSucc:  secondExcSucc
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
