/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {
    return loadTemplates([
      // Actor Sheet Partials
      "systems/chromaverse/templates/actor/parts/actor-details.html",
      "systems/chromaverse/templates/actor/parts/actor-defense.html",
      "systems/chromaverse/templates/actor/parts/actor-traits.html",
      "systems/chromaverse/templates/actor/parts/actor-actions.html",
      "systems/chromaverse/templates/actor/parts/action-attack.html",
      "systems/chromaverse/templates/actor/parts/action-boon.html",
      "systems/chromaverse/templates/actor/parts/gear-weapon.html",
      "systems/chromaverse/templates/actor/parts/gear-armor.html",
      "systems/chromaverse/templates/actor/parts/gear-generic.html",
      "systems/chromaverse/templates/actor/parts/gear-feat.html",
      "systems/chromaverse/templates/actor/parts/gear-focus.html",
      "systems/chromaverse/templates/actor/parts/gear-perk.html",

      // Item Sheet Partials
      "systems/chromaverse/templates/item/parts/attack-target.html"
    ]);
  };