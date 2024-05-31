/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class olActor extends Actor {

  /**
   * Augment the basic actor data with additional dynamic data.
   */
  /** @override */
  async _preCreate( createData, options, userId ) {
    await super._preCreate( createData, options, userId );

    if( createData.type === "character" ) {
      createData.prototypeToken = {};
      createData.prototypeToken.actorLink = true;
      console.log( createData );
    }

    await this.updateSource( createData );
  }

  prepareData() {
    super.prepareData();

    const actorData = this;
    const flags = actorData.flags;

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    if (actorData.type === 'character') this._prepareCharacterData(actorData);
    else if (actorData.type === 'npc') this._prepareNPCData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    const data = actorData.system;
    // Calculate level
    data.level = Math.floor((data.trackers.chroma.points - 15) / 3 ) + 1;

    let trackers = data.trackers;
    let traits = data.traits;
    let chroma = data.chroma;
    trackers.traits.spent = 0;
    trackers.traits.points = 40 + ((data.trackers.chroma.points - 15) * 3);

    // Loop through trait scores, and add their dice to our sheet output.
    for (let [trait_group_name, trait_group] of Object.entries(traits)) {
      for (let [trait_name, trait] of Object.entries(trait_group)) {
        trait.modified_score = trait.score + (trait.bonus ? trait.bonus : 0)
        trait.bonus_class = (trait.bonus ? (trait.bonus > 0 ? 'upgraded' : 'downgraded') : '');
        trait.bonus_str = (trait.bonus && trait.bonus !== 0 ? (trait.bonus > 0 ? '+'+trait.bonus : trait.bonus) : '');
        trait.dice = this.getDieForTraitScore(trait.modified_score);
        trackers.traits.spent += (trait.score*trait.score + trait.score)/2;
      }
    }

    // Loop through chroma scores, and add their dice to our sheet output.
    for (let [chroma_group_name, chroma_group] of Object.entries(chroma)) {
      for (let [chroma_name, chroma] of Object.entries(chroma_group)) {
        chroma.modified_score = chroma.score + (chroma.bonus ? chroma.bonus : 0)
        chroma.bonus_class = (chroma.bonus ? (chroma.bonus > 0 ? 'upgraded' : 'downgraded') : '');
        chroma.bonus_str = (chroma.bonus && chroma.bonus !== 0 ? (chroma.bonus > 0 ? '+'+chroma.bonus : chroma.bonus) : '');
        chroma.dice = this.getDieForTraitScore(chroma.modified_score);
        trackers.chroma.spent += this.getCostForChromaScore(chroma.score);
      }
    }

    const endur = data.traits.physical.endurance.modified_score;
    let r_armor= 0;
    let f_armor= 0;
    let w_armor= 0;
    actorData.items.forEach(item => {
      if (item.type === 'armor') {
        if (item.system.equipped && endur >= item.system.req_end) {
          r_armor += item.system.r_defense;
          f_armor += item.system.f_defense;
          w_armor += item.system.w_defense;
        }
      }
    });

    // Set max hp based on: 2 * (Endurance + Volition + Presence) + 10 (handle trait substitution)
    // Cap current lethal between 0 and max
    const resolve = data.defense.resolve;
    resolve.bonus = data.defense.resolve.bonus ? data.defense.resolve.bonus : 0;
    const resolve_form1 = this.getTraitForName(data.traits, resolve.formula[0].active).modified_score;
    const resolve_form2 = this.getTraitForName(data.traits, resolve.formula[1].active).modified_score;
    const resolve_form3 = this.getTraitForName(data.traits, resolve.formula[2].active).modified_score;
    resolve.hint = 2 * (resolve_form1 + resolve_form2 + resolve_form3) + 10 + (resolve.bonus ? resolve.bonus : 0);
    resolve.hint_str = `2 * (${resolve.formula[0].active} + ${resolve.formula[1].active} + ${resolve.formula[2].active}) + 10 + feats = ${resolve.hint}`
    resolve.max = resolve.hint + resolve.other + (resolve.bonus ? resolve.bonus : 0);
    resolve.lethal = Math.min(Math.max(resolve.lethal, 0), resolve.max);
    resolve.value = Math.min(Math.max(resolve.value, resolve.min), resolve.max - resolve.lethal);

    // Set Reflex to 10 + Agility + Perception + Other (handle trait substitution)
    const reflex = data.defense.reflex;
    reflex.bonus = data.defense.reflex.bonus ? data.defense.reflex.bonus : 0;
    const reflex_form1 = this.getTraitForName(data.traits, reflex.formula[0].active).modified_score;
    const reflex_form2 = this.getTraitForName(data.traits, reflex.formula[1].active).modified_score;
    reflex.formula[0].score = reflex_form1;
    reflex.formula[1].score = reflex_form2;
    reflex.armor = Math.max( r_armor,  (reflex.armorBonus ? reflex.armorBonus : 0) );
    reflex.reflex = Math.max(0, 10 + reflex_form1 + reflex_form2 + reflex.armor + reflex.other + (reflex.bonus ? reflex.bonus : 0));
    reflex.hint_str = `10 + ${reflex.formula[0].active} + ${reflex.formula[1].active} + armor + feats + other = ${reflex.reflex}`;

    // Set Fortitude to 10 + Endurance + Might + Other (handle trait substitution)
    const fortitude = data.defense.fortitude;
    fortitude.bonus = data.defense.fortitude.bonus ? data.defense.fortitude.bonus : 0;
    const fortitude_form1 = this.getTraitForName(data.traits, fortitude.formula[0].active).modified_score;
    const fortitude_form2 = this.getTraitForName(data.traits, fortitude.formula[1].active).modified_score;
    fortitude.formula[0].score = fortitude_form1;
    fortitude.formula[1].score = fortitude_form2;
    fortitude.armor = Math.max( f_armor,  (fortitude.armorBonus ? fortitude.armorBonus : 0) );
    fortitude.fortitude = Math.max(0, 10 + fortitude_form1 + fortitude_form2 + fortitude.armor + fortitude.other + (fortitude.bonus ? fortitude.bonus : 0) );
    fortitude.hint_str = `10 + ${fortitude.formula[0].active} + ${fortitude.formula[1].active} + armor + feats + other = ${fortitude.fortitude}`;

    // Set Will to 10 + Presence + Volition + Other (handle trait substitution)
    const will = data.defense.will;
    will.bonus = data.defense.will.bonus ? data.defense.will.bonus : 0;
    const will_form1 = this.getTraitForName(data.traits, will.formula[0].active).modified_score;
    const will_form2 = this.getTraitForName(data.traits, will.formula[1].active).modified_score;
    will.formula[0].score = will_form1;
    will.formula[1].score = will_form2;
    will.armor = Math.max( w_armor,  (will.armorBonus ? will.armorBonus : 0) );
    will.will = Math.max(0, 10 + will_form1 + will_form2 + will.armor + will.other + (will.bonus ? will.bonus : 0) );
    will.hint_str = `10 + ${will.formula[0].active} + ${will.formula[1].active} + armor + feats + other = ${will.will}`;

    // Calculate feat costs
    let total_feat_cost = 0;
    actorData.items.forEach(item => {
      if (item.type === 'feat')
        total_feat_cost += item.system.cost;
    });
    trackers.feats.spent = total_feat_cost;
    trackers.feats.points = data.trackers.chroma.points - 9;

    data.trackers = trackers;
    data.traits = traits;
    //console.log(hp)
    data.defense.resolve = resolve;
    data.defense.reflex = reflex;
    data.defense.fortitude = fortitude;
    data.defense.will = will;
  }

  _prepareNPCData(actorData) {
    const data = actorData.system;
    data.trackers.chroma.points = ((data.level - 1) * 3) + 15;

    let trackers = data.trackers;
    let traits = data.traits;
    trackers.traits.spent = 0;
    trackers.traits.points = 40 + ((data.trackers.chroma.points - 15) * 3);
    // Loop through trait scores, and add their dice to our sheet output.
    for (let [trait_group_name, trait_group] of Object.entries(traits)) {
      for (let [trait_name, trait] of Object.entries(trait_group)) {
        trait.modified_score = trait.score
        trait.bonus_class = '';
        trait.bonus_str = '';
        trait.dice = this.getDieForTraitScore(trait.score);
        trackers.traits.spent += (trait.score*trait.score + trait.score)/2;
      }
    }

    let chromas = data.chroma;
    trackers.chroma.spent = 0;
    // Loop through chroma scores, and add their dice to our sheet output.
    for (let [chroma_group_name, chroma_group] of Object.entries(chromas)) {
      for (let [chroma_name, chroma] of Object.entries(chroma_group)) {
        chroma.modified_score = chroma.score
        chroma.bonus_class = '';
        chroma.bonus_str = '';
        chroma.dice = this.getDieForTraitScore(chroma.score);
        trackers.chroma.spent += this.getCostForChromaScore(chroma.score);
      }
    }

    // Calculate feat costs
    let total_feat_cost = 0;
    actorData.items.forEach(item => {
      if (item.type === 'feat')
        total_feat_cost += item.system.cost;
    });
    trackers.feats.spent = total_feat_cost;
    trackers.feats.points = data.trackers.chroma.points - 9;

    // Update the Actor
    data.trackers = trackers;
    data.traits = traits;
    data.chroma = chromas;
  }

  getDieForTraitScore( score) {
    if( score <= 0 )
      return {"str": "X", "num": 0, "die": 0};
    else if( score <= 1)
      return {"str": "1d4", "num": 1, "die": "d4"};
    else if( score <= 2)
      return {"str": "1d6", "num": 1, "die": "d6"};
    else if( score <= 3)
      return {"str": "1d8", "num": 1, "die": "d8"};
    else if( score <= 4)
      return {"str": "1d10", "num": 1, "die": "d10"};
    else if( score <= 5)
      return {"str": "2d6", "num": 2, "die": "d6"};
    else if( score <= 6)
      return {"str": "2d8", "num": 2, "die": "d8"};
    else if( score <= 7)
      return {"str": "2d10", "num": 2, "die": "d10"};
    else if( score <= 8)
      return {"str": "3d8", "num": 3, "die": "d8"};
    else if( score <= 9)
      return {"str": "3d10", "num": 3, "die": "d10"};
    else
      return {"str": "4d8", "num": 4, "die": "d8"};
  }

  getCostForChromaScore(score) {
    if( score <= 0 )
      return 0;
    else if( score <= 1)
      return 1;
    else if( score <= 2)
      return 3;
    else if( score <= 3)
      return 6;
    else if( score <= 4)
      return 9;
    else if( score <= 5)
      return 15;
    else if( score <= 6)
      return 18;
    else if( score <= 7)
      return 24;
    else if( score <= 8)
      return 27;
    else if( score <= 9)
      return 36;
    else
      return 36;
  }

  getTraitForName( traits, name) {
    let trait = traits.physical[name]
    if( trait ) return trait;

    trait = traits.mental[name]
    if( trait ) return trait;

    trait = traits.social[name]
    if( trait ) return trait;

    trait = traits.extraordinary[name]
    if( trait ) return trait;

    return null;
  }

}