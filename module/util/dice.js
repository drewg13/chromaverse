
export async function rollTrait( actor, trait_name, skip_dialog=false) {
    // Get the trait from its name
    const trait = _getTrait(actor, trait_name);
    if (trait) {
        // Generate an OLRoll for the trait
        let olroll = await OLRoll(trait_name, trait, 0, 0, 0, skip_dialog);
        if (olroll.roll) {
            // Generate a chat message template using OLRoll data
            const template = "systems/chromaverse/templates/dialog/roll-chat.html";
            const data = {
                "name": trait_name,
                "type": 'Attribute',
                "trait": olroll.trait,
                "adv": olroll.adv
            }
            const html = await renderTemplate(template, data);
            // Roll the roll
            olroll.roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                flavor: html
            });
        }
    }
}

export async function rollChroma(actor, chroma_name, skip_dialog=false) {
    // Get the chroma from its name
    const chroma = _getChroma(actor, chroma_name);
    if (chroma) {
        // Generate an OLRoll for the chroma
        let olroll = await OLRoll(chroma_name, chroma, 0, 0, 0, skip_dialog);
        if (olroll.roll) {
            // Generate a chat message template using OLRoll data
            const template = "systems/chromaverse/templates/dialog/roll-chat.html";
            const data = {
                "name": chroma_name,
                "type": 'Chroma',
                "trait": olroll.trait,
                "adv": olroll.adv
            }
            const html = await renderTemplate(template, data);
            // Roll the roll
            olroll.roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                flavor: html
            });
        }
    }
}

export async function rollItem(actor, item, skip_dialog=false) {
    // If the item has a chosen action trait...
    const trait_name = item.system.action.trait;
    let traits = [];
    Object.keys( actor.system.traits ).forEach( t => { Object.keys( actor.system.traits[t] ).forEach( a => { traits.push( a ) } ) } );
    let chroma = Object.keys( actor.system.chroma.chroma );
    let trait;
    if( traits.includes( trait_name ) ){
        trait = _getTrait(actor, trait_name);
    } else if ( chroma.includes( trait_name ) ){
        trait = _getChroma(actor, trait_name);
    } else {
        console.warn(trait_name + " not present in actor system data")
    }
    if (trait) {
        // Generate an OLRoll for the trait
        let advantage = Number(item.system.action.default_adv);
        let advBonus = 0;
        if( actor.system.advantageBonus && ( item.type === "attack" || item.type === "weapon" ) ){
            advantage += actor.system.advantageBonus;
            advBonus = actor.system.advantageBonus;
        }
        let olroll = await OLRoll(trait_name, trait, advantage, advBonus, item.system.action.explosion_mod, skip_dialog);
        if (olroll.roll) {
            // Generate a chat message template using OLRoll data
            const template = "systems/chromaverse/templates/dialog/roll-chat.html";
            const data = {
                "name": item.system.action.name,
                "type": item.type,
                "notes": item.system.details.notes,
                "trait": olroll.trait,
                "target": item.system.action.target,
                "adv": olroll.adv
            }
            const html = await renderTemplate(template, data);
            // Roll the roll
            olroll.roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: actor }),
                flavor: html
            });
        }
    }
}


export async function OLRoll(trait_name, trait, default_adv=0, advBonus=0, explosion_modifier=0, skip_window=false) {
    const to_return = {
        "roll": null,
        "trait": {
            "name": trait_name,
            "score": trait.modified_score,
            "dice": trait.dice
        },
        "adv": {
            "type": "",
            "value": 0
        }
    }

    // Create the Dialog window
    let adv = default_adv
    if (!skip_window)
        adv = await _OLRollDialog(trait_name, trait, default_adv, advBonus);
    if (adv == null)
        return to_return;

    const dice = trait.dice;
    const d20_explos = explosion_modifier > 0 ? `X>=${Math.max(2, 20-explosion_modifier)}` : 'X'
    // If score is zero
    if (trait.modified_score <= 0) {
        to_return.trait.dice = null;
        if (adv > 0) {
            to_return.adv.type = "Advantage";
            to_return.adv.value = 1;
            to_return.roll = new Roll(`2d20kh1${d20_explos}`);
        } else if (adv < 0) {
            to_return.adv.type = "Disadvantage";
            to_return.adv.value = 1;
            to_return.roll = new Roll(`2d20kl1${d20_explos}`);
        } else {
            to_return.adv = null;
            to_return.roll = new Roll(`1d20${d20_explos}`);
        }
    } else {
        const die_num = parseInt(dice.die.substring(1));
        const trait_explos = explosion_modifier > 0 ? `X>=${Math.max(2, die_num-explosion_modifier)}` : 'X';
        // Normal roll
        if (adv === 0) {
            to_return.adv = null;
            to_return.roll = new Roll(`1d20${d20_explos} + ${dice.num + dice.die}${trait_explos}`);
        } else {
            to_return.adv.value = Math.abs(adv);
            let advstr = ""
            if (adv < 0) {
                to_return.adv.type = "Disadvantage";
                advstr = 'kl' + dice.num;
            } else {
                to_return.adv.type = "Advantage";
                advstr = 'kh' + dice.num;
            }
            to_return.roll = new Roll(`1d20${d20_explos} + ${(to_return.adv.value + dice.num) + dice.die + advstr}${trait_explos}`);
        }
    }

    if (game.settings.get("chromaverse", "alt_d20_explosion"))
        to_return.roll = _modifyD20Explosion(to_return.roll, dice)

    return to_return;
}

function _modifyD20Explosion(roll, dice) {
    // Check if there is a D20 in the roll
    if (roll.terms.length > 0 && roll.terms[0].faces === 20) {
        // Evaluate the roll
        roll.evaluate()

        // Check if a nat 20 was rolled
        let nat20 = false;
        let nat20_index = -1;
        let d20results = roll.terms[0].results;
        for(let i=0; i<d20results.length; i++) {
            let result = d20results[i]
            if (nat20) {
                result['ignore'] = true;
                continue
            }

            if (result['exploded'] && result['active']) {
                nat20 = true;
                nat20_index = i;
            }
        }

        // Do not modify if didn't roll a 20
        if (!nat20)
            return roll;

        console.log('MODIFYING D20');
        console.log(roll);

        // Clone the roll and iterate through all terms/results
        let new_roll = roll.clone();
        for(let t=0; t<roll.terms.length; t++) {
            let term = roll.terms[t];
            let new_term = new_roll.terms[t]
            // Skip if not a resultable die
            if(term.results === undefined)
                continue;
            for(let r=0; r<term.results.length; r++) {
                // Set all terms equal to what was rolled before
                let result = term.results[r];
                if (!result['ignore'])
                    new_term.results.push(result);
            }
            new_term._evaluated = true;
        }

        // Modify d20 roll
        // new_roll.terms[0].results[nat20_index]['result'] = 20;
        // new_roll.terms[0].modifiers = [];

        // Add bonus die
        let bonus_die = _upgradeDie(dice);
        new_roll.terms.splice(1, 0, new OperatorTerm({'operator':'+'}));
        new_roll.terms.splice(2, 0, new Die({'faces':bonus_die.faces, 'number':bonus_die.num, 'modifiers':['X']}));

        return new_roll;
    }
    return roll;
}

async function _OLRollDialog(trait_name, trait, default_adv=0, advBonus=0) {
    const template = "systems/chromaverse/templates/dialog/roll-dialog.html";
    const data = { 'trait': trait_name, 'score': trait.modified_score, 'formula': '1d20', 'default_adv': default_adv, 'advBonus': advBonus }
    if (trait.modified_score > 0)
        data.formula += ' + ' + trait.dice.num + trait.dice.die;

    const html = await renderTemplate(template, data);

    // Create the Dialog window
    return new Promise(resolve => {
        new Dialog({
            title: "Configure Roll",
            content: html,
            buttons: {
                dis: {
                    label: "Dis+1",
                    callback: html => resolve(parseInt(html[0].querySelector("input[name='advlevel']").value) - 1)
                },
                roll: {
                    label: "Roll",
                    callback: html => resolve(parseInt(html[0].querySelector("input[name='advlevel']").value))
                },
                adv: {
                    label: "Adv+1",
                    callback: html => resolve(parseInt(html[0].querySelector("input[name='advlevel']").value) + 1)
                }
            },
            default: "roll",
            close: html => resolve(null)
        }).render(true);
    });
}

export function _getTrait( actor, trait_name) {
    // Find the trait data object using its name
    for (const [_, trait_group] of Object.entries(actor.system.traits)) {
        if (trait_group[trait_name])
            return trait_group[trait_name]
    }
    return null;
}

export function _getChroma(actor, chroma_name) {
    // Find the chroma data object using its name
    for (const [_, chroma_group] of Object.entries(actor.system.chroma)) {
        if (chroma_group[chroma_name])
            return chroma_group[chroma_name]
    }
    return null;
}

function _upgradeDie(die) {
    let d = Object();
    d.num = 1;
    if (die.num === 0)
        d.faces = 4;
    else if (die.num === 1)
        d.faces = Math.max(4, parseInt(die.die.substring(1)));
    else
        d.faces = 10;
    return d;
}
