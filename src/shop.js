import { RARITY_ORDER, COMMON_CATCHUP_MIN_STREAK, COMMON_CATCHUP_PER_EXTRA_NON_COMMON, COMMON_CATCHUP_MAX_MULT } from './constants.js';
import { rarityMult, pick } from './utils.js';
import { boonNumeric, instantiateTemplate } from './boons/helpers.js';
import { BOONS } from './boons/templates.js';
import { consumeProtected } from './rescue.js';

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

function pickRareOrBetter(weightMap) {
  var pool = ['rare', 'legendary'];
  var total = pool.reduce(function(s, r) { return s + (weightMap[r] || 0); }, 0);
  if (total <= 0) return 'rare';
  var rr = Math.random() * total;
  for (var i = 0; i < pool.length; i++) {
    var r = pool[i];
    rr -= weightMap[r] || 0;
    if (rr <= 0) return r;
  }
  return 'legendary';
}

export function computeRarityWeights(gl, boons, options) {
  var opts = options || {};
  var rarityW = {};
  RARITY_ORDER.forEach(function(r) {
    var base = BOONS.filter(function(b) { return b.rarity === r; }).reduce(function(s, b) { return s + b.w; }, 0);
    var bonus = 0;
    boons.forEach(function(b) {
      if (b.effect === 'rarity_boost' && b.targetRarity === r) bonus += (b.bonus || 0);
    });
    rarityW[r] = base * rarityMult(r, gl) * Math.max(0, 1 + bonus);
  });
  var nonCommonPickStreak = Math.max(0, opts.nonCommonPickStreak || 0);
  if (nonCommonPickStreak >= COMMON_CATCHUP_MIN_STREAK) {
    var streakBeyondThreshold = nonCommonPickStreak - (COMMON_CATCHUP_MIN_STREAK - 1);
    var commonMult = Math.min(COMMON_CATCHUP_MAX_MULT, 1 + streakBeyondThreshold * COMMON_CATCHUP_PER_EXTRA_NON_COMMON);
    rarityW.common *= commonMult;
  }
  if (opts.firstShop) {
    rarityW.uncommon = (rarityW.uncommon || 0) * 5;
    rarityW.rare = (rarityW.rare || 0) * 12;
    rarityW.legendary = (rarityW.legendary || 0) * 5;
  }
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

export function consumeNextShopFlags(boons) {
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

export function drawBoons(count, gl, boons, options) {
  var owned = boons || [];
  var opts = options || {};
  var consumed = consumeNextShopFlags(owned);
  var nb = consumed.boons;
  var forcedRarity = consumed.forcedRarity;
  var forcedGroup = consumed.forcedGroup;
  var firstShopGuarantee = opts.firstShop === true;

  var rarityW = computeRarityWeights(gl, nb, opts);
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
      tpl = pickTemplateByRarity(pickRareOrBetter(rarityW), null);
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

export function getShopRerolls(boons, gl) {
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

export function rerollShop(count, gl, boons, options) {
  var used = consumeShopReroll(boons, gl);
  if (!used.ok) return { ok: false, choices: [], boons: boons };
  var drawn = drawBoons(count, gl, used.boons, options);
  return { ok: true, choices: drawn.choices, boons: drawn.boons };
}

// suppress unused-variable warning for pickUncommonOrBetter (kept for future use)
void pickUncommonOrBetter;
