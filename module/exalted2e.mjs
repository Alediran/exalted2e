// Import document classes.
import { ExaltedSecondActor } from "./documents/actor.mjs";
import { ExaltedSecondItem } from "./documents/item.mjs";
// Import sheet classes.
import { ExaltedSecondActorSheet } from "./sheets/actor-sheet.mjs";
import { ExaltedSecondItemSheet } from "./sheets/item-sheet.mjs";
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { EXALTED2E } from "./helpers/config.mjs";

// Import Data classes.
import ExaltedSecondSolarCharacter from "./data/actor-solar.mjs";
import ExaltedSecondLunarCharacter from "./data/actor-lunar.mjs";
import ExaltedSecondNPC from "./data/actor-npc.mjs";

import ExaltedSecondItemCharm from "./data/item-charm.mjs";
import ExaltedSecondSpell from "./data/item-spell.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once("init", function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.exalted2e = {
    entities: {
      ExaltedSecondActor,
      ExaltedSecondItem,
    },
    rollItemMacro,
  };

  //Set Data Models
  CONFIG.Actor.dataModels = {
    solar: ExaltedSecondSolarCharacter,
    lunar: ExaltedSecondLunarCharacter,
  };

  CONFIG.Item.dataModels = {
    charm: ExaltedSecondItemCharm,
    spell: ExaltedSecondSpell,
  };

  // Add custom constants for configuration.
  CONFIG.EXALTED2E = EXALTED2E;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "(@attributes.wits.value + @abilities.awareness.value)d10x10cs>=7",
    decimals: 2,
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = ExaltedSecondActor;
  CONFIG.Item.documentClass = ExaltedSecondItem;

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Register sheet application classes
  foundry.documents.collections.Actors.unregisterSheet(
    "core",
    foundry.appv1.sheets.ActorSheet
  );

  foundry.documents.collections.Actors.registerSheet(
    "exalted2e",
    ExaltedSecondActorSheet,
    {
      makeDefault: true,
      label: "EXALTED2E.SheetLabels.Actor",
    }
  );

  foundry.documents.collections.Items.unregisterSheet(
    "core",
    foundry.appv1.sheets.ItemSheet
  );
  foundry.documents.collections.Items.registerSheet(
    "exalted2e",
    ExaltedSecondItemSheet,
    {
      makeDefault: true,
      label: "EXALTED2E.SheetLabels.Item",
    }
  );

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

const reduceOp = function (args, reducer) {
  args = Array.from(args);
  args.pop(); // => options
  var first = args.shift();
  return args.reduce(reducer, first);
};

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper("toLowerCase", function (str) {
  return str.toLowerCase();
});

Handlebars.registerHelper("ifEquals", function (arg1, arg2, options) {
  return arg1 == arg2 ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper("switch", function (value, options) {
  this.switch_value = value;
  return options.fn(this);
});

Handlebars.registerHelper("case", function (value, options) {
  if (value == this.switch_value) {
    return options.fn(this);
  }
});

Handlebars.registerHelper("default", function (value, options) {
  return true; ///We can add condition if needs
});

Handlebars.registerHelper("numLoop", function (num, options) {
  let ret = "";

  for (let i = 0, j = num; i < j; i++) {
    ret = ret + options?.fn(i);
  }

  return ret;
});

Handlebars.registerHelper(
  "numLoopCertainStart",
  function (num, startNum, options) {
    let ret = "";
    for (let i = startNum, j = num + startNum; i < j; i++) {
      ret = ret + options.fn(i);
    }
    return ret;
  }
);

Handlebars.registerHelper({
  eq: function () {
    return reduceOp(arguments, (a, b) => a === b);
  },
  ne: function () {
    return reduceOp(arguments, (a, b) => a !== b);
  },
  lt: function () {
    return reduceOp(arguments, (a, b) => a < b);
  },
  gt: function () {
    return reduceOp(arguments, (a, b) => a > b);
  },
  lte: function () {
    return reduceOp(arguments, (a, b) => a <= b);
  },
  gte: function () {
    return reduceOp(arguments, (a, b) => a >= b);
  },
  and: function () {
    return reduceOp(arguments, (a, b) => a && b);
  },
  or: function () {
    return reduceOp(arguments, (a, b) => a || b);
  },
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== "Item") return;
  if (!data.uuid.includes("Actor.") && !data.uuid.includes("Token.")) {
    return ui.notifications.warn(
      "You can only create macro buttons for owned Items"
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.exalted2e.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "exalted2e.itemMacro": true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: "Item",
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}
