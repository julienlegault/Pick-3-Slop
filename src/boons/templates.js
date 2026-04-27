import { randFloat, randInt, pct, rarityRange } from '../utils.js';
import { WIN_AREA_BOON_CAPS, WIN_MERGE_BOON_CAPS } from '../constants.js';

export var TEMPLATE_MAP = {};
export function boonTemplate(def) {
  TEMPLATE_MAP[def.id] = def;
  return def;
}

export function numericBoon(idRoot, name, effect, wMap, rangesByKey, descFn, extra, keyCaps) {
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
        rolled.descFn = descFn;
        rolled.valueKeys = Object.keys(rangesByKey);
        rolled.desc = descFn(rarity, rolled);
        if (keyCaps) {
          Object.keys(keyCaps).forEach(function(k) {
            var caps = keyCaps[k];
            if (caps && caps[rarity] !== undefined) {
              rolled[k + 'Cap'] = caps[rarity];
            }
          });
        }
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

export var BOONS = [];
function addMany(arr) { arr.forEach(function(x) { BOONS.push(x); }); }

addMany(numericBoon(
  'rescue_independent',
  'Rescue Chance',
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
  name: 'Win Tile',
  rarity: 'common',
  w: 30,
  effect: 'add_win',
  amount: 1,
  desc: 'Immediately flip one lose tile to win.'
}));

addMany(numericBoon(
  'rescue_additive',
  'Add Rescue',
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
  'Multiply Rescue',
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
  'Adjust Tile Sizes',
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
  function(_, v) { return 'Win tiles +' + pct(v.winGrow) + '% size and lose tiles -' + pct(v.loseShrink) + '% size.'; },
  null,
  { winGrow: WIN_AREA_BOON_CAPS }
));

['common', 'uncommon', 'rare', 'legendary'].forEach(function(targetRarity) {
  BOONS.push(boonTemplate({
    id: 'rarity_boost_' + targetRarity,
    group: 'rarity_boost_' + targetRarity,
    name: targetRarity.charAt(0).toUpperCase() + targetRarity.slice(1) + ' More Often',
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
  'Fragile Rescue',
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
  'Shop Reroll',
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
  name: 'Reroll on Level Up',
  rarity: 'rare',
  w: 3,
  effect: 'shop_reroll_growth',
  lastGrowthUsed: -1,
  desc: 'Shop: one permanent reroll each wheel growth level.'
}));

addMany(numericBoon(
  'temp_win',
  'Temp Win Tile',
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
  name: 'Duplicate Boon',
  rarity: 'rare',
  w: 3,
  effect: 'duplicate_right',
  desc: 'Immediately duplicate the boon to this boon\'s right in stack order (wraps to first).'
}));

BOONS.push(boonTemplate({
  id: 'shield',
  group: 'shield',
  name: 'Block One Loss',
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
    name: 'Guaranteed ' + r.charAt(0).toUpperCase() + r.slice(1) + ' Drop',
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
  'Win Tiles Grow Together',
  'win_merge',
  { uncommon: 5, rare: 4, legendary: 2 },
  { mergeGrow: {
    uncommon: { min: 0.03, max: 0.06, step: 0.01 },
    rare: { min: 0.07, max: 0.12, step: 0.01 },
    legendary: { min: 0.15, max: 0.22, step: 0.01 },
  }},
  function(_, v) { return 'Adjacent win tiles grow by +' + pct(v.mergeGrow) + '% each spin.'; },
  null,
  { mergeGrow: WIN_MERGE_BOON_CAPS }
));

addMany(numericBoon(
  'anchor_lose',
  'Shrink Lose Tile',
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
  'More Win Tiles',
  'growth_bonus_win',
  { uncommon: 5, rare: 4, legendary: 2 },
  { amount: {
    uncommon: { min: 1, max: 1, int: true },
    rare: { min: 1, max: 2, int: true },
    legendary: { min: 2, max: 3, int: true },
  }},
  function(_, v) { return 'After each wheel growth, add ' + v.amount + ' extra win tile(s).'; }
));

BOONS.push(boonTemplate({
  id: 'sacrifice_instead',
  group: 'sacrifice_instead',
  name: 'Lose Boon Instead',
  rarity: 'rare',
  w: 3,
  effect: 'sacrifice_instead',
  desc: 'If you would lose, sacrifice one held boon instead.'
}));

BOONS.push(boonTemplate({
  id: 'upgrade_random',
  group: 'upgrade_random',
  name: 'Upgrade Boon',
  rarity: 'rare',
  w: 3,
  effect: 'upgrade_random',
  desc: 'Upgrade a random boon you already own to a higher rarity.'
}));

BOONS.push(boonTemplate({
  id: 'convert_same_rarity',
  group: 'convert_same_rarity',
  name: 'Replace Random Boon',
  rarity: 'rare',
  w: 3,
  effect: 'convert_same_rarity',
  desc: 'Convert a random held boon into a random boon of the same rarity.'
}));

addMany(numericBoon(
  'free_copy_on_pick',
  'Maybe Get Two',
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
  'Maybe Keep Boon',
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
  name: 'Get One You Have',
  rarity: 'legendary',
  w: 1,
  effect: 'guarantee_owned_type',
  uses: 1,
  oneTimeTrigger: true,
  desc: 'Next shop guarantees one boon type you already own.'
}));

addMany(numericBoon(
  'value_aura',
  'Number Go Up',
  'value_aura',
  { uncommon: 4, rare: 3, legendary: 2 },
  { bonus: {
    uncommon: { min: 0.01, max: 0.02, step: 0.01 },
    rare: { min: 0.03, max: 0.05, step: 0.01 },
    legendary: { min: 0.06, max: 0.08, step: 0.01 },
  }},
  function(_, v) { return 'When you pick a random-value boon, all your other random-value boons gain +' + pct(v.bonus) + '% flat value.'; }
));

export var TOTAL_W = BOONS.reduce(function(s, b) { return s + b.w; }, 0);
