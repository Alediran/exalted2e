import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      resourcesCost:    new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }),
      quantity:         new fields.NumberField({ initial: 1, min: 1, max: 999, integer: true }),
      description:      new fields.HTMLField({ initial: "" }),
      descriptions:     descriptionsField(),
      equipped:         new fields.BooleanField({ initial: false }),
      isBroken:         new fields.BooleanField({ initial: false }),
      slot:             new fields.StringField({ initial: "none", blank: false, choices: ["hands","feet","armor","head","none"] }),
      artifact:         new fields.BooleanField({ initial: false }),
      magicalMaterial:  new fields.StringField({ initial: "", blank: true }),
      attunementCost:   new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
      attuned:          new fields.BooleanField({ initial: false }),
      artifactRating:   new fields.NumberField({ initial: 0, min: 0, max: 6,  integer: true }),
      hearthstoneSlots: new fields.NumberField({ initial: 0, min: 0, max: 3,  integer: true }),
      hearthstones:     new fields.ArrayField(new fields.StringField({ blank: true })),

      // Passive bonuses applied when equipped AND attuned.
      // Aggregated into system.bonuses.* in ExaltedActor._applyEquipmentBonuses.
      bonusDodgeDice:                new fields.NumberField({ initial: 0, min: 0, integer: true }),
      bonusSoakBashing:              new fields.NumberField({ initial: 0, min: 0, integer: true }),
      bonusSoakLethal:               new fields.NumberField({ initial: 0, min: 0, integer: true }),
      bonusAccuracy:                 new fields.NumberField({ initial: 0, min: 0, integer: true }),
      bonusParry:                    new fields.NumberField({ initial: 0, min: 0, integer: true }),
      bonusDamageDice:               new fields.NumberField({ initial: 0, min: 0, integer: true }),
      bonusSpeedReduction:           new fields.NumberField({ initial: 0, min: 0, integer: true }),
      bonusAttackerSoakReducBashing: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      bonusAttackerSoakReducLethal:  new fields.NumberField({ initial: 0, min: 0, integer: true }),
      bonusPerceptionDice:           new fields.NumberField({ initial: 0, min: 0, integer: true })
    };
  }
}
