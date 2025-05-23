import ExaltedSecondActorBase from "./base-actor.mjs";

export default class ExaltedSecondCharacter extends ExaltedSecondActorBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    return schema;
  }

  prepareDerivedData() {
    // Loop through ability scores, and add their modifiers to our sheet output.
    for (const key in this.abilities) {
      // Calculate the modifier using d20 rules.
      this.abilities[key].mod = Math.floor(
        (this.abilities[key].value - 10) / 2
      );
      // Handle ability label localization.
      this.abilities[key].label =
        game.i18n.localize(CONFIG.EXALTED2E.abilities[key]) ?? key;
    }
  }

  getRollData() {
    const data = {};

    return data;
  }
}
