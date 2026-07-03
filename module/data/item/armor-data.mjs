import { EX2E } from "../../config.mjs";
import { descriptionsField } from "./_shared/descriptions-field.mjs";

const fields = foundry.data.fields;

export class ArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // ── Soak Values ──────────────────────────────────────────────────────
      soak: new fields.SchemaField({
        bashing:    new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
        lethal:     new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
        aggravated: new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true })
      }),
      hardness: new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),

      // ── Penalties ────────────────────────────────────────────────────────
      mobilityPenalty: new fields.NumberField({ initial: 0, min: -4, max: 0, integer: true }),
      fatiguePenalty:  new fields.NumberField({ initial: 0, min: -4, max: 0, integer: true }),

      // ── Attunement ───────────────────────────────────────────────────────
      artifact:        new fields.BooleanField({ initial: false }),
      magicalMaterial: new fields.StringField({ initial: "", blank: true }),
      attunementCost:  new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
      attuned:              new fields.BooleanField({ initial: false }),
      attunementMotesCover: new fields.NumberField({ initial: 0, min: 0, max: 20, integer: true }),
      attunedViaAttunement: new fields.BooleanField({ initial: false }),
      artifactRating:       new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }),
      hearthstoneSlots: new fields.NumberField({ initial: 0, min: 0, max: 3, integer: true }),
      hearthstones:     new fields.ArrayField(new fields.StringField({ blank: true })),

      // ── Tags ─────────────────────────────────────────────────────────────
      tags: new fields.ArrayField(new fields.StringField({ blank: true })),

      // ── Description ──────────────────────────────────────────────────────
      description:  new fields.HTMLField({ initial: "" }),
      descriptions: descriptionsField(),
      equipped:    new fields.BooleanField({ initial: false }),
      slot:        new fields.StringField({ initial: "armor", blank: false, choices: ["hands","feet","armor","head","none"] })
    };
  }

  prepareDerivedData() {
    // Apply magical material bonuses when the armor is an attuned artifact
    const armorTable = EX2E.getActiveArmorMaterialBonuses();
    const bonus = (this.artifact && this.attuned && this.magicalMaterial)
      ? (armorTable[this.magicalMaterial] ?? {})
      : {};

    const sb = bonus.soak ?? {};
    this.effectiveSoak = {
      bashing:    this.soak.bashing    + (sb.bashing    ?? 0),
      lethal:     this.soak.lethal     + (sb.lethal     ?? 0),
      aggravated: this.soak.aggravated + (sb.aggravated ?? 0)
    };
    this.effectiveHardness        = this.hardness        + (bonus.hardness        ?? 0);
    // Penalties are negative; material bonus is positive and reduces them, capped at 0
    this.effectiveMobilityPenalty = Math.min(0, this.mobilityPenalty + (bonus.mobilityPenalty ?? 0));
    this.effectiveFatiguePenalty  = Math.min(0, this.fatiguePenalty  + (bonus.fatiguePenalty  ?? 0));
  }
}
