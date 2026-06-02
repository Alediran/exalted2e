import { EX2E } from "../../config.mjs";
import { computeSpellCastButtonState } from "../../ui/spell-cast-button.mjs";
import { editImageAction } from "../_edit-image.mjs";

const { ItemSheetV2, HandlebarsApplicationMixin } = (() => {
  const sheets = foundry.applications.sheets;
  const api    = foundry.applications.api;
  return { ItemSheetV2: sheets.ItemSheetV2, HandlebarsApplicationMixin: api.HandlebarsApplicationMixin };
})();

export class SpellSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** Current tab group state. Defaults to the General (body) tab. */
  tabGroups = { sheet: "tabBody" };

  static DEFAULT_OPTIONS = {
    classes:  ["exalted2e", "item", "spell"],
    position: { width: 520, height: 520 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      editImage:           editImageAction,
      castSpell:           SpellSheet.#onCastSpell,
      createEffect:        SpellSheet.#onCreateEffect,
      editEffect:          SpellSheet.#onEditEffect,
      deleteEffect:        SpellSheet.#onDeleteEffect,
      createSoakEffect:    SpellSheet.#onCreateSoakEffect,
      createPenaltyEffect: SpellSheet.#onCreatePenaltyEffect,
      createAttrEffect:    SpellSheet.#onCreateAttrEffect,
      rollSpellAttack:     SpellSheet.#onRollSpellAttack,
      openFormula:         SpellSheet.#onOpenFormula,
      addAttackTag:        SpellSheet.#onAddAttackTag,
      removeAttackTag:     SpellSheet.#onRemoveAttackTag,
    }
  };

  get title() { return this.document.name; }

  static PARTS = {
    header:     { template: "systems/exalted2e/templates/item/spell/header.hbs" },
    tabs:       { classes: ["tabs-right"], template: "systems/exalted2e/templates/item/spell/tabs.hbs" },
    tabBody:    { template: "systems/exalted2e/templates/item/spell/body.hbs", scrollable: [".sheet-body"] },
    tabEffects: { template: "systems/exalted2e/templates/item/spell/tab-effects.hbs", scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item    = this.document;
    const sys     = item.system;

    const tabs = {
      tabBody:    { id: "tabBody",    group: "sheet", icon: "fa-solid fa-scroll",   label: game.i18n.localize("EX2E.TabGeneral"),  cssClass: this.tabGroups.sheet === "tabBody"    ? "active" : "" },
      tabEffects: { id: "tabEffects", group: "sheet", icon: "fa-solid fa-sparkles", label: game.i18n.localize("EX2E.TabEffects"),  cssClass: this.tabGroups.sheet === "tabEffects" ? "active" : "" }
    };

    const castButton = this._computeCastButtonState();

    return {
      ...context,
      item,
      system:       sys,
      config:       EX2E,
      tabs,
      traditionChoices: [
        { value: "sorcery",    label: game.i18n.localize("EX2E.TraditionSorcery") },
        { value: "necromancy", label: game.i18n.localize("EX2E.TraditionNecromancy") },
        { value: "weaving",    label: game.i18n.localize("EX2E.TraditionWeaving") }
      ],
      circleChoices: this._circleChoicesFor(sys.tradition),
      durations: Object.entries(EX2E.durations).map(([k,v]) => ({
        value: k, label: game.i18n.localize(v)
      })),
      subtypeChoices: [
        { value: "",                label: game.i18n.localize("EX2E.SpellSubtypeNone") },
        { value: "ghost-summoning", label: game.i18n.localize("EX2E.SpellSubtypeGhostSummoning") },
        { value: "demon-summoning", label: game.i18n.localize("EX2E.SpellSubtypeDemonSummoning") },
      ],
      spellAttackVisible: !!(sys.spellAttack?.enabled && item.actor),
      areaShapes: [
        { value: "circle",    label: game.i18n.localize("EX2E.AreaShapeCircle")    },
        { value: "ring",      label: game.i18n.localize("EX2E.AreaShapeRing")      },
        { value: "emanation", label: game.i18n.localize("EX2E.AreaShapeEmanation") },
        { value: "cone",      label: game.i18n.localize("EX2E.AreaShapeCone")      },
        { value: "rect",      label: game.i18n.localize("EX2E.AreaShapeRect")      },
        { value: "ray",       label: game.i18n.localize("EX2E.AreaShapeRay")       },
      ],
      damageTypes: [
        { value: "bashing",    label: game.i18n.localize("EX2E.DamageBashing") },
        { value: "lethal",     label: game.i18n.localize("EX2E.DamageLethal") },
        { value: "aggravated", label: game.i18n.localize("EX2E.DamageAggravated") }
      ],
      weaponTags: EX2E.weaponTags ?? [],
      spellAttackTags: sys.spellAttack?.tags ?? [],
      effects: item.effects.contents.map(e => ({
        id:           e.id,
        name:         e.name,
        icon:         e.icon ?? "icons/svg/aura.svg",
        changesCount: (e.changes ?? []).length,
      })),
      isEditable:  this.isEditable,
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(sys.description, {
        secrets: this.document.isOwner, relativeTo: this.document
      }),
      castButton
    };
  }

  _computeCastButtonState() {
    return computeSpellCastButtonState(this.document);
  }

  static async #onCastSpell(_event, _target) {
    const { castSpellFlow } = await import("../../ui/cast-spell-flow.mjs");
    await castSpellFlow(this.document);
  }

  static async #onCreateEffect(_event, _target) {
    await this.document.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize("EX2E.NewEffect"),
      icon: "icons/svg/aura.svg",
    }]);
  }

  static async #onEditEffect(_event, target) {
    const ae = this.document.effects.get(target.dataset.effectId);
    ae?.sheet?.render(true);
  }

  static async #onDeleteEffect(_event, target) {
    const ae = this.document.effects.get(target.dataset.effectId);
    await ae?.delete();
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.partId = partId;
    if (partId.startsWith("tab")) {
      context.cssClass = this.tabGroups.sheet === partId ? "active" : "";
    }
    return context;
  }

  static async #onCreateSoakEffect(_event, _target) {
    const content = `
<div class="form-group">
  <label>${game.i18n.localize("EX2E.SpellQuickAddSoakBashing")}</label>
  <input type="number" name="bashing" value="0" min="0" style="width:5em">
</div>
<div class="form-group">
  <label>${game.i18n.localize("EX2E.SpellQuickAddSoakLethal")}</label>
  <input type="number" name="lethal" value="0" min="0" style="width:5em">
</div>
<div class="form-group">
  <label>${game.i18n.localize("EX2E.SpellQuickAddSoakAggravated")}</label>
  <input type="number" name="aggravated" value="0" min="0" style="width:5em">
</div>
<div class="form-group">
  <label>${game.i18n.localize("EX2E.SpellQuickAddSoakHardness")}</label>
  <input type="number" name="hardness" value="0" min="0" style="width:5em">
</div>`;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("EX2E.SpellQuickAddSoakTitle") },
      content,
      ok: {
        label: game.i18n.localize("EX2E.Add"),
        callback: (_ev, button) => {
          const f = button.form;
          return {
            b: parseInt(f.elements.bashing?.value)    || 0,
            l: parseInt(f.elements.lethal?.value)     || 0,
            a: parseInt(f.elements.aggravated?.value) || 0,
            h: parseInt(f.elements.hardness?.value)   || 0,
          };
        }
      }
    });
    if (!result) return;
    const { b, l, a, h } = result;
    if (!b && !l && !a && !h) return;
    const changes = [];
    if (b) changes.push({ key: "system.bonuses.soakBashing",    mode: 2, value: String(b) });
    if (l) changes.push({ key: "system.bonuses.soakLethal",     mode: 2, value: String(l) });
    if (a) changes.push({ key: "system.bonuses.soakAggravated", mode: 2, value: String(a) });
    if (h) changes.push({ key: "system.bonuses.hardnessAdd",    mode: 2, value: String(h) });
    const parts = [];
    if (b) parts.push(`+${b}B`);
    if (l) parts.push(`+${l}L`);
    if (a) parts.push(`+${a}A`);
    if (h) parts.push(`+${h}H`);
    await this.document.createEmbeddedDocuments("ActiveEffect", [{
      name:     game.i18n.format("EX2E.SpellAENameSoak", { v: parts.join("/") }),
      icon:     "icons/svg/shield.svg",
      changes,
      transfer: false,
      disabled: false,
      flags:    {}
    }]);
  }

  static async #onCreatePenaltyEffect(_event, _target) {
    const content = `
<div class="form-group">
  <label>${game.i18n.localize("EX2E.SpellQuickAddPenaltyType")}</label>
  <select name="penaltyType" style="flex:1">
    <option value="internal">${game.i18n.localize("EX2E.SpellQuickAddPenaltyInternal")}</option>
    <option value="external">${game.i18n.localize("EX2E.SpellQuickAddPenaltyExternal")}</option>
    <option value="dv">${game.i18n.localize("EX2E.SpellQuickAddPenaltyDV")}</option>
  </select>
</div>
<div class="form-group">
  <label>${game.i18n.localize("EX2E.SpellQuickAddPenaltyScope")}</label>
  <select name="scope" style="flex:1">
    <option value="all">${game.i18n.localize("EX2E.SpellQuickAddPenaltyAll")}</option>
    <option value="physical">${game.i18n.localize("EX2E.SpellQuickAddPenaltyPhysical")}</option>
    <option value="social">${game.i18n.localize("EX2E.SpellQuickAddPenaltySocial")}</option>
    <option value="mental">${game.i18n.localize("EX2E.SpellQuickAddPenaltyMental")}</option>
  </select>
</div>
<div class="form-group">
  <label>${game.i18n.localize("EX2E.SpellQuickAddPenaltyValue")}</label>
  <input type="number" name="penaltyValue" value="2" min="1" max="10" style="width:5em">
</div>`;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("EX2E.SpellQuickAddPenaltyTitle") },
      content,
      ok: {
        label: game.i18n.localize("EX2E.Add"),
        callback: (_ev, button) => {
          const f = button.form;
          return {
            penaltyType: f.elements.penaltyType?.value || "internal",
            scope:       f.elements.scope?.value       || "all",
            value:       parseInt(f.elements.penaltyValue?.value) || 2,
          };
        }
      }
    });
    if (!result) return;
    const { penaltyType, scope, value } = result;
    const flagKey = penaltyType === "dv" ? "dvPenalty" : penaltyType === "external" ? "externalPenalty" : "internalPenalty";
    const nameKey = penaltyType === "dv" ? "EX2E.SpellAENameDVPenalty"
                  : penaltyType === "external" ? "EX2E.SpellAENameExternalPenalty"
                  : "EX2E.SpellAENameInternalPenalty";
    await this.document.createEmbeddedDocuments("ActiveEffect", [{
      name:     game.i18n.format(nameKey, { v: value, scope }),
      icon:     "icons/svg/degen.svg",
      changes:  [],
      transfer: false,
      disabled: false,
      flags:    { exalted2e: { [flagKey]: { value, type: scope } } }
    }]);
  }

  static async #onCreateAttrEffect(_event, _target) {
    const attrOptions = [
      ["strength","EX2E.AttrStrength"],["dexterity","EX2E.AttrDexterity"],["stamina","EX2E.AttrStamina"],
      ["charisma","EX2E.AttrCharisma"],["manipulation","EX2E.AttrManipulation"],["appearance","EX2E.AttrAppearance"],
      ["perception","EX2E.AttrPerception"],["intelligence","EX2E.AttrIntelligence"],["wits","EX2E.AttrWits"]
    ].map(([v,k]) => `<option value="${v}">${game.i18n.localize(k)}</option>`).join("");
    const content = `
<div class="form-group">
  <label>${game.i18n.localize("EX2E.SpellQuickAddAttrAttr")}</label>
  <select name="attr" style="flex:1">${attrOptions}</select>
</div>
<div class="form-group">
  <label>${game.i18n.localize("EX2E.SpellQuickAddAttrValue")}</label>
  <input type="number" name="attrValue" value="0" min="0" max="10" style="width:5em"
         data-tooltip="${game.i18n.localize('EX2E.SpellQuickAddAttrValueTooltip')}">
</div>`;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("EX2E.SpellQuickAddAttrTitle") },
      content,
      ok: {
        label: game.i18n.localize("EX2E.Add"),
        callback: (_ev, button) => {
          const f = button.form;
          return {
            attr:  f.elements.attr?.value  || "strength",
            value: parseInt(f.elements.attrValue?.value) || 0,
          };
        }
      }
    });
    if (!result) return;
    const { attr, value } = result;
    if (!attr) return;
    const attrLabel = game.i18n.localize(`EX2E.Attr${attr.charAt(0).toUpperCase()}${attr.slice(1)}`);
    await this.document.createEmbeddedDocuments("ActiveEffect", [{
      name:     game.i18n.format("EX2E.SpellAENameAttrBonus", { attr: attrLabel, v: value }),
      icon:     "icons/svg/upgrade.svg",
      changes:  [{ key: `system.attributes.${attr}.value`, mode: 2, value: String(value) }],
      transfer: false,
      disabled: false,
      flags:    {}
    }]);
  }

  static async #onRollSpellAttack(_event, _target) {
    const { rollSpellAttack } = await import("../../rolls/spell-attack.mjs");
    await rollSpellAttack(this.document.actor, this.document);
  }

  static async #onOpenFormula(_event, target) {
    const path  = target.dataset.path;
    const label = target.dataset.label ?? "";
    if (!path) return;
    const current = foundry.utils.getProperty(this.document, path) ?? "";
    const { FormulaBuilderDialog } = await import("../../dialogs/formula-builder-dialog.mjs");
    const result = await FormulaBuilderDialog.prompt({
      formula:   String(current),
      fieldName: label,
      actor:     this.document.actor ?? null
    });
    if (result !== null && result !== undefined) {
      await this.document.update({ [path]: result });
    }
  }

  static async #onAddAttackTag(_event, _target) {
    const tags = foundry.utils.deepClone(this.document.system.spellAttack?.tags ?? []);
    tags.push(EX2E.weaponTags?.[0] ?? "");
    await this.document.update({ "system.spellAttack.tags": tags });
  }

  static async #onRemoveAttackTag(_event, target) {
    const idx  = parseInt(target.dataset.index);
    const tags = foundry.utils.deepClone(this.document.system.spellAttack?.tags ?? []);
    tags.splice(idx, 1);
    await this.document.update({ "system.spellAttack.tags": null });
    await this.document.update({ "system.spellAttack.tags": tags });
  }

  _circleChoicesFor(tradition) {
    const keys = tradition === "necromancy"
      ? ["CircleShadowlands", "CircleLabyrinth", "CircleVoid"]
      : tradition === "weaving"
        ? ["CircleManMachine", "CircleGodMachine"]
        : ["CircleTerrestrial", "CircleCelestial", "CircleSolar"];
    return keys.map((k, i) => ({
      value: i + 1,
      label: game.i18n.localize(`EX2E.${k}`)
    }));
  }

}
