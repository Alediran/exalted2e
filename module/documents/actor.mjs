import { cleanCasteAbilities } from "../helpers/utils.mjs";

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class ExaltedSecondActor extends Actor {
  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
    const actorData = this;

    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }

  /**
   * @override
   * Augment the actor source data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.exalted2e || {};

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareCharacterDerivedData(actorData);
    this._prepareNpcDerivedData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    // Make modifications to data here. For example:
    const systemData = actorData.system;

    switch (actorData.type) {
      case "solar":
        this._prepareSolarData(systemData);
        break;
    }
  }

  _prepareCharacterDerivedData(actorData) {
    // Make modifications to data here. For example:
    const systemData = actorData.system;

    switch (actorData.type) {
      case "solar":
        this._prepareDerivedSolarData(systemData);
        break;
    }

    systemData.soak.bashing = systemData.attributes.stamina.value;
    systemData.soak.lethal = Math.floor(
      systemData.attributes.stamina.value / 2
    );
  }
  /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData(actorData) {
    if (!actorData.system.configuration.isNpc) return;

    // Make modifications to data here. For example:
    const systemData = actorData.system;
  }

  _prepareNpcDerivedData(actorData) {
    if (!actorData.system.configuration.isNpc) return;

    // Make modifications to data here. For example:
    const systemData = actorData.system;
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    // Starts off by populating the roll data with a shallow copy of `this.system`
    const data = { ...this.system };

    // Prepare character roll data.
    this._getCharacterRollData(data);
    this._getNpcRollData(data);

    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {}

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    // Process additional NPC data here.
  }

  /* Calculations for each type of caracter */
  _prepareSolarData(data) {
    cleanCasteAbilities(data);

    switch (data.caste.toLowerCase()) {
      case "dawn":
        data.abilities.archery.caste = true;
        data.abilities.martialarts.caste = true;
        data.abilities.melee.caste = true;
        data.abilities.thrown.caste = true;
        data.abilities.war.caste = true;
        break;
      case "zenith":
        data.abilities.integrity.caste = true;
        data.abilities.performance.caste = true;
        data.abilities.presence.caste = true;
        data.abilities.resistance.caste = true;
        data.abilities.survival.caste = true;
        break;
      case "twilight":
        data.abilities.craft.caste = true;
        data.abilities.investigation.caste = true;
        data.abilities.lore.caste = true;
        data.abilities.medicine.caste = true;
        data.abilities.occult.caste = true;
        break;
      case "night":
        data.abilities.athletics.caste = true;
        data.abilities.awareness.caste = true;
        data.abilities.dodge.caste = true;
        data.abilities.larceny.caste = true;
        data.abilities.stealth.caste = true;
        break;
      case "eclipse":
        data.abilities.bureaucracy.caste = true;
        data.abilities.linguistics.caste = true;
        data.abilities.ride.caste = true;
        data.abilities.sail.caste = true;
        data.abilities.socialize.caste = true;
        break;
    }
  }

  _prepareDerivedSolarData(data) {}
}
