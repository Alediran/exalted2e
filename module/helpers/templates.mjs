/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return foundry.applications.handlebars.loadTemplates([
    // Actor partials.
    "systems/exalted2e/templates/actor/parts/actor-biography.hbs",
    "systems/exalted2e/templates/actor/parts/actor-charms.hbs",
    "systems/exalted2e/templates/actor/parts/actor-details.hbs",
    "systems/exalted2e/templates/actor/parts/actor-effects.hbs",
    "systems/exalted2e/templates/actor/parts/actor-features.hbs",
    "systems/exalted2e/templates/actor/parts/actor-items.hbs",
    "systems/exalted2e/templates/actor/parts/actor-solar-abilities.hbs",
    "systems/exalted2e/templates/actor/parts/actor-lunar-abilities.hbs",
    // Item partials
    "systems/exalted2e/templates/item/parts/item-effects.hbs",
  ]);
};
