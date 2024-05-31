import { rollTrait, rollChroma, rollItem } from "../util/dice.js";

const trait_imgs = {
    //Physical
    "agility": "systems/chromaverse/icons/blackbackground/body-balance.svg",
    "finesse": "systems/chromaverse/icons/blackbackground/fencer.svg",
    "endurance": "systems/chromaverse/icons/blackbackground/health-normal.svg",
    "might": "systems/chromaverse/icons/blackbackground/mighty-force.svg",
    //Mental
    "knowledge": "systems/chromaverse/icons/blackbackground/archive-research.svg",
    "logic": "systems/chromaverse/icons/blackbackground/logic-gate-xor.svg",
    "perception": "systems/chromaverse/icons/blackbackground/semi-closed-eye.svg",
    "volition": "systems/chromaverse/icons/blackbackground/brain.svg",
    //Social
    "deception": "systems/chromaverse/icons/blackbackground/diamonds-smile.svg",
    "persuasion": "systems/chromaverse/icons/blackbackground/convince.svg",
    "empathy": "systems/chromaverse/icons/blackbackground/lovers.svg",
    "presence": "systems/chromaverse/icons/blackbackground/public-speaker.svg"
};

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */
export async function createOLMacro(data, slot) {
    if (data.macro === 'trait') {
        const command = `game.chromaverse.macros.rollTraitMacro("${ data.actor }", "${ data.trait }")`;
        let macro = game.macros.contents.find( m => m.command === command );
        if( !macro ) {
            macro = await Macro.create( {
                name: _capitalize( data.trait ),
                type: "script",
                img: trait_imgs[data.trait],
                command: command
            } );
        }
        game.user.assignHotbarMacro( macro, slot );
    } else if (data.macro === 'chroma') {
            const command = `game.chromaverse.macros.rollChromaMacro("${data.actor}", "${data.chroma}")`;
            let macro = game.macros.contents.find(m => m.command === command);
            if (!macro) {
                macro = await Macro.create({
                    name: _capitalize(data.chroma),
                    type: "script",
                    img: "systems/chromaverse/icons/chroma/"+data.chroma+".webp",
                    command: command
                });
            }
            game.user.assignHotbarMacro(macro, slot);
    } else if (data.macro === 'item') {
        const command = `game.chromaverse.macros.rollItemMacro("${data.actor}", "${data.item}")`;
        let macro = game.macros.contents.find(m => m.command === command);
        if (!macro) {
            const actor = await fromUuid(data.actor);
            const item = actor.items.get(data.item);
            macro = await Macro.create({
                name: data.name,
                type: "script",
                img: item.img,
                command: command
            });
        }
        game.user.assignHotbarMacro(macro, slot);
    }
    return false;
}

/* -------------------------------------------- */
export async function rollTraitMacro(actor_id, trait_name) {
    const actor = await fromUuid(actor_id);
    rollTrait(actor, trait_name);
}

export async function rollChromaMacro(actor_id, chroma_name) {
    const actor = await fromUuid(actor_id);
    rollChroma(actor, chroma_name);
}

export async function rollItemMacro(actor_id, item_id) {
    const actor = await fromUuid(actor_id);
    const item = actor.items.get(item_id);
    rollItem(actor, item);
}

function _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}