import {
  attributeField,
  abilityField,
  resourceField,
  specialtyField,
  valueField,
} from "../template/data-schema.mjs";
import ExaltedSecondDataModel from "./base-model.mjs";

const fields = foundry.data.fields;

export default class ExaltedSecondActorBase extends ExaltedSecondDataModel {
  static defineSchema() {
    return {
      caste: new fields.StringField({ initial: "Dawn" }),
      concept: new fields.StringField({ initial: "Placeholder" }),
      motivation: new fields.StringField({ initial: "Win" }),
      anima: new fields.StringField({ initial: "Blue Jay" }),
      attributes: new fields.SchemaField({
        strength: attributeField("physical"),
        charisma: attributeField("social"),
        perception: attributeField("mental"),
        dexterity: attributeField("physical"),
        manipulation: attributeField("social"),
        intelligence: attributeField("mental"),
        stamina: attributeField("physical"),
        appearance: attributeField("social"),
        wits: attributeField("mental"),
      }),
      abilities: new fields.SchemaField({
        archery: abilityField("dexterity"),
        athletics: abilityField("dexterity"),
        awareness: abilityField("perception"),
        bureaucracy: abilityField("intelligence"),
        craft: abilityField("intelligence"),
        dodge: abilityField("dexterity"),
        integrity: abilityField("charisma"),
        investigation: abilityField("intelligence"),
        larceny: abilityField("dexterity"),
        linguistics: abilityField("intelligence"),
        lore: abilityField("intelligence"),
        martialarts: abilityField("dexterity"),
        medicine: abilityField("intelligence"),
        melee: abilityField("dexterity"),
        occult: abilityField("intelligence"),
        performance: abilityField("charisma"),
        presence: abilityField("charisma"),
        resistance: abilityField("stamina"),
        ride: abilityField("dexterity"),
        sail: abilityField("dexterity"),
        socialize: abilityField("charisma"),
        stealth: abilityField("dexterity"),
        survival: abilityField("perception"),
        thrown: abilityField("dexterity"),
        war: abilityField("intelligence"),
      }),
      specialties: new fields.ArrayField(specialtyField()),
      virtues: new fields.SchemaField({
        compassion: resourceField(1, 5),
        conviction: resourceField(1, 5),
        temperance: resourceField(1, 5),
        valor: resourceField(1, 5),
      }),
      willpower: resourceField(2, 10),
      essence: valueField(1, 5),
      limit: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0 }),
        flaw: new fields.StringField({ initial: "" }),
      }),
      experience: new fields.SchemaField({
        current: new fields.NumberField({ initial: 0 }),
        total: new fields.NumberField({ initial: 0 }),
      }),
      biography: new fields.HTMLField({ initial: "" }),
    };
  }
}
