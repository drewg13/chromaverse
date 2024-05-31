/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class olItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["chromaverse", "sheet", "item"],
      width: 575,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    const path = "systems/chromaverse/templates/item";
    return `${path}/${this.item.type}.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const itemData = super.getData();
    const sheetData = itemData.data;
    sheetData.owner = itemData.owner;
    sheetData.editable = itemData.editable;

    sheetData.system.details.description = await TextEditor.enrichHTML(sheetData.system.details.description, {secrets: itemData.isOwner});

    return sheetData;
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options = {}) {
    const position = super.setPosition(options);
    const sheetBody = this.element.find(".sheet-body");
    const bodyHeight = position.height - 192;
    sheetBody.css("height", bodyHeight);
    return position;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".add-attack").click(async () => {
      const template = "systems/chromaverse/templates/item/parts/attack-target.html";
      const data = { 'attack': {}, 'traits': this.object.system.traits };
      const new_attack = await renderTemplate(template, data);
      html.find(".attack-list").append(new_attack);
    });

    html.find(".attack-delete").click(ev => $(ev.currentTarget).closest('li').remove());
    html.find(".update-action").click(ev => {
      const btn = $(ev.currentTarget);
      if (btn.html() === "Edit")
        btn.html("Save");
      else {
        let data = {}
        html.find(".trait-checkbox").each((i, obj) => {
          data['system.traits.' + obj.dataset.trait] = obj.checked;
        });

        if (this.object.system.attacks) {
          const attacks = []
          html.find(".action-attack").each((i, attack) => {
            const trait = $(attack).find('.attack-trait').val();
            const target = $(attack).find('.attack-target').val();
            attacks.push({ "trait": trait, "target": target });
          });
          data['system.attacks'] = attacks;
        }
        this.object.update(data);
        btn.html("Edit");
      }

      html.find(".action-list").toggle();
      html.find(".action-edit").toggle();
    });

    html.find('.scale').keyup(ev => {
      const input = $(ev.currentTarget);
      const tester = html.find('.scale-tester');
      tester.text(input.val());
      input.width(tester.width() + 5);
    });

    html.find('.scale').each((i, tag) => {
      const tester = html.find('.scale-tester');
      tester.text($(tag).val());
      $(tag).width(tester.width() + 5);
    });

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Roll handlers, click handlers, etc. would go here.
  }

  resizeInput() {
    console.log($(this));
    $(this).trait('size', $(this).val().length);
  }
}
