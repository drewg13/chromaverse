import { rollTrait, rollChroma, rollItem } from "../util/dice.js";
import { move_action_up, move_feat_up, move_gear_up } from "./item-movement.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class olActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    const options = foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["chromaverse", "sheet", "actor", "character"],
      width: 1200,
      height: 600,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
      dragDrop: [{dragSelector: ".macro", dropSelector: null}]
    });
    return options;
  }

  /** @override */
  get template() {
    return "systems/chromaverse/templates/actor/actor-sheet.html";
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const actorData = super.getData();
    const sheetData = actorData.data;
    sheetData.owner = actorData.owner;
    sheetData.editable = actorData.editable;
    // console.log(actorData);

    if (sheetData.actions === undefined) {
      sheetData.actions = [];
      sheetData.gear    = [];
      sheetData.feats   = [];
      sheetData.perks   = [];
    }
    actorData.items.forEach(item => {
      if (item.system.action)
        sheetData.actions.push(item);
      if (item.system.gear)
        sheetData.gear.push(item);
      if (item.type === 'feat')
        sheetData.feats.push(item);
      else if (item.type === 'perk')
        sheetData.perks.push(item);
    });
    sheetData.actions.sort((a, b) => a.system.action.index - b.system.action.index);
    sheetData.gear.sort((a, b) => a.system.gear.index - b.system.gear.index);
    sheetData.feats.sort((a, b) => a.system.index - b.system.index);
    sheetData.system.notes = await TextEditor.enrichHTML(sheetData.system.notes, {secrets: actorData.isOwner});

    return sheetData;
  }

  /** @override */
  async _onDropItemCreate(itemData) {
    const data = await this.getData();
    if (itemData.system.action) {
      itemData.system.action.index = data.actions.length;
      itemData.system.action.name = itemData.name;
    }

    if (itemData.system.gear)
      itemData.system.gear.index = data.gear.length;

    if (itemData.type === 'feat')
      itemData.system.index = data.feats.length;

    // Create the owned item as normal
    return super._onDropItemCreate(itemData);
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html.find(".update-box").click(this._onUpdateBoxClick.bind(this));

    html.find(".add-asset").click( ev => {
      const dataset = ev.currentTarget.dataset;
      let type = dataset.type;
      this.actor.createEmbeddedDocuments("Item",[{ type: type, name: "New " + type }], {renderSheet: false });
    });

    html.find('.macro').on('dragstart', ev => {
      const dataset = ev.currentTarget.dataset;
      dataset.actor = this.actor.uuid;
      ev.originalEvent.dataTransfer.setData("text/plain", JSON.stringify(dataset));
    });

    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      const tag = ev.currentTarget;
      const item = this.actor.items.get(tag.dataset.item);
      item.sheet.render(true);
    });

    // Move items up in their corresponding rows
    html.find('.action-move-up').click(move_action_up.bind(this));
    html.find('.gear-move-up').click(move_gear_up.bind(this));
    html.find('.feat-move-up').click(move_feat_up.bind(this));

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const tag = ev.currentTarget;
      const item = this.actor.items.get(tag.dataset.item);
      item.delete();
    });

    // Update action 'items' directly
    html.find('.action-edit').change( ev => {
      const tag = ev.currentTarget;
      const item = this.actor.items.get(tag.dataset.item);
      const field = tag.dataset.field;
      const value = tag.value;

      let data = foundry.utils.deepClone(item.system);
      if( field === 'action_trait') data.action.trait = value;
      else if( field === 'action_name') data.action.name = value;
      else if (field === 'action_ap') data.action.default_ap = value;
      else if (field === 'action_adv') data.action.default_adv = value;
      else if( field === 'notes') data.details.notes = value;
      else if( field === 'attack') {
        // Set both attack trait and find its target
        data.action.trait = value;
        data.attacks.forEach(attack => {
          if (attack.trait === value)
            data.action.target = attack.target;
        });
      }
      item.update({"system": data});
    });

    // Update curr hp of npcs if max hp changes
    html.find('.npc_resolve_edit').change(ev => {
      const resolve_val = Number( $(ev.currentTarget).val() );
      const data = this.actor.system;
      const resolve = data.defense.resolve;
      resolve.max = resolve_val;
      resolve.value = resolve_val;
      this.actor.update({ "system.defense": { resolve } } );
    });

    html.find(".update-npc-traits").click(ev => {
      const btn = $(ev.currentTarget);
      if (btn.html() === "Edit")
        btn.html("Save");
      else {
        let data = {}
        html.find(".npc-trait-setter").each((i, obj) => {
          data[`system.traits.${obj.dataset.group}.${obj.dataset.trait}.score`] = parseInt(obj.value);
        });
        html.find(".npc-chroma-setter").each((i, obj) => {
          data[`system.chroma.${obj.dataset.group}.${obj.dataset.chroma}.score`] = parseInt(obj.value);
        });
        this.actor.update(data);
        btn.html("Edit");
      }
      html.find(".npc-traits-display").toggle();
      html.find(".npc-traits-edit").toggle();
    });

    // Rollable abilities.
    html.find('.rollable').click(this._onRoll.bind(this));
    html.find('.init-rollable').click(ev => {
      this.actor.rollInitiative({createCombatants: true});
    });

    // Configurable settings.
    html.find('.settings').click(this._onConfigure.bind(this));
    html.find('.trait-settings').click(this._onTraitsConfigure.bind(this));
    html.find('.chroma-settings').click(this._onChromaConfigure.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async _onRoll(event) {
    event.preventDefault();
    const ctrl_held = event.ctrlKey || event.metaKey;
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Roll using the appropriate logic -- item vs trait
    if (dataset.item)
      rollItem(this.actor, this.actor.items.get(dataset.item), ctrl_held);
    else if (dataset.trait)
      rollTrait(this.actor, dataset.trait, ctrl_held);
    else if (dataset.chroma)
      rollChroma(this.actor, dataset.chroma, ctrl_held);
  }

  /**
   * Handle clickable settings.
   * @param {Event} event The originating click event
   * @private
   */
  async _onConfigure(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    const subCat = dataset.defense;
    const data = this.actor.system;
    const defense = data.defense;

    let result = await this._SettingsDialog(dataset.name, defense[subCat]);
    if( result ) {
      result.forEach((item, index) => {
        defense[subCat].formula[index].active = item.value;
      });
      let update = { system: {defense} }
      await this.actor.update( update );
    }
  }

  async _SettingsDialog(name, defense) {
    const template = "systems/chromaverse/templates/dialog/defense-settings.html";
    const traits = this.actor.system.traits;
    const data = { 'name': name, 'formula': defense.formula, 'traits': traits }

    const html = await renderTemplate(template, data);
    // Create the Dialog window
    return new Promise(resolve => {
        new Dialog({
            title: data.name,
            content: html,
            buttons: {
                update: {
                    label: "Update",
                    callback: html => resolve(html[0].querySelectorAll("select"))
                }
            },
            default: "update",
            close: html => resolve(null)
        }).render(true);
    });
  }

  async _onTraitsConfigure(event) {
    event.preventDefault();
    const data = this.actor.system;
    const traits = data.traits;

    let result = await this._TraitSettingsDialog();
    if( result ) {
      result.forEach((item, index) => {
        const dataset = item.dataset
        if (item.value !== '')
          traits[dataset.group][dataset.trait]['bonus'] = parseInt(item.value);
      });
      let update = { system: { traits: traits } };
      await this.actor.update(update);
    }
  }

  async _onChromaConfigure(event) {
    event.preventDefault();
    const data = this.actor.system;
    const chroma = data.chroma;

    let result = await this._ChromaSettingsDialog();
    if( result ) {
      result.forEach((item, index) => {
        const dataset = item.dataset
        if (item.value !== '')
          chroma[dataset.group][dataset.chroma]['bonus'] = parseInt(item.value);
      });
      let update = { system: { chroma: chroma } };
      await this.actor.update(update);
    }
  }

  async _TraitSettingsDialog() {
    const template = "systems/chromaverse/templates/dialog/trait-settings.html";
    const traits = this.actor.system.traits;
    const data = { 'traits': traits }

    const html = await renderTemplate(template, data);
    // Create the Dialog window
    return new Promise(resolve => {
        new Dialog({
            title: data.name,
            content: html,
            buttons: {
                update: {
                    label: "Update",
                    callback: html => resolve(html[0].querySelectorAll("input"))
                }
            },
            default: "update",
            close: html => resolve(null)
        }).render(true);
    });
  }

  async _ChromaSettingsDialog() {
    const template = "systems/chromaverse/templates/dialog/chroma-settings.html";
    const chroma = this.actor.system.chroma;
    const data = { 'chroma': chroma }

    const html = await renderTemplate(template, data);
    // Create the Dialog window
    return new Promise(resolve => {
      new Dialog({
        title: data.name,
        content: html,
        buttons: {
          update: {
            label: "Update",
            callback: html => resolve(html[0].querySelectorAll("input"))
          }
        },
        default: "update",
        close: html => resolve(null)
      }).render(true);
    });
  }

  async _onUpdateBoxClick(event) {
    event.preventDefault();
    const item_id = $(event.currentTarget).data("item");
    const update_type = $(event.currentTarget).data("utype");
    let update = [];
    if(update_type === "activation"){
      let value = !this.actor.items.get(item_id).system.activated
      update.push( {_id: item_id, system:{activated: value}} );
      let effectUpdates = [];
      this.actor.effects.forEach( e => { effectUpdates.push( {"_id": e.id, "disabled":!value} ) } )
      await this.actor.updateEmbeddedDocuments( "ActiveEffect", effectUpdates );
    }
    await this.actor.updateEmbeddedDocuments("Item",update);
  }

}
