(function(global) {
  var CX = 210, CY = 210, R = 175;
  var LAND = 90;
  var RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary'];
  var RARITY_RANK = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  var RARITY_SCALE = {
    common:    [0.9, 0.76, 0.64, 0.53, 0.36],
    uncommon:  [0.05, 0.26, 0.62, 1.2, 1.75],
    rare:      [0.001, 0.065, 0.38, 1.12, 2.35],
    legendary: [0.0002, 0.014, 0.15, 0.64, 1.78],
  };
  var FLAT_BONUS_STACK_TO_COUNT = 100;
  var FLAT_BONUS_STACK_TO_SIZE = 2;
  var MIN_STACKABLE_COUNT = 1;
  var MIN_DEAD_ZONE_SIZE = 0.1;
  var MIN_ANCHOR_SCALE = 0.08;
  var MIN_LOSE_TILE_MULT = 0.08;
  var WHEEL_GROWTH_MULTIPLIER = 3;
  var EARLY_GROWTH_LEVEL_LIMIT = 3;
  var MID_GROWTH_LEVEL_LIMIT = 5;
  var MID_GROWTH_DECAY_START_LEVEL = MID_GROWTH_LEVEL_LIMIT - 1;
  var EARLY_GROWTH_WIN_RATIO = 2 / 3;
  var MID_GROWTH_WIN_RATIO = 5 / 9;
  var MIN_GROWTH_WIN_RATIO = 1 / 3;
  var GROWTH_WIN_RATIO_STEP = 1 / 18;

  function rarityMult(rarity, gl) {
    var arr = RARITY_SCALE[rarity] || [1];
    return arr[Math.min(gl, arr.length - 1)];
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function randFloat(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(randFloat(min, max + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pct(v) { return Math.round(v * 100); }
  function makeIid(id) { return id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }

  function rarityRange(rarity, map) {
    return map[rarity] || map.rare;
  }

  var TEMPLATE_MAP = {};
  function boonTemplate(def) {
    TEMPLATE_MAP[def.id] = def;
    return def;
  }

  function numericBoon(idRoot, name, effect, wMap, rangesByKey, descFn, extra) {
    var out = [];
    ['uncommon', 'rare', 'legendary'].forEach(function(rarity) {
      var valueRanges = {};
      Object.keys(rangesByKey).forEach(function(k) {
        valueRanges[k] = Object.assign({}, rarityRange(rarity, rangesByKey[k]));
      });
      out.push(boonTemplate({
        id: idRoot + '_' + rarity,
        group: idRoot,
        name: name,
        rarity: rarity,
        w: wMap[rarity],
        randomValue: true,
        valueRanges: valueRanges,
        roll: function() {
          var rolled = {};
          Object.keys(rangesByKey).forEach(function(k) {
            var rg = rarityRange(rarity, rangesByKey[k]);
            var v = randFloat(rg.min, rg.max);
            if (rg.step) {
              var steps = Math.floor((rg.max - rg.min) / rg.step);
              v = rg.min + randInt(0, Math.max(0, steps)) * rg.step;
            }
            if (rg.int) v = randInt(rg.min, rg.max);
            rolled[k] = v;
          });
          rolled.effect = effect;
          rolled.desc = descFn(rarity, rolled);
          if (extra) {
            Object.keys(extra).forEach(function(k) {
              rolled[k] = extra[k];
            });
          }
          return rolled;
        }
      }));
    });
    return out;
  }

  var BOONS = [];
  function addMany(arr) { arr.forEach(function(x) { BOONS.push(x); }); }

  addMany(numericBoon(
    'rescue_independent',
    'Fractured Luck',
    'rescue_independent',
    { uncommon: 7, rare: 5, legendary: 2 },
    { chance: {
      uncommon: { min: 0.05, max: 0.10, step: 0.01 },
      rare: { min: 0.20, max: 0.30, step: 0.01 },
      legendary: { min: 0.40, max: 0.50, step: 0.01 },
    }},
    function(_, v) { return 'On a loss: ' + pct(v.chance) + '% chance to win instead. Copies trigger separately.'; }
  ));

  BOONS.push(boonTemplate({
    id: 'add_win_common',
    group: 'add_win',
    name: 'Flip a Lose to Win',
    rarity: 'common',
    w: 30,
    effect: 'add_win',
    amount: 1,
    desc: 'Immediately flip one lose tile to win.'
  }));

  addMany(numericBoon(
    'rescue_additive',
    'Stacked Salvation',
    'rescue_additive',
    { uncommon: 7, rare: 5, legendary: 2 },
    {
      chance: {
        uncommon: { min: 0.05, max: 0.10, step: 0.01 },
        rare: { min: 0.20, max: 0.30, step: 0.01 },
        legendary: { min: 0.40, max: 0.50, step: 0.01 },
      },
      cap: {
        uncommon: { min: 0.55, max: 0.70, step: 0.01 },
        rare: { min: 0.75, max: 0.85, step: 0.01 },
        legendary: { min: 0.90, max: 0.98, step: 0.01 },
      }
    },
    function(_, v) { return 'On a loss: +' + pct(v.chance) + '% stacked rescue chance (additive), capped at ' + pct(v.cap) + '%.'; }
  ));

  addMany(numericBoon(
    'rescue_multiplicative',
    'Layered Fortune',
    'rescue_multiplicative',
    { uncommon: 7, rare: 5, legendary: 2 },
    { chance: {
      uncommon: { min: 0.05, max: 0.10, step: 0.01 },
      rare: { min: 0.20, max: 0.30, step: 0.01 },
      legendary: { min: 0.40, max: 0.50, step: 0.01 },
    }},
    function(_, v) { return 'On a loss: this copy contributes ' + pct(v.chance) + '% multiplicative rescue chance.'; }
  ));

  addMany(numericBoon(
    'tide_shift',
    'Fortunes Tilt',
    'tide_shift',
    { uncommon: 6, rare: 4, legendary: 2 },
    {
      winGrow: {
        uncommon: { min: 0.10, max: 0.20, step: 0.01 },
        rare: { min: 0.25, max: 0.40, step: 0.01 },
        legendary: { min: 0.50, max: 0.75, step: 0.01 },
      },
      loseShrink: {
        uncommon: { min: 0.05, max: 0.12, step: 0.01 },
        rare: { min: 0.15, max: 0.25, step: 0.01 },
        legendary: { min: 0.30, max: 0.45, step: 0.01 },
      }
    },
    function(_, v) { return 'Win tiles +' + pct(v.winGrow) + '% size and lose tiles -' + pct(v.loseShrink) + '% size.'; }
  ));

  ['common', 'uncommon', 'rare', 'legendary'].forEach(function(targetRarity) {
    BOONS.push(boonTemplate({
      id: 'rarity_boost_' + targetRarity,
      group: 'rarity_boost_' + targetRarity,
      name: targetRarity.charAt(0).toUpperCase() + targetRarity.slice(1) + ' Beacon',
      rarity: targetRarity === 'common' ? 'uncommon' : targetRarity,
      w: targetRarity === 'common' ? 4 : (targetRarity === 'uncommon' ? 5 : (targetRarity === 'rare' ? 4 : 2)),
      effect: 'rarity_boost',
      targetRarity: targetRarity,
      bonus: targetRarity === 'legendary' ? 0.45 : 0.30,
      desc: 'Shop rolls are more likely to include ' + targetRarity + ' boons.'
    }));
  });

  addMany(numericBoon(
    'rescue_fragile',
    'Shattering Mercy',
    'rescue_fragile',
    { uncommon: 6, rare: 4, legendary: 2 },
    {
      chance: {
        uncommon: { min: 0.05, max: 0.10, step: 0.01 },
        rare: { min: 0.20, max: 0.30, step: 0.01 },
        legendary: { min: 0.40, max: 0.50, step: 0.01 },
      },
      breakChance: {
        uncommon: { min: 0.60, max: 0.85, step: 0.01 },
        rare: { min: 0.35, max: 0.60, step: 0.01 },
        legendary: { min: 0.10, max: 0.35, step: 0.01 },
      }
    },
    function(_, v) { return 'On a loss: ' + pct(v.chance) + '% chance to win, then ' + pct(v.breakChance) + '% chance this boon is consumed.'; },
    { oneTimeTrigger: true }
  ));

  addMany(numericBoon(
    'shop_reroll_consumable',
    'Pocket Reroll',
    'shop_reroll_consumable',
    { uncommon: 6, rare: 4, legendary: 2 },
    { charges: {
      uncommon: { min: 1, max: 1, int: true },
      rare: { min: 2, max: 2, int: true },
      legendary: { min: 3, max: 3, int: true },
    }},
    function(_, v) { return 'Shop: gain ' + v.charges + ' consumable reroll charge' + (v.charges > 1 ? 's.' : '.'); },
    { oneTimeTrigger: true }
  ));

  BOONS.push(boonTemplate({
    id: 'shop_reroll_growth',
    group: 'shop_reroll_growth',
    name: 'Growth Mulligan',
    rarity: 'rare',
    w: 3,
    effect: 'shop_reroll_growth',
    lastGrowthUsed: -1,
    desc: 'Shop: one permanent reroll each wheel growth level.'
  }));

  addMany(numericBoon(
    'temp_win',
    'Flash Fortune',
    'temp_win',
    { uncommon: 6, rare: 4, legendary: 2 },
    { amount: {
      uncommon: { min: 1, max: 1, int: true },
      rare: { min: 2, max: 2, int: true },
      legendary: { min: 3, max: 3, int: true },
    }},
    function(_, v) { return 'Each spin: +' + v.amount + ' temporary win tile(s), no wheel growth contribution.'; }
  ));

  BOONS.push(boonTemplate({
    id: 'duplicate_right',
    group: 'duplicate_right',
    name: 'Right-Hand Echo',
    rarity: 'rare',
    w: 3,
    effect: 'duplicate_right',
    desc: 'Immediately duplicate the boon to this boon\'s right in stack order (wraps to first).'
  }));

  BOONS.push(boonTemplate({
    id: 'shield',
    group: 'shield',
    name: 'Last Stand',
    rarity: 'uncommon',
    w: 5,
    effect: 'shield',
    charges: 1,
    oneTimeTrigger: true,
    desc: 'Next time you would lose, win instead. One-time use.'
  }));

  ['uncommon', 'rare', 'legendary'].forEach(function(r) {
    BOONS.push(boonTemplate({
      id: 'next_shop_guarantee_rarity_' + r,
      group: 'next_shop_guarantee_rarity',
      name: 'Fated Market (' + r + ')',
      rarity: r,
      w: r === 'uncommon' ? 5 : (r === 'rare' ? 3 : 1),
      effect: 'next_shop_guarantee_rarity',
      targetRarity: r,
      uses: 1,
      oneTimeTrigger: true,
      desc: 'Next shop guarantees at least one ' + r + ' boon.'
    }));
  });

  addMany(numericBoon(
    'win_merge',
    'Merging Triumph',
    'win_merge',
    { uncommon: 5, rare: 4, legendary: 2 },
    { mergeGrow: {
      uncommon: { min: 0.03, max: 0.06, step: 0.01 },
      rare: { min: 0.07, max: 0.12, step: 0.01 },
      legendary: { min: 0.15, max: 0.22, step: 0.01 },
    }},
    function(_, v) { return 'Adjacent win tiles grow by +' + pct(v.mergeGrow) + '% each spin.'; }
  ));

  addMany(numericBoon(
    'anchor_lose',
    'Anchored Misfortune',
    'anchor_lose',
    { uncommon: 5, rare: 4, legendary: 2 },
    { shrinkPerSpin: {
      uncommon: { min: 0.04, max: 0.08, step: 0.01 },
      rare: { min: 0.10, max: 0.15, step: 0.01 },
      legendary: { min: 0.20, max: 0.28, step: 0.01 },
    }},
    function(_, v) { return 'Anchors one lose tile (cannot flip to win) and shrinks it by ' + pct(v.shrinkPerSpin) + '% each spin.'; }
  ));

  addMany(numericBoon(
    'growth_bonus_win',
    'Overgrowth',
    'growth_bonus_win',
    { uncommon: 5, rare: 4, legendary: 2 },
    { amount: {
      uncommon: { min: 1, max: 1, int: true },
      rare: { min: 1, max: 2, int: true },
      legendary: { min: 2, max: 3, int: true },
    }},
    function(_, v) { return 'After each wheel growth, add ' + v.amount + ' extra win tile(s).'; }
  ));

  addMany(numericBoon(
    'dead_zone',
    'Null Wedge',
    'dead_zone',
    { uncommon: 4, rare: 3, legendary: 2 },
    { size: {
      uncommon: { min: 0.45, max: 0.60, step: 0.01 },
      rare: { min: 0.65, max: 0.85, step: 0.01 },
      legendary: { min: 0.95, max: 1.20, step: 0.01 },
    }},
    function(_, v) { return 'Adds a dead-zone tile (size ' + v.size.toFixed(2) + ') that automatically re-spins.'; }
  ));

  BOONS.push(boonTemplate({
    id: 'sacrifice_instead',
    group: 'sacrifice_instead',
    name: 'Blood Bargain',
    rarity: 'rare',
    w: 3,
    effect: 'sacrifice_instead',
    desc: 'If you would lose, sacrifice one held boon instead.'
  }));

  BOONS.push(boonTemplate({
    id: 'upgrade_random',
    group: 'upgrade_random',
    name: 'Ascension Spark',
    rarity: 'rare',
    w: 3,
    effect: 'upgrade_random',
    desc: 'Upgrade a random boon you already own to a higher rarity.'
  }));

  BOONS.push(boonTemplate({
    id: 'convert_same_rarity',
    group: 'convert_same_rarity',
    name: 'Alchemical Swap',
    rarity: 'rare',
    w: 3,
    effect: 'convert_same_rarity',
    desc: 'Convert a random held boon into a random boon of the same rarity.'
  }));

  addMany(numericBoon(
    'free_copy_on_pick',
    'Double Take',
    'free_copy_on_pick',
    { uncommon: 5, rare: 4, legendary: 2 },
    { chance: {
      uncommon: { min: 0.05, max: 0.10, step: 0.01 },
      rare: { min: 0.20, max: 0.30, step: 0.01 },
      legendary: { min: 0.40, max: 0.50, step: 0.01 },
    }},
    function(_, v) { return 'When picking a boon: ' + pct(v.chance) + '% chance to gain a free copy of that boon.'; }
  ));

  addMany(numericBoon(
    'preserve_one_time',
    'Spent? Not Yet',
    'preserve_one_time',
    { uncommon: 5, rare: 4, legendary: 2 },
    { chance: {
      uncommon: { min: 0.05, max: 0.10, step: 0.01 },
      rare: { min: 0.20, max: 0.30, step: 0.01 },
      legendary: { min: 0.40, max: 0.50, step: 0.01 },
    }},
    function(_, v) { return 'One-time-use boons have ' + pct(v.chance) + '% chance to not be consumed.'; }
  ));

  BOONS.push(boonTemplate({
    id: 'guarantee_owned_type',
    group: 'guarantee_owned_type',
    name: 'Targeted Procurement',
    rarity: 'legendary',
    w: 1,
    effect: 'guarantee_owned_type',
    uses: 1,
    oneTimeTrigger: true,
    desc: 'Next shop guarantees one boon type you already own.'
  }));

  addMany(numericBoon(
    'value_aura',
    'Compounding Numerics',
    'value_aura',
    { uncommon: 4, rare: 3, legendary: 2 },
    { bonus: {
      uncommon: { min: 0.01, max: 0.02, step: 0.01 },
      rare: { min: 0.03, max: 0.05, step: 0.01 },
      legendary: { min: 0.06, max: 0.08, step: 0.01 },
    }},
    function(_, v) { return 'When you pick a random-value boon, all your other random-value boons gain +' + pct(v.bonus) + '% flat value.'; }
  ));

  var TOTAL_W = BOONS.reduce(function(s, b) { return s + b.w; }, 0);
  var RC = { common:'#909090', uncommon:'#4a9eff', rare:'#c060ff', legendary:'#D4AF37' };
  var INIT_TILES = [
    { id:0, type:'win'  }, { id:1, type:'lose' },
    { id:2, type:'win'  }, { id:3, type:'win'  },
    { id:4, type:'lose' }, { id:5, type:'win'  },
  ];

  function cloneBoon(b) { return Object.assign({}, b, { iid: makeIid(b.id) }); }
  function instantiateTemplate(tpl) {
    var base = Object.assign({}, tpl);
    delete base.roll;
    if (tpl.roll) {
      var rolled = tpl.roll();
      Object.keys(rolled).forEach(function(k) { base[k] = rolled[k]; });
    }
    if (base.randomValue && base.flatBonus === undefined) base.flatBonus = 0;
    base.iid = makeIid(base.id);
    return base;
  }

  function boonNumeric(boon, key) {
    var val = boon[key] === undefined ? 0 : boon[key];
    if (!boon.randomValue) return val;
    var fb = boon.flatBonus || 0;
    if (typeof val !== 'number') return val;
    if (key === 'charges' || key === 'amount') return Math.max(MIN_STACKABLE_COUNT, Math.round(val + fb * FLAT_BONUS_STACK_TO_COUNT));
    if (key === 'size') return Math.max(MIN_DEAD_ZONE_SIZE, val + fb * FLAT_BONUS_STACK_TO_SIZE);
    return clamp(val + fb, 0, 0.99);
  }

  function consumeProtected(nb, idx) {
    var save = 0;
    for (var i = 0; i < nb.length; i++) if (nb[i].effect === 'preserve_one_time') save += boonNumeric(nb[i], 'chance');
    if (Math.random() < clamp(save, 0, 0.95)) return nb;
    if (nb[idx].effect === 'shield') {
      var nextCharges = (nb[idx].charges || 1) - 1;
      if (nextCharges > 0) nb[idx] = Object.assign({}, nb[idx], { charges: nextCharges });
      else nb.splice(idx, 1);
      return nb;
    }
    nb.splice(idx, 1);
    return nb;
  }

  function getTemplatesBy(filter) {
    return BOONS.filter(filter);
  }

  function pickTemplateByRarity(rarity, group) {
    var pool = BOONS.filter(function(t) {
      if (t.rarity !== rarity) return false;
      if (group && t.group !== group) return false;
      return true;
    });
    if (!pool.length) return null;
    var tw = pool.reduce(function(s, b) { return s + b.w; }, 0);
    var r = Math.random() * tw;
    for (var i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function computeRarityWeights(gl, boons) {
    var rarityW = {};
    RARITY_ORDER.forEach(function(r) {
      var base = BOONS.filter(function(b) { return b.rarity === r; }).reduce(function(s, b) { return s + b.w; }, 0);
      var bonus = 0;
      boons.forEach(function(b) {
        if (b.effect === 'rarity_boost' && b.targetRarity === r) bonus += (b.bonus || 0);
      });
      rarityW[r] = base * rarityMult(r, gl) * Math.max(0, 1 + bonus);
    });
    return rarityW;
  }

  function pickRarity(weightMap) {
    var total = RARITY_ORDER.reduce(function(s, r) { return s + (weightMap[r] || 0); }, 0);
    if (total <= 0) return 'common';
    var rr = Math.random() * total;
    for (var i = 0; i < RARITY_ORDER.length; i++) {
      var r = RARITY_ORDER[i];
      rr -= weightMap[r] || 0;
      if (rr <= 0) return r;
    }
    return 'legendary';
  }

  function pickUncommonOrBetter(weightMap) {
    var pool = ['uncommon', 'rare', 'legendary'];
    var total = pool.reduce(function(s, r) { return s + (weightMap[r] || 0); }, 0);
    if (total <= 0) return 'uncommon';
    var rr = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      var r = pool[i];
      rr -= weightMap[r] || 0;
      if (rr <= 0) return r;
    }
    return 'legendary';
  }

  function consumeNextShopFlags(boons) {
    var nb = boons.map(function(b) { return Object.assign({}, b); });
    var forcedRarity = null;
    var forcedGroup = null;

    for (var i = 0; i < nb.length; i++) {
      var b = nb[i];
      if (b.effect === 'next_shop_guarantee_rarity' && (b.uses || 0) > 0 && !forcedRarity) {
        forcedRarity = b.targetRarity;
        var left = (b.uses || 0) - 1;
        if (left > 0) nb[i] = Object.assign({}, b, { uses: left });
        else nb.splice(i--, 1);
      } else if (b.effect === 'guarantee_owned_type' && (b.uses || 0) > 0 && !forcedGroup) {
        var owned = nb.filter(function(x) {
          return x.group && x.group !== 'guarantee_owned_type' && x.group !== 'next_shop_guarantee_rarity';
        });
        if (owned.length > 0) forcedGroup = pick(owned).group;
        var left2 = (b.uses || 0) - 1;
        if (left2 > 0) nb[i] = Object.assign({}, b, { uses: left2 });
        else nb.splice(i--, 1);
      }
    }

    return { boons: nb, forcedRarity: forcedRarity, forcedGroup: forcedGroup };
  }

  function drawBoons(count, gl, boons, options) {
    var owned = boons || [];
    var opts = options || {};
    var consumed = consumeNextShopFlags(owned);
    var nb = consumed.boons;
    var forcedRarity = consumed.forcedRarity;
    var forcedGroup = consumed.forcedGroup;
    var firstShopGuarantee = opts.firstShop === true;

    var rarityW = computeRarityWeights(gl, nb);
    var out = [];
    for (var n = 0; n < count; n++) {
      var tpl = null;
      if (n === 0 && forcedGroup) {
        var rg = forcedRarity || pickRarity(rarityW);
        tpl = pickTemplateByRarity(rg, forcedGroup) || pickTemplateByRarity(rg, null);
      }
      if (n === 0 && !tpl && forcedRarity) {
        tpl = pickTemplateByRarity(forcedRarity, null);
      }
      if (n === 0 && !tpl && firstShopGuarantee) {
        tpl = pickTemplateByRarity(pickUncommonOrBetter(rarityW), null);
      }
      if (!tpl) {
        var pr = pickRarity(rarityW);
        tpl = pickTemplateByRarity(pr, null);
      }
      if (!tpl) continue;
      out.push(instantiateTemplate(tpl));
    }

    return { choices: out, boons: nb };
  }

  function getShopRerolls(boons, gl) {
    var total = 0;
    for (var i = 0; i < boons.length; i++) {
      var b = boons[i];
      if (b.effect === 'shop_reroll_consumable' && (b.charges || 0) > 0) total += b.charges;
      if (b.effect === 'shop_reroll_growth' && (b.lastGrowthUsed || -1) < gl) total += 1;
    }
    return total;
  }

  function consumeShopReroll(boons, gl) {
    var nb = boons.map(function(b) { return Object.assign({}, b); });
    for (var i = 0; i < nb.length; i++) {
      if (nb[i].effect === 'shop_reroll_consumable' && (nb[i].charges || 0) > 0) {
        var charges = nb[i].charges - 1;
        if (charges > 0) nb[i] = Object.assign({}, nb[i], { charges: charges });
        else nb = consumeProtected(nb, i);
        return { ok: true, boons: nb };
      }
    }
    for (var j = 0; j < nb.length; j++) {
      if (nb[j].effect === 'shop_reroll_growth' && (nb[j].lastGrowthUsed || -1) < gl) {
        nb[j] = Object.assign({}, nb[j], { lastGrowthUsed: gl });
        return { ok: true, boons: nb };
      }
    }
    return { ok: false, boons: nb };
  }

  function rerollShop(count, gl, boons) {
    var used = consumeShopReroll(boons, gl);
    if (!used.ok) return { ok: false, choices: [], boons: boons };
    var drawn = drawBoons(count, gl, used.boons);
    return { ok: true, choices: drawn.choices, boons: drawn.boons };
  }

  function polar(deg, r) {
    var rr = r === undefined ? R : r;
    var rad = (deg - 90) * Math.PI / 180;
    return { x: CX + rr * Math.cos(rad), y: CY + rr * Math.sin(rad) };
  }
  function slicePath(a1, a2) {
    if (a2 - a1 >= 359.99) {
      var p = polar(a1);
      return 'M ' + CX + ',' + CY + ' L ' + p.x + ',' + p.y + ' A ' + R + ',' + R + ' 0 1 1 ' + (p.x - 0.01) + ',' + p.y + ' Z';
    }
    var s = polar(a1), e = polar(a2);
    var lg = a2 - a1 > 180 ? 1 : 0;
    return 'M ' + CX + ',' + CY + ' L ' + s.x + ',' + s.y + ' A ' + R + ',' + R + ' 0 ' + lg + ' 1 ' + e.x + ',' + e.y + ' Z';
  }
  function revealWedge(halfSpan) {
    var hs = Math.max(12, Math.min(65, halfSpan));
    var ox = 0, oy = 130, rr = 265;
    function p(d) {
      var rad = (d - 90) * Math.PI / 180;
      return { x: ox + rr * Math.cos(rad), y: oy + rr * Math.sin(rad) };
    }
    var s = p(90 - hs), e = p(90 + hs);
    return 'M ' + ox + ',' + oy + ' L ' + s.x + ',' + s.y + ' A ' + rr + ',' + rr + ' 0 0 1 ' + e.x + ',' + e.y + ' Z';
  }

  function prepareSpin(tiles, boons) {
    var t2 = tiles.map(function(t) { return Object.assign({}, t); });
    var mergeGrow = 0;
    var anchorShrink = 0;
    boons.forEach(function(b) {
      if (b.effect === 'win_merge') mergeGrow += boonNumeric(b, 'mergeGrow');
      if (b.effect === 'anchor_lose') anchorShrink += boonNumeric(b, 'shrinkPerSpin');
    });

    if (mergeGrow > 0) {
      var n = t2.length;
      for (var i = 0; i < n; i++) {
        var prev = t2[(i - 1 + n) % n];
        var cur = t2[i];
        var next = t2[(i + 1) % n];
        if (cur.type === 'win' && (prev.type === 'win' || next.type === 'win')) {
          cur.mergeBonus = (cur.mergeBonus || 0) + mergeGrow;
        }
      }
    }

    if (anchorShrink > 0) {
      anchorShrink = clamp(anchorShrink, 0, 0.95);
      for (var j = 0; j < t2.length; j++) {
        if (t2[j].type === 'lose' && t2[j].anchored) {
          t2[j].anchorScale = clamp((t2[j].anchorScale || 1) * (1 - anchorShrink), MIN_ANCHOR_SCALE, 1);
        }
      }
    }

    return { tiles: t2, boons: boons };
  }

  function buildLayout(tiles, boons, addTemp) {
    var wm = 1, lm = 1, tmp = 0, dead = 0;
    for (var i = 0; i < boons.length; i++) {
      var b = boons[i];
      if (b.effect === 'tide_shift') {
        wm *= (1 + boonNumeric(b, 'winGrow'));
        lm *= Math.max(MIN_LOSE_TILE_MULT, 1 - boonNumeric(b, 'loseShrink'));
      }
      if (b.effect === 'temp_win' && addTemp) tmp += boonNumeric(b, 'amount');
      if (b.effect === 'dead_zone' && addTemp) dead += boonNumeric(b, 'size');
    }

    var result = tiles.map(function(t) {
      var base = t.type === 'win' ? wm : lm;
      if (t.type === 'win') base *= (1 + (t.mergeBonus || 0));
      if (t.type === 'lose' && t.anchored) base *= (t.anchorScale || 1);
      return Object.assign({}, t, { sz: Math.max(0.02, base) });
    });

    for (var j = 0; j < tmp; j++) result.push({ id: '_t' + j, type: 'win', sz: wm, temp: true });
    if (dead > 0) result.push({ id: '_dead', type: 'dead', sz: dead, temp: true });
    return result;
  }
  function calcAngles(layout) {
    var total = layout.reduce(function(s, t) { return s + t.sz; }, 0);
    var cum = 0;
    return layout.map(function(t) {
      var span = (t.sz / total) * 360;
      var start = cum; cum += span;
      return { start: start, end: cum, center: start + span / 2 };
    });
  }
  function pickWeighted(layout) {
    var tot = layout.reduce(function(s, t) { return s + t.sz; }, 0);
    var r = Math.random() * tot;
    for (var i = 0; i < layout.length; i++) {
      r -= layout[i].sz;
      if (r <= 0) return i;
    }
    return layout.length - 1;
  }

  function tryRescue(boons) {
    var nb = boons.map(function(b) { return Object.assign({}, b); });

    for (var i = 0; i < nb.length; i++) {
      if (nb[i].effect === 'shield' && (nb[i].charges || 0) > 0) {
        nb = consumeProtected(nb, i);
        return { ok: true, boons: nb };
      }
    }

    for (var j = 0; j < nb.length; j++) {
      if (nb[j].effect === 'rescue_independent' && Math.random() < boonNumeric(nb[j], 'chance')) {
        return { ok: true, boons: nb };
      }
    }

    var addP = 0, addCap = 0;
    nb.forEach(function(b) {
      if (b.effect === 'rescue_additive') {
        addP += boonNumeric(b, 'chance');
        addCap = Math.max(addCap, boonNumeric(b, 'cap'));
      }
    });
    if (addP > 0 && Math.random() < clamp(addP, 0, addCap || 0.95)) return { ok: true, boons: nb };

    var failMul = 1;
    var hasMul = false;
    nb.forEach(function(b) {
      if (b.effect === 'rescue_multiplicative') {
        hasMul = true;
        failMul *= (1 - boonNumeric(b, 'chance'));
      }
    });
    if (hasMul && Math.random() < clamp(1 - failMul, 0, 0.995)) return { ok: true, boons: nb };

    for (var k = 0; k < nb.length; k++) {
      if (nb[k].effect === 'rescue_fragile' && Math.random() < boonNumeric(nb[k], 'chance')) {
        if (Math.random() < boonNumeric(nb[k], 'breakChance')) nb = consumeProtected(nb, k);
        return { ok: true, boons: nb };
      }
    }

    for (var s = 0; s < nb.length; s++) {
      if (nb[s].effect === 'sacrifice_instead') {
        var candidates = [];
        for (var c = 0; c < nb.length; c++) if (c !== s) candidates.push(c);
        var idx = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : s;
        nb.splice(idx, 1);
        return { ok: true, boons: nb };
      }
    }

    return { ok: false, boons: nb };
  }

  function convertLoseToWin(t2, amount) {
    for (var i = 0; i < amount; i++) {
      var li = -1;
      for (var k = 0; k < t2.length; k++) {
        if (t2[k].type === 'lose' && !t2[k].anchored) { li = k; break; }
      }
      if (li !== -1) {
        t2[li] = { id: t2[li].id, type: 'win' };
      } else {
        t2.push({ id: '_x' + Date.now() + '_' + i, type: 'win' });
      }
    }
  }

  function applyValueAuraOnPick(allBoons, picked) {
    if (!picked.randomValue) return allBoons;
    var aura = 0;
    allBoons.forEach(function(b) {
      if (b.effect === 'value_aura') aura += boonNumeric(b, 'bonus');
    });
    if (aura <= 0) return allBoons;
    return allBoons.map(function(b) {
      if (!b.randomValue || b.iid === picked.iid) return b;
      return Object.assign({}, b, { flatBonus: (b.flatBonus || 0) + aura });
    });
  }

  function maybeFreeCopy(boons, picked) {
    var p = 0;
    boons.forEach(function(b) { if (b.effect === 'free_copy_on_pick') p += boonNumeric(b, 'chance'); });
    if (Math.random() < clamp(p, 0, 0.9)) {
      boons.push(Object.assign({}, picked, { iid: makeIid(picked.id) }));
    }
    return boons;
  }

  function upgradeTemplateFor(group, rarity) {
    var rank = RARITY_RANK[rarity] || 0;
    var target = RARITY_ORDER[Math.min(rank + 1, RARITY_ORDER.length - 1)];
    var pool = BOONS.filter(function(t) { return t.group === group && t.rarity === target; });
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function growthWinRatio(growthLevel) {
    if (growthLevel < EARLY_GROWTH_LEVEL_LIMIT) return EARLY_GROWTH_WIN_RATIO;
    if (growthLevel < MID_GROWTH_LEVEL_LIMIT) return MID_GROWTH_WIN_RATIO;
    var reduced = MID_GROWTH_WIN_RATIO - ((growthLevel - MID_GROWTH_DECAY_START_LEVEL) * GROWTH_WIN_RATIO_STEP);
    return clamp(reduced, MIN_GROWTH_WIN_RATIO, MID_GROWTH_WIN_RATIO);
  }

  function buildGrowthTiles(size, winRatio, startId) {
    var winCount = Math.round(size * winRatio);
    winCount = Math.max(1, Math.min(size - 1, winCount));
    var out = [];
    var acc = 0;
    var nextId = startId;
    for (var i = 0; i < size; i++) {
      acc += winCount;
      var isWin = false;
      if (acc >= size) {
        acc -= size;
        isWin = true;
      }
      out.push({ id: nextId++, type: isWin ? 'win' : 'lose' });
    }
    return { tiles: out, nextId: nextId };
  }

  function inferGrowthLevelFromTileCount(tileCount) {
    var level = 0;
    var size = INIT_TILES.length;
    while (size < tileCount) {
      size *= WHEEL_GROWTH_MULTIPLIER;
      level += 1;
    }
    return level;
  }

  function applyBoon(boon, tiles, boons, nid) {
    var t2 = tiles.slice();
    var picked = Object.assign({}, boon, { iid: boon.iid || makeIid(boon.id) });
    if (picked.randomValue && picked.flatBonus === undefined) picked.flatBonus = 0;
    var b2 = boons.concat([picked]);
    var id = nid;

    if (picked.effect === 'temp_win') {
      // Passive, no immediate tile change.
    }

    if (picked.effect === 'anchor_lose') {
      var loseIdx = [];
      for (var a = 0; a < t2.length; a++) if (t2[a].type === 'lose' && !t2[a].anchored) loseIdx.push(a);
      if (loseIdx.length > 0) {
        var li = pick(loseIdx);
        t2[li] = Object.assign({}, t2[li], { anchored: true, anchorScale: 1 });
      }
    }

    if (picked.effect === 'duplicate_right') {
      if (b2.length > 1) {
        var selfIdx = b2.length - 1;
        var rightIdx = (selfIdx + 1) % b2.length;
        if (rightIdx === selfIdx) rightIdx = 0;
        var src = b2[rightIdx];
        b2.splice(rightIdx + 1, 0, Object.assign({}, src, { iid: makeIid(src.id) }));
      }
    }

    if (picked.effect === 'upgrade_random' && boons.length > 0) {
      var tidx = Math.floor(Math.random() * boons.length);
      var tgt = boons[tidx];
      var up = upgradeTemplateFor(tgt.group, tgt.rarity);
      if (up) b2[tidx] = instantiateTemplate(up);
    }

    if (picked.effect === 'convert_same_rarity' && boons.length > 0) {
      var cidx = Math.floor(Math.random() * boons.length);
      var ct = boons[cidx];
      var pool = getTemplatesBy(function(t) { return t.rarity === ct.rarity; });
      if (pool.length > 0) b2[cidx] = instantiateTemplate(pick(pool));
    }

    // Legacy add-win support for compatibility if any existing boon still has it.
    if (picked.effect === 'add_win') {
      convertLoseToWin(t2, picked.amount || 1);
    }

    var grew = t2.every(function(t) { return t.type === 'win'; });
    if (grew) {
      var n = t2.length;
      var priorGrowthLevel = inferGrowthLevelFromTileCount(n);
      var ratio = growthWinRatio(priorGrowthLevel);
      var grown = buildGrowthTiles(n * WHEEL_GROWTH_MULTIPLIER, ratio, id);
      t2 = grown.tiles;
      id = grown.nextId;

      var bonusWins = 0;
      b2.forEach(function(b) { if (b.effect === 'growth_bonus_win') bonusWins += boonNumeric(b, 'amount'); });
      convertLoseToWin(t2, bonusWins);
    }

    b2 = applyValueAuraOnPick(b2, picked);
    b2 = maybeFreeCopy(b2, picked);

    return { tiles: t2, boons: b2, nextId: id, grew: grew };
  }

  global.Pick3Logic = {
    CX: CX,
    CY: CY,
    R: R,
    LAND: LAND,
    RARITY_ORDER: RARITY_ORDER,
    RARITY_SCALE: RARITY_SCALE,
    BOONS: BOONS,
    TOTAL_W: TOTAL_W,
    RC: RC,
    INIT_TILES: INIT_TILES,
    rarityMult: rarityMult,
    polar: polar,
    slicePath: slicePath,
    revealWedge: revealWedge,
    prepareSpin: prepareSpin,
    buildLayout: buildLayout,
    calcAngles: calcAngles,
    pickWeighted: pickWeighted,
    drawBoons: drawBoons,
    getShopRerolls: getShopRerolls,
    rerollShop: rerollShop,
    tryRescue: tryRescue,
    applyBoon: applyBoon,
  };
})(window);
