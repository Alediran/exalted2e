/**
 * ui-buttons.mjs – Directory/compendium/scene-control UI-button hooks +
 * The Circle party helpers, extracted from the main entry point.
 */

import { CharmTreeDialog } from "../apps/charm-tree-dialog.mjs";
import { ImportDialog }    from "../apps/import-dialog.mjs";
import { _getTheCircleFolder, _isInTheCircle } from "../setup/seeders.mjs";

// ── The Circle — party helpers ─────────────────────────────────────────────

async function _circleCharacters() {
  const circle = _getTheCircleFolder();
  if (!circle) return [];
  return game.actors.filter(
    a => a.type === "character" && _isInTheCircle(a.folder?.id ?? null)
  );
}

async function _onCirclePartyRoll() {
  const chars = await _circleCharacters();
  if (!chars.length) return;

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("EX2E.CirclePartyRoll") },
    content: `
<div class="form-group">
  <label>${game.i18n.localize("EX2E.CirclePartyRollPool")}</label>
  <select name="attribute" style="flex:1">
    ${["strength","dexterity","stamina","charisma","manipulation","appearance",
       "perception","intelligence","wits"].map(a =>
      `<option value="${a}">${game.i18n.localize("EX2E.Attr" + a.charAt(0).toUpperCase() + a.slice(1))}</option>`
    ).join("")}
  </select>
  <select name="ability" style="flex:1">
    ${["athletics","awareness","craft","dodge","integrity","investigation","larceny","linguistics",
       "lore","martialarts","medicine","melee","occult","performance","presence","resistance",
       "ride","sail","socialize","stealth","survival","thrown","war"].map(ab =>
      `<option value="${ab}">${game.i18n.localize("EX2E.Ability" + ab.charAt(0).toUpperCase() + ab.slice(1)) ?? ab}</option>`
    ).join("")}
  </select>
</div>`,
    ok: {
      label: game.i18n.localize("EX2E.Roll"),
      callback: (_ev, btn) => ({
        attribute: btn.form.elements.attribute?.value ?? "dexterity",
        ability:   btn.form.elements.ability?.value   ?? "awareness",
      })
    }
  });
  if (!result) return;

  const { ExaltedRoll } = await import("../rolls/exalted-roll.mjs");
  for (const actor of chars) {
    const attrVal  = actor.system.attributes?.[result.attribute]?.value ?? 0;
    const abilVal  = actor.system.abilities?.[result.ability]?.value    ?? 0;
    const pool     = Math.max(1, attrVal + abilVal);
    const roll     = await new ExaltedRoll({ pool, actorName: actor.name, flavor: `${result.attribute} + ${result.ability}` }).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
  }
}

async function _onCircleAwardXp() {
  const chars = await _circleCharacters();
  if (!chars.length) return;

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("EX2E.CircleAwardXP") },
    content: `
<div class="form-group">
  <label>${game.i18n.localize("EX2E.CircleAwardXPAmount")}</label>
  <input type="number" name="xp" value="1" min="1" max="99" style="width:5em" autofocus>
</div>
<div class="form-group">
  <label>${game.i18n.localize("EX2E.CircleAwardXPNote")}</label>
  <input type="text" name="note" value="" style="flex:1">
</div>`,
    ok: {
      label: game.i18n.localize("EX2E.Award"),
      callback: (_ev, btn) => ({
        xp:   parseInt(btn.form.elements.xp?.value) || 1,
        note: btn.form.elements.note?.value?.trim() ?? "",
      })
    }
  });
  if (!result) return;

  const { xp, note } = result;
  for (const actor of chars) {
    const current = Number(actor.system.experience?.value) || 0;
    const total   = Number(actor.system.experience?.total) || 0;
    await actor.update({
      "system.experience.value": current + xp,
      "system.experience.total": total  + xp,
    });
  }
  const charNames = chars.map(a => a.name).join(", ");
  const noteStr   = note ? ` (${note})` : "";
  await ChatMessage.create({
    content: `<p><strong>${game.i18n.format("EX2E.CircleXPAwarded", { xp, note: noteStr })}</strong><br>${charNames}</p>`,
    style:   CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}

async function _onCircleRest() {
  const chars = await _circleCharacters();
  if (!chars.length) return;

  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window:  { title: game.i18n.localize("EX2E.CircleRest") },
    content: `<p>${game.i18n.format("EX2E.CircleRestConfirm", { n: chars.length })}</p>`,
    yes: { label: game.i18n.localize("EX2E.CircleRest") },
  });
  if (!confirmed) return;

  for (const actor of chars) {
    const wpMax  = actor.system.willpower?.max ?? 0;
    const perMax = actor.system.motes?.peripheral?.max ?? 0;
    const persMax = actor.system.motes?.personal?.max  ?? 0;
    await actor.update({
      "system.willpower.value":         wpMax,
      "system.motes.peripheral.value":  perMax,
      "system.motes.personal.value":    persMax,
      "system.scenePeripheral":         0,
    });
  }
  await ChatMessage.create({
    content: `<p>${game.i18n.localize("EX2E.CircleRestComplete")}</p>`,
    style:   CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}

// ── GM Scene Controls: Place Hazard (one button per shape) ─────────────────

const _HAZARD_SHAPES = [
  { key: "circle",    tool: "circle",    icon: "fas fa-circle"       },
  { key: "ring",      tool: "ring",      icon: "fas fa-circle-notch" },
  { key: "emanation", tool: "emanation", icon: "fas fa-radiation"    },
  { key: "cone",      tool: "cone",      icon: "fas fa-play"         },
  { key: "rect",      tool: "rectangle", icon: "fas fa-square"       },
  { key: "ray",       tool: "line",      icon: "fas fa-minus"        },
];

let _pendingHazard = null;
let _pendingTerrain = null;

async function _openHazardDialog(tool) {
  const traumaOptions = ["bashing", "lethal", "aggravated"]
    .map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`)
    .join("");

  const formHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;padding:8px">
      <label style="grid-column:1/-1">
        ${game.i18n.localize("EX2E.Name")}
        <input type="text" name="hazardName" value="Hazard" style="width:100%">
      </label>
      <label>
        ${game.i18n.localize("EX2E.DamagePool")}
        <input type="text" name="damagePool" value="5" style="width:100%">
      </label>
      <label>
        ${game.i18n.localize("EX2E.DamageType")}
        <select name="traumaType" style="width:100%">${traumaOptions}</select>
      </label>
      <label>
        ${game.i18n.localize("EX2E.AreaResistDifficulty")} (0 = auto)
        <input type="number" name="resistDifficulty" value="3" min="0" style="width:100%">
      </label>
      <label>
        ${game.i18n.localize("EX2E.TerrainCost")} (1 = normal)
        <input type="number" name="terrainCost" value="1" min="1" style="width:100%">
      </label>
      <label style="grid-column:1/-1;display:flex;align-items:center;gap:6px">
        <input type="checkbox" name="damageOnEntry">
        ${game.i18n.localize("EX2E.DamageOnEntry")}
      </label>
      <label style="grid-column:1/-1;display:flex;align-items:center;gap:6px">
        <input type="checkbox" name="isSupernatural">
        ${game.i18n.localize("EX2E.HazardSupernatural")}
      </label>
    </div>`;

  const config = await foundry.applications.api.DialogV2.wait({
    window:  { title: game.i18n.localize("EX2E.HazardConfigTitle") },
    content: formHtml,
    buttons: [
      {
        action:   "confirm",
        label:    game.i18n.localize("EX2E.Confirm"),
        callback: (_event, _btn, dialog) => ({
          name:             dialog.element.querySelector("[name=hazardName]").value.trim() || "Hazard",
          damagePool:       dialog.element.querySelector("[name=damagePool]").value.trim() || "5",
          traumaType:       dialog.element.querySelector("[name=traumaType]").value,
          resistDifficulty: Number(dialog.element.querySelector("[name=resistDifficulty]").value) || 0,
          terrainCost:      Number(dialog.element.querySelector("[name=terrainCost]").value) || 1,
          damageOnEntry:    dialog.element.querySelector("[name=damageOnEntry]").checked,
          isSupernatural:   dialog.element.querySelector("[name=isSupernatural]").checked,
        }),
      },
      { action: "cancel", label: game.i18n.localize("EX2E.Cancel"), default: true },
    ],
  });

  if (!config) return;
  _pendingHazard = config;
  await ui.controls.activate({ control: "regions", tool });
}

async function _openTerrainDialog() {
  const typeOptions = [
    `<option value="elevation">${game.i18n.localize("EX2E.TerrainTypeElevation")}</option>`,
    `<option value="cover">${game.i18n.localize("EX2E.TerrainTypeCover")}</option>`,
  ].join("");

  const formHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;padding:8px">
      <label style="grid-column:1/-1">
        ${game.i18n.localize("EX2E.TerrainLabel")}
        <input type="text" name="label" style="width:100%" placeholder="${game.i18n.localize("EX2E.TerrainModifier")}">
      </label>
      <label>
        ${game.i18n.localize("EX2E.TerrainType")}
        <select name="terrainType" style="width:100%">${typeOptions}</select>
      </label>
      <label>
        ${game.i18n.localize("EX2E.TerrainAccuracyBonus")}
        <input type="number" name="accuracyBonus" value="0" min="0" style="width:100%">
      </label>
      <label>
        ${game.i18n.localize("EX2E.TerrainDVBonus")}
        <input type="number" name="dvBonus" value="0" min="0" style="width:100%">
      </label>
      <label>
        ${game.i18n.localize("EX2E.TerrainSoakBonus")}
        <input type="number" name="soakBonus" value="0" min="0" style="width:100%">
      </label>
    </div>`;

  const config = await foundry.applications.api.DialogV2.wait({
    window:  { title: game.i18n.localize("EX2E.PlaceTerrainTitle") },
    content: formHtml,
    buttons: [
      {
        action:   "confirm",
        label:    game.i18n.localize("EX2E.Confirm"),
        callback: (_event, _btn, dialog) => ({
          label:         dialog.element.querySelector("[name=label]").value.trim(),
          terrainType:   dialog.element.querySelector("[name=terrainType]").value,
          accuracyBonus: Number(dialog.element.querySelector("[name=accuracyBonus]").value) || 0,
          dvBonus:       Number(dialog.element.querySelector("[name=dvBonus]").value) || 0,
          soakBonus:     Number(dialog.element.querySelector("[name=soakBonus]").value) || 0,
        }),
      },
      { action: "cancel", label: game.i18n.localize("EX2E.Cancel"), default: true },
    ],
  });

  if (!config) return;
  _pendingTerrain = config;
  await ui.controls.activate({ control: "regions", tool: "rectangle" });
}

// ── Registration ───────────────────────────────────────────────────────────

export function registerUiButtonHooks() {
  // ── Compendium footer button: Open Charm Tree ────────────────────────────
  Hooks.on('renderCompendium', (_app, html) => {
    if (_app.collection?.metadata?.type !== 'Item') return;
    const root = Array.isArray(html) ? html[0] : html;
    const footer = root?.querySelector?.('.directory-footer');
    if (!footer) return;
    if (footer.querySelector('.charm-tree-compendium-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'charm-tree-compendium-btn';
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-sitemap';
    btn.appendChild(icon);
    btn.appendChild(document.createTextNode(' ' + game.i18n.localize('EX2E.CharmTree.OpenTree')));
    btn.addEventListener('click', () => CharmTreeDialog.open());
    footer.appendChild(btn);
  });

  // ── Items Directory sidebar button: Open Charm Tree ──────────────────────
  Hooks.on('renderItemDirectory', (_app, html) => {
    const root = Array.isArray(html) ? html[0] : html;
    const footer = root?.querySelector?.('.directory-footer');
    if (!footer) return;
    if (footer.querySelector('.charm-tree-directory-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'charm-tree-directory-btn';
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-sitemap';
    btn.appendChild(icon);
    btn.appendChild(document.createTextNode(' ' + game.i18n.localize('EX2E.CharmTree.OpenTree')));
    btn.addEventListener('click', () => CharmTreeDialog.open());
    footer.appendChild(btn);
  });

  // ── GM Import Buttons ────────────────────────────────────────────────────
  // Inject an "Import" button into the Items and Actors directory headers so
  // GMs can paste rulebook text directly into Foundry without a compendium.

  Hooks.on("renderItemDirectory", (_app, html) => {
    if (!game.user?.isGM) return;
    const header = html.querySelector?.(".directory-header") ?? html.querySelector?.("header");
    if (!header) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ex2e-import-btn";
    btn.innerHTML = `<i class="fas fa-file-import"></i> ${game.i18n.localize("EX2E.ImportItems")}`;
    btn.addEventListener("click", () => ImportDialog.open("item"));
    header.appendChild(btn);
  });

  Hooks.on("renderActorDirectory", (_app, html) => {
    if (!game.user?.isGM) return;
    const header = html.querySelector?.(".directory-header") ?? html.querySelector?.("header");
    if (!header) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ex2e-import-btn";
    btn.innerHTML = `<i class="fas fa-file-import"></i> ${game.i18n.localize("EX2E.ImportNPCs")}`;
    btn.addEventListener("click", () => ImportDialog.open("actor"));
    header.appendChild(btn);
  });

  // ── The Circle — folder action buttons ──────────────────────────────────
  // Injects Party Roll / Award XP / Rest buttons into The Circle folder header
  // in the Actor Directory sidebar. GM-only.
  Hooks.on("renderActorDirectory", (_app, html) => {
    if (!game.user?.isGM) return;
    const circle = _getTheCircleFolder();
    if (!circle) return;

    const folderEl = html.querySelector?.(`[data-folder-id="${circle.id}"]`);
    if (!folderEl) return;
    const folderHeader = folderEl.querySelector(".folder-header .fa-folder");
    if (!folderHeader) return;

    // Avoid double-injection on re-renders
    if (folderHeader.querySelector(".circle-action-buttons")) return;


    const btnRoll = document.createElement("button");
    btnRoll.className = "create-button create-entry icon fa-solid fa-dice-d10";
    btnRoll.title = game.i18n.localize("EX2E.CirclePartyRoll");
    btnRoll.dataset.circleAction = "partyroll";

    const btnAwardXp = document.createElement("button");
    btnAwardXp.className = "create-button create-entry icon fa-solid fa-star";
    btnAwardXp.title = game.i18n.localize("EX2E.CircleAwardXP");
    btnAwardXp.dataset.circleAction = "awardXp";

    const btnRest = document.createElement("button");
    btnRest.className = "create-button create-entry icon fa-solid fa-moon";
    btnRest.title = game.i18n.localize("EX2E.CircleRest");
    btnRest.dataset.circleAction = "rest";

    folderHeader.before(btnRest);
    btnRest.before(btnAwardXp);
    btnAwardXp.before(btnRoll);

    btnRoll.addEventListener("click", _onCirclePartyRoll);
    btnAwardXp.addEventListener("click",   _onCircleAwardXp);
    btnRest.addEventListener("click",      _onCircleRest);
  });

  // ── GM Scene Controls: Place Hazard / Terrain ────────────────────────────
  Hooks.on("getSceneControlButtons", (controls) => {
    if (!game.user.isGM) return;

    controls["terrain"] = {
      name:       "terrain",
      title:      game.i18n.localize("EX2E.TerrainControls"),
      icon:       "fas fa-mountain",
      layer:      null,
      activeTool: "",
      tools:      {},
    };
    const terrainControls = controls["terrain"];

    let order = 100;
    for (const { key, tool, icon } of _HAZARD_SHAPES) {
      const shapeLabel = game.i18n.localize(`EX2E.AreaShape${key.charAt(0).toUpperCase() + key.slice(1)}`);
      terrainControls.tools[`placeHazard_${key}`] = {
        name:     `placeHazard_${key}`,
        order:    order++,
        title:    `${game.i18n.localize("EX2E.PlaceHazard")}: ${shapeLabel}`,
        icon,
        button:   true,
        onChange: () => _openHazardDialog(tool),
      };
    }

    terrainControls.tools["placeTerrain"] = {
      name:     "placeTerrain",
      order:    order++,
      title:    game.i18n.localize("EX2E.PlaceTerrainTitle"),
      icon:     "fas fa-draw-polygon",
      button:   true,
      onChange: _openTerrainDialog,
    };
  });

  // Intercept the next region drawn after a hazard or terrain dialog is confirmed.
  Hooks.on("preCreateRegion", (regionDoc, _data, _options, _userId) => {
    if (_pendingHazard) {
      const config = _pendingHazard;
      _pendingHazard = null;

      const behaviors = [
        { type: "hazardDamage", system: {
            damagePool:       config.damagePool,
            traumaType:       config.traumaType,
            resistDifficulty: config.resistDifficulty,
            damageOnEntry:    config.damageOnEntry,
            isSupernatural:   config.isSupernatural,
        }},
      ];
      if (config.terrainCost > 1) {
        behaviors.push({ type: "modifyMovementCost", system: { cost: config.terrainCost } });
      }
      regionDoc.updateSource({ name: config.name, color: "#FF6600", behaviors });
      return;
    }

    if (_pendingTerrain) {
      const config = _pendingTerrain;
      _pendingTerrain = null;

      regionDoc.updateSource({
        name:  config.label || game.i18n.localize("EX2E.TerrainModifier"),
        color: "#0066FF",
        behaviors: [
          { type: "terrainModifier", system: {
              terrainType:   config.terrainType,
              label:         config.label,
              accuracyBonus: config.accuracyBonus,
              dvBonus:       config.dvBonus,
              soakBonus:     config.soakBonus,
          }},
        ],
      });
    }
  });
}
