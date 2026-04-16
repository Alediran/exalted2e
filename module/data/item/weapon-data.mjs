import { EX2E } from "../../config.mjs";

const fields = foundry.data.fields;

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // ── Combat Stats ────────────────────────────────────────────────────
      speed:       new fields.NumberField({ initial: 5, min: 0, max: 10,  integer: true }),
      accuracy:    new fields.NumberField({ initial: 0, min: -5, max: 10, integer: true }),
      damage:      new fields.NumberField({ initial: 1, min: 0, max: 20,  integer: true }),
      damageType:  new fields.StringField({ initial: "lethal", choices: ["bashing","lethal","aggravated"] }),
      defense:     new fields.NumberField({ initial: 0, min: -5, max: 10, integer: true }),
      rate:        new fields.NumberField({ initial: 1, min: 0, max: 10,  integer: true }),
      range:       new fields.NumberField({ initial: 0, min: 0, max: 400, integer: true }),

      // ── Tags ─────────────────────────────────────────────────────────────
      tags:       new fields.ArrayField(new fields.StringField({ blank: true })),

      // ── Attunement ───────────────────────────────────────────────────────
      artifact:         new fields.BooleanField({ initial: false }),
      magicalMaterial:  new fields.StringField({ initial: "", blank: true }),
      attunementCost:   new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
      attuned:          new fields.BooleanField({ initial: false }),

      // ── Description ──────────────────────────────────────────────────────
      description: new fields.HTMLField({ initial: "" }),
      equipped:    new fields.BooleanField({ initial: false })
    };
  }

  prepareDerivedData() {
    // Apply magical material bonuses when the weapon is an attuned artifact
    const meleeTable = EX2E.getActiveMeleeMaterialBonuses();
    const magicalMaterialBonuses = this.range > 0
      ? EX2E.rangedMagicalMaterialBonuses[this.magicalMaterial]
      : meleeTable[this.magicalMaterial];
    
    const bonus = (this.artifact && this.attuned && this.magicalMaterial)
      ? (magicalMaterialBonuses ?? {}) : {};

    const rangeBonus = this.tags.includes('thrown') ? (bonus.thrownRange ?? 0) : (bonus.range ?? 0);

    this.effectiveSpeed    = this.speed    + (bonus.speed    ?? 0);
    this.effectiveAccuracy = this.accuracy + (bonus.accuracy ?? 0);
    this.effectiveDamage   = this.damage   + (bonus.damage   ?? 0);
    this.effectiveDefense  = this.defense  + (bonus.defense  ?? 0);
    this.effectiveRate     = this.rate     + (bonus.rate     ?? 0);
    this.effectiveRange    = this.range + rangeBonus;


    this.accuracyLabel = this.effectiveAccuracy >= 0 ? `+${this.effectiveAccuracy}` : `${this.effectiveAccuracy}`;
    this.defenseLabel  = this.effectiveDefense  >= 0 ? `+${this.effectiveDefense}`  : `${this.effectiveDefense}`;
    this.damageLabel   = `${this.effectiveDamage}${this.damageType === "lethal" ? "L" : this.damageType === "aggravated" ? "A" : "B"}`;
  }
}
