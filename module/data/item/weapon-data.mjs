import { EX2E } from "../../config.mjs";
import { computeWielderPenalty } from "./weapon-math.mjs";

const fields = foundry.data.fields;

function modeSchema() {
  return new fields.SchemaField({
    name:           new fields.StringField({ initial: "" }),
    speed:          new fields.NumberField({ initial: 5, min: 0,  max: 10,  integer: true }),
    accuracy:       new fields.NumberField({ initial: 0, min: -5, max: 10,  integer: true }),
    damage:         new fields.NumberField({ initial: 1, min: 0,  max: 20,  integer: true }),
    damageType:     new fields.StringField({ initial: "lethal", choices: ["bashing","lethal","aggravated"] }),
    overwhelming:   new fields.NumberField({ initial: 1, min: 0,  max: 20,  integer: true }),
    defense:        new fields.NumberField({ initial: 0, min: -5, max: 10,  integer: true }),
    rate:           new fields.NumberField({ initial: 1, min: 0,  max: 10,  integer: true }),
    range:          new fields.NumberField({ initial: 0, min: 0,  max: 400, integer: true }),
    minStrength:    new fields.NumberField({ initial: 0, min: 0,  max: 10,  integer: true }),
    minDexterity:   new fields.NumberField({ initial: 0, min: 0,  max: 10,  integer: true }),
    minMartialArts: new fields.NumberField({ initial: 0, min: 0,  max: 10,  integer: true }),
    tags:              new fields.ArrayField(new fields.StringField({ blank: true }), { initial: [] }),
    areaShape:         new fields.StringField({ initial: "circle" }),
    areaSize:          new fields.StringField({ initial: "3" }),
    areaResistPool:    new fields.StringField({ initial: "stamina+resistance" }),
    areaResistDifficulty: new fields.StringField({ initial: "1" }),
    areaResistEffect:  new fields.StringField({ initial: "avoid" })
  });
}

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // ── Modes of Use ─────────────────────────────────────────────────────
      modes: new fields.ArrayField(modeSchema(), {
        initial: [{ name: "", tags: [] }]
      }),

      // ── Attunement ───────────────────────────────────────────────────────
      artifact:         new fields.BooleanField({ initial: false }),
      magicalMaterial:  new fields.StringField({ initial: "", blank: true }),
      attunementCost:   new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
      attuned:          new fields.BooleanField({ initial: false }),
      artifactRating:   new fields.NumberField({ initial: 0, min: 0, max: 5,  integer: true }),
      hearthstoneSlots: new fields.NumberField({ initial: 0, min: 0, max: 3,  integer: true }),
      hearthstones:     new fields.ArrayField(new fields.StringField({ blank: true })),

      // ── Description / Equipped ───────────────────────────────────────────
      description: new fields.HTMLField({ initial: "" }),
      equipped:    new fields.BooleanField({ initial: false }),
      slot:        new fields.StringField({ initial: "hands", blank: false, choices: ["hands","feet","armor","head","none"] })
    };
  }

  prepareDerivedData() {
    const meleeTable       = EX2E.getActiveMeleeMaterialBonuses();
    const artifactAttuned  = this.artifact && this.attuned && this.magicalMaterial;

    const actor      = this.parent?.parent;
    const hasWielder = actor?.type === "character";
    const wielderStr = hasWielder ? (actor.system.attributes?.strength?.value  ?? 0) : 0;
    const wielderDex = hasWielder ? (actor.system.attributes?.dexterity?.value ?? 0) : 0;
    const wielderMA  = hasWielder ? (actor.system.abilities?.martialArts?.value ?? 0) : 0;

    for (const mode of this.modes) {
      const materialTable = mode.range > 0
        ? EX2E.rangedMagicalMaterialBonuses[this.magicalMaterial]
        : meleeTable[this.magicalMaterial];
      const bonus = artifactAttuned ? (materialTable ?? {}) : {};
      const rangeBonus = mode.tags.includes("Thrown") ? (bonus.thrownRange ?? 0) : (bonus.range ?? 0);

      const missingDots = hasWielder
        ? computeWielderPenalty(mode, {
            strength: wielderStr, dexterity: wielderDex, martialArts: wielderMA
          })
        : 0;

      mode.wielderPenalty    = missingDots;
      mode.effectiveSpeed    = mode.speed    + (bonus.speed    ?? 0) + missingDots;
      mode.effectiveAccuracy = mode.accuracy + (bonus.accuracy ?? 0) - missingDots;
      mode.effectiveDamage   = mode.damage   + (bonus.damage   ?? 0);
      mode.effectiveDefense  = mode.defense  + (bonus.defense  ?? 0) - missingDots;
      mode.effectiveRate     = mode.rate     + (bonus.rate     ?? 0);
      mode.effectiveRange    = mode.range    + rangeBonus;

      const typeSuffix         = mode.damageType === "lethal" ? "L" : mode.damageType === "aggravated" ? "A" : "B";
      const overwhelmingSuffix = mode.tags.includes("Overwhelming") ? `/${mode.overwhelming ?? 1}` : "";

      mode.accuracyLabel = mode.effectiveAccuracy >= 0 ? `+${mode.effectiveAccuracy}` : `${mode.effectiveAccuracy}`;
      mode.defenseLabel  = mode.effectiveDefense  >= 0 ? `+${mode.effectiveDefense}`  : `${mode.effectiveDefense}`;
      mode.damageLabel   = `${mode.effectiveDamage}${typeSuffix}${overwhelmingSuffix}`;
    }
  }
}
