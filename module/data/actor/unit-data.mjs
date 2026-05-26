import { computeUnitParryDV } from "../../rolls/mass-combat-math.mjs";

const fields = foundry.data.fields;

export class UnitData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      magnitude: new fields.SchemaField({
        value: new fields.NumberField({ integer: true, min: 0, initial: 3 }),
        max:   new fields.NumberField({ integer: true, min: 1, max: 10, initial: 5 })
      }),
      drill:            new fields.NumberField({ integer: true, min: 1, max: 5, initial: 2 }),
      might:            new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1 }),
      endurance:        new fields.NumberField({ integer: true, min: 0, max: 5, initial: 2 }),
      armorFatigue:     new fields.NumberField({ integer: true, min: 0, max: 4, initial: 0 }),
      morale:           new fields.NumberField({ integer: true, min: 1, max: 5, initial: 3 }),
      commanderActorId: new fields.StringField({ blank: true, initial: "" }),
      unitType:         new fields.StringField({ choices: ["extras", "elite", "heroic"], initial: "extras", blank: false }),
      description:      new fields.HTMLField({ blank: true }),
      formation:        new fields.StringField({ choices: ["none","unordered","skirmish","relaxed","close"], initial: "unordered", blank: false }),
      closeCombatRating:  new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1 }),
      rangedCombatRating: new fields.NumberField({ integer: true, min: 0, max: 5, initial: 0 }),
      closeDamageRating:  new fields.NumberField({ integer: true, min: 0, max: 5, initial: 1 }),
      rangedDamageRating: new fields.NumberField({ integer: true, min: 0, max: 5, initial: 0 }),
      armor:              new fields.NumberField({ integer: true, min: 0, max: 5, initial: 0 }),
      health: new fields.SchemaField({
        value: new fields.NumberField({ integer: true, min: 0, initial: 7 }),
        max:   new fields.NumberField({ integer: true, min: 1, initial: 7 })
      }),
      engaged:  new fields.BooleanField({ initial: false }),
      aimBonus: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      relays:            new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      relayCommandPool:  new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      chokepoint:        new fields.BooleanField({ initial: false }),
      chokeMaxAttackers: new fields.NumberField({ integer: true, min: 1, initial: 1 }),
      disbanded: new fields.BooleanField({ initial: false })
    };
  }

  prepareDerivedData() {
    const commanderActor = game.actors?.get(this.commanderActorId) ?? null;
    this.commanderActor = commanderActor;
    this.attackPool = (commanderActor?.system?.commandWarDice ?? 0) + this.drill;
    this.isRouted   = this.magnitude.value === 0;

    const warRating = commanderActor?.system?.abilities?.war?.value ?? 0;
    this.effectiveCCR = this.formation === "close"
      ? Math.min(this.closeCombatRating * 2, warRating * 2)
      : Math.min(this.closeCombatRating, warRating);
    this.effectiveRCR = Math.min(this.rangedCombatRating, warRating);

    if (commanderActor) {
      this.unitParryDV = computeUnitParryDV(
        commanderActor.currentParryDV,
        this.closeCombatRating
      );
      this.unitDodgeDV = commanderActor.currentDodgeDV;
    } else {
      this.unitParryDV = this.drill;
      this.unitDodgeDV = this.drill;
    }

    for (const ae of (this.parent?.effects ?? [])) {
      if (ae.disabled) continue;
      const dp = ae.flags?.exalted2e?.dvPenalty;
      if (dp) {
        const v = dp.value ?? 0;
        if (dp.type === "parry" || dp.type === "all" || dp.type === "onslaught")
          this.unitParryDV = Math.max(0, this.unitParryDV - v);
        if (dp.type === "dodge" || dp.type === "all" || dp.type === "onslaught")
          this.unitDodgeDV = Math.max(0, this.unitDodgeDV - v);
      }
      const db = ae.flags?.exalted2e?.dvBonus;
      if (db) {
        this.unitParryDV = Math.max(0, this.unitParryDV + (db.parry ?? 0));
        this.unitDodgeDV = Math.max(0, this.unitDodgeDV + (db.dodge ?? 0));
      }
    }
  }
}
