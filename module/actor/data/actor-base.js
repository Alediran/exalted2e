import CreateHelper from "../../../../worldofdarkness/module/scripts/create-helpers";

/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class ExaltedActor extends Actor {
  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData() {
    super.prepareData();

    const actorData = this;
    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareCharacterData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    let listData = [];

    actorData.listData = listData;
  }

  /**
   * @override
   * Handle data that happens before the creation of a new item document
   */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    switch (data.type) {
      case CONFIG.exalted.sheettype.solar:
        await CreateHelper.SetSolarAbilities(this, CONFI);
    }
    if (data.type == CONFIG.worldofdarkness.sheettype.mortal) {
      await CreateHelper.SetMortalAbilities(
        this,
        CONFIG.worldofdarkness.defaultMortalEra
      );
    }
  }
}
