import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

/**
 * ResplendencyData — a Charm-like power granted by a resplendent destiny's
 * College. Activation (spend Endurance, roll Paradox, optional stat-bonus AE)
 * lives in module/combat/resplendency.mjs. The owning destiny is linked via
 * the item flag `exalted2e.parentDestinyId` (items cannot nest under items).
 */
export class ResplendencyData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      college:       new fields.StringField({ initial: "", blank: true }),
      enduranceCost: new fields.NumberField({ initial: 1, min: 0, integer: true }),
      paradoxDice:   new fields.NumberField({ initial: 0, min: 0, integer: true }),
      keyword:       new fields.StringField({ initial: "", blank: true }),
      isStatBonus:   new fields.BooleanField({ initial: false }),
      changes: new fields.ArrayField(new fields.SchemaField({
        key:   new fields.StringField({ initial: "", blank: true }),
        mode:  new fields.NumberField({ initial: 2, integer: true }),
        value: new fields.StringField({ initial: "", blank: true }),
      })),
      description:   new fields.HTMLField({ initial: "" }),
      descriptions:  descriptionsField(),
    };
  }
}
