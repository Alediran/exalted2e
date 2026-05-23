const fields = foundry.data.fields;

/**
 * Data model for the "unit" actor type – mass combat units consisting of
 * groups of soldiers commanded by a hero or other leader.
 */
export class UnitData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      magnitude: new fields.SchemaField({
        value: new fields.NumberField({ integer: true, min: 0, initial: 3 }),
        max:   new fields.NumberField({ integer: true, min: 1, max: 10, initial: 5 })
      }),
      drill:            new fields.NumberField({ integer: true, min: 1, max: 5, initial: 2 }),
      might:            new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1 }),
      endurance:        new fields.NumberField({ integer: true, min: 1, max: 5, initial: 2 }),
      morale:           new fields.NumberField({ integer: true, min: 1, max: 5, initial: 3 }),
      commanderActorId: new fields.StringField({ blank: true, initial: "" }),
      unitType:         new fields.StringField({ choices: ["extras", "elite", "heroic"], initial: "extras", blank: false }),
      description:      new fields.HTMLField({ blank: true })
    };
  }

  prepareDerivedData() {
    const commanderActor = game.actors?.get(this.commanderActorId) ?? null;
    this.commanderActor = commanderActor;
    this.attackPool = (commanderActor?.system?.commandWarDice ?? 0) + this.drill;
    this.isRouted = this.magnitude.value === 0;
  }
}
