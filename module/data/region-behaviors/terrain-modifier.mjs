export class TerrainModifierBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      terrainType:   new fields.StringField({
        choices: { elevation: "EX2E.TerrainTypeElevation", cover: "EX2E.TerrainTypeCover" },
        initial: "elevation",
        required: true,
      }),
      label:         new fields.StringField({ initial: "", blank: true }),
      accuracyBonus: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
      dvBonus:       new fields.NumberField({ initial: 0, integer: true, min: 0 }),
      soakBonus:     new fields.NumberField({ initial: 0, integer: true, min: 0 }),
    };
  }
}
