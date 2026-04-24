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
  var MIN_ANCHOR_SCALE = 0.08;
  // Tolerance for float comparisons when checking if a clamped scale reached its minimum.
  var ANCHOR_SCALE_EPSILON = 1e-9;
  var WIN_AREA_BOON_CAPS = { uncommon: 0.35, rare: 0.60, legendary: 0.90 };
  var WIN_MERGE_BOON_CAPS = { uncommon: 0.10, rare: 0.20, legendary: 0.35 };
  var MIN_LOSE_TILE_MULT = 0.08;
  var COMMON_CATCHUP_MIN_STREAK = 2;
  var COMMON_CATCHUP_PER_EXTRA_NON_COMMON = 0.45;
  var COMMON_CATCHUP_MAX_MULT = 3.0;
  // Wheel-growth difficulty curve: grows progressively harder each time.
  // Loss ratios: 1/3, 4/9, 1/2, 2/3, 4/5, …, 95% at the 10th growth.
  var WHEEL_GROWTH_MULTIPLIER = 3;
  // Win ratios indexed by growthLevel (0 = first growth, 1 = second, …)
  var GROWTH_WIN_RATIOS = [2/3, 5/9, 1/2, 1/3, 1/5];
  var GROWTH_WIN_RATIO_LATE_START_LEVEL = 4;   // growthLevel where late curve begins
  var GROWTH_WIN_RATIO_LATE_END_LEVEL = 9;     // growthLevel of the 10th growth
  var GROWTH_WIN_RATIO_LATE_START = 0.20;      // win ratio at late-start level
  var GROWTH_WIN_RATIO_LATE_END = 0.05;        // win ratio at late-end level (95% loss)
  var MIN_POST_SPIN_LOSE_AREA_RATIO = 0.005;
  var MAX_PERCENTAGE = 0.99;
  // At gl >= PROB_DISPLAY_THRESHOLD the wheel is rendered as two probability sectors.
  var PROB_DISPLAY_THRESHOLD = 4;
  // At gl >= FULL_PROB_THRESHOLD the internal tile array is replaced by two virtual tiles,
  // trading per-tile bookkeeping for a compact win/lose count pair.
  var FULL_PROB_THRESHOLD = 6;
  // At gl >= DOOM_THRESHOLD a hidden per-spin forced-loss roll kicks in, bypassing rescue.
  // This ensures even the luckiest runs eventually end without feeling contrived.
  // DOOM_CHANCES[i] is the probability for growthLevel = DOOM_THRESHOLD + i (last entry is used for all higher levels).
  var DOOM_THRESHOLD = FULL_PROB_THRESHOLD;
  var DOOM_CHANCES = [0.005, 0.010, 0.015, 0.020, 0.025];
  // gl=6: 0.5 %, gl=7: 1.0 %, gl=8: 1.5 %, gl=9: 2.0 %, gl≥10: 2.5 %

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

  // ── Doom system ──────────────────────────────────────────────────────────────
  // At gl >= DOOM_THRESHOLD a hidden forced-loss roll is applied before the normal
  // spin result.  When it fires the spin ends as a loss and rescue boons are
  // bypassed, ensuring even the luckiest players eventually run out of luck.
  // The probability is intentionally small so no individual loss feels contrived.
  function tryDoom(growthLevel) {
    if (growthLevel < DOOM_THRESHOLD) return false;
    var i = Math.min(growthLevel - DOOM_THRESHOLD, DOOM_CHANCES.length - 1);
    return Math.random() < DOOM_CHANCES[i];
  }

  // Return the index of the first lose tile in a layout, or -1 if none exists.
  // Used by callers to redirect a doom-forced spin to the lose sector.
  function findLoseIndex(layout) {
    for (var li = 0; li < layout.length; li++) {
      if (layout[li].type === 'lose') return li;
    }
    return -1;
  }

  // ── Virtual-tile helpers ─────────────────────────────────────────────────
  // At FULL_PROB_THRESHOLD the tile array collapses to exactly two entries
  // (one win, one lose), each carrying a _count representing how many
  // real tiles that sector stands for.  All functions check isVirtWheel()
  // before touching individual-tile properties.
  function isVirtWheel(tiles) {
    return tiles.length > 0 && tiles[0]._virt === true;
  }
  function virtGetCount(tiles, type) {
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i].type === type) return tiles[i]._count || 0;
    }
    return 0;
  }
  function virtTotalCount(tiles) {
    var s = 0;
    for (var i = 0; i < tiles.length; i++) s += (tiles[i]._count || 0);
    return s;
  }
  function makeVirtWheel(winCount, loseCount) {
    return [
      { id: -1, type: 'win',  _virt: true, _count: Math.max(0, Math.round(winCount))  },
      { id: -2, type: 'lose', _virt: true, _count: Math.max(1, Math.round(loseCount)) },
    ];
  }

  function rarityRange(rarity, map) {
    return map[rarity] || map.rare;
  }

  var TEMPLATE_MAP = {};
  function boonTemplate(def) {
    TEMPLATE_MAP[def.id] = def;
    return def;
  }

  function numericBoon(idRoot, name, effect, wMap, rangesByKey, descFn, extra, keyCaps) {
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
    function(_, v) { return 'Win tiles +' + pct(v.winGrow) + '% size and lose tiles -' + pct(v.loseShrink) + '% size.'; },
    null,
    { winGrow: WIN_AREA_BOON_CAPS }
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
    function(_, v) { return 'Adjacent win tiles grow by +' + pct(v.mergeGrow) + '% each spin.'; },
    null,
    { mergeGrow: WIN_MERGE_BOON_CAPS }
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
    var capKey = key + 'Cap';
    var cap = (boon[capKey] !== undefined) ? Math.min(boon[capKey], MAX_PERCENTAGE) : MAX_PERCENTAGE;
    return clamp(val + fb, 0, cap);
  }

  function getEffectiveDesc(boon) {
    if (!boon.descFn || !boon.randomValue) return boon.desc;
    var vals = {};
    (boon.valueKeys || []).forEach(function(k) {
      vals[k] = boonNumeric(boon, k);
    });
    return boon.descFn(boon.rarity, vals);
  }

  function getStackedDesc(groupBoons) {
    if (!groupBoons || !groupBoons.length) return '';
    if (groupBoons.length === 1) return getEffectiveDesc(groupBoons[0]);
    var b0 = groupBoons[0];
    var n = groupBoons.length;
    if (!b0.descFn || !b0.randomValue) {
      return b0.desc + ' (\xd7' + n + ')';
    }
    var effect = b0.effect;
    var keys = b0.valueKeys || [];
    var vals = {};

    if (effect === 'rescue_independent') {
      var combP = 1 - groupBoons.reduce(function(acc, b) { return acc * (1 - boonNumeric(b, 'chance')); }, 1);
      return 'On a loss: ' + pct(combP) + '% combined chance to win (\xd7' + n + ' copies, each triggers separately).';
    }
    if (effect === 'rescue_fragile') {
      var combP2 = 1 - groupBoons.reduce(function(acc, b) { return acc * (1 - boonNumeric(b, 'chance')); }, 1);
      return 'On a loss: ' + pct(combP2) + '% combined chance to win (\xd7' + n + ' copies, fragile).';
    }
    if (effect === 'rescue_multiplicative') {
      vals.chance = 1 - groupBoons.reduce(function(acc, b) { return acc * (1 - boonNumeric(b, 'chance')); }, 1);
      return 'On a loss: combined ' + pct(vals.chance) + '% multiplicative rescue chance (\xd7' + n + ' copies).';
    }
    if (effect === 'rescue_additive') {
      vals.chance = groupBoons.reduce(function(acc, b) { return acc + boonNumeric(b, 'chance'); }, 0);
      vals.cap = groupBoons.reduce(function(acc, b) { return Math.max(acc, boonNumeric(b, 'cap')); }, 0);
      return b0.descFn(b0.rarity, vals);
    }
    if (effect === 'tide_shift') {
      // Compound growth: each copy multiplies the remaining win-area factor,
      // so combined = (1+a)(1+b)...-1, not a simple sum.
      vals.winGrow = groupBoons.reduce(function(acc, b) { return (acc + 1) * (1 + boonNumeric(b, 'winGrow')) - 1; }, 0);
      vals.loseShrink = 1 - groupBoons.reduce(function(acc, b) { return acc * (1 - boonNumeric(b, 'loseShrink')); }, 1);
      return b0.descFn(b0.rarity, vals);
    }

    keys.forEach(function(k) {
      vals[k] = groupBoons.reduce(function(acc, b) { return acc + boonNumeric(b, k); }, 0);
    });
    return b0.descFn(b0.rarity, vals);
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

  function computeRarityWeights(gl, boons, options) {
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

  function rerollShop(count, gl, boons, options) {
    var used = consumeShopReroll(boons, gl);
    if (!used.ok) return { ok: false, choices: [], boons: boons };
    var drawn = drawBoons(count, gl, used.boons, options);
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
    var b2 = boons.map(function(b) { return Object.assign({}, b); });
    var mergeGrow = 0;
    var anchorShrink = 0;
    b2.forEach(function(b) {
      if (b.effect === 'win_merge') mergeGrow += boonNumeric(b, 'mergeGrow');
      if (b.effect === 'anchor_lose') anchorShrink += boonNumeric(b, 'shrinkPerSpin');
    });

    if (isVirtWheel(t2)) {
      // Virtual mode: approximate adjacency fraction for win_merge rather than
      // iterating individual tiles.  For a uniformly-interleaved distribution
      // each win tile has a win neighbour with probability ≈ min(1, 2·winRatio).
      if (mergeGrow > 0) {
        var totC = virtTotalCount(t2);
        var winC = virtGetCount(t2, 'win');
        var winRatio = totC > 0 ? winC / totC : 0;
        var adjFrac = Math.min(1, 2 * winRatio);
        for (var vi = 0; vi < t2.length; vi++) {
          if (t2[vi].type === 'win') {
            t2[vi].mergeBonus = (t2[vi].mergeBonus || 0) + mergeGrow * adjFrac;
          }
        }
      }
      // anchor_lose: individual anchored tiles don't exist in virtual mode; skip.
      return { tiles: t2, boons: b2 };
    }

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
      var expiredAnchorTileIdx = [];
      var anchorBoonIdx = [];
      for (var j = 0; j < t2.length; j++) {
        if (t2[j].type === 'lose' && t2[j].anchored) {
          var nextScale = clamp((t2[j].anchorScale || 1) * (1 - anchorShrink), MIN_ANCHOR_SCALE, 1);
          t2[j].anchorScale = nextScale;
          if (nextScale <= MIN_ANCHOR_SCALE + ANCHOR_SCALE_EPSILON) { // epsilon guards float precision near clamp floor
            expiredAnchorTileIdx.push(j);
          }
        }
      }
      for (var k = 0; k < b2.length; k++) {
        if (b2[k].effect === 'anchor_lose') anchorBoonIdx.push(k);
      }
      var anchorExpirationsToProcess = Math.min(expiredAnchorTileIdx.length, anchorBoonIdx.length);
      for (var ei = 0; ei < anchorExpirationsToProcess; ei++) {
        var ti = expiredAnchorTileIdx[ei];
        var unlocked = Object.assign({}, t2[ti]);
        delete unlocked.anchored;
        delete unlocked.anchorScale;
        t2[ti] = unlocked;
      }
      var removableAnchorBoonIndices = anchorBoonIdx
        .slice(0, anchorExpirationsToProcess)
        .sort(function(a, b) { return b - a; });
      for (var bi = 0; bi < removableAnchorBoonIndices.length; bi++) {
        var removeAt = removableAnchorBoonIndices[bi];
        if (removeAt >= 0 && removeAt < b2.length) {
          b2.splice(removeAt, 1);
        }
      }
    }

    return { tiles: t2, boons: b2 };
  }

  function buildLayout(tiles, boons, addTemp) {
    var wm = 1, lm = 1, tmp = 0;
    for (var i = 0; i < boons.length; i++) {
      var b = boons[i];
      if (b.effect === 'tide_shift') {
        wm *= (1 + boonNumeric(b, 'winGrow'));
        lm *= Math.max(MIN_LOSE_TILE_MULT, 1 - boonNumeric(b, 'loseShrink'));
      }
      if (b.effect === 'temp_win' && addTemp) tmp += boonNumeric(b, 'amount');
    }

    if (isVirtWheel(tiles)) {
      var winC = virtGetCount(tiles, 'win');
      var loseC = virtGetCount(tiles, 'lose');
      var winTile = tiles.find(function(t) { return t.type === 'win'; });
      var mergeMult = winTile ? (1 + (winTile.mergeBonus || 0)) : 1;
      var result = [
        Object.assign({}, winTile,  { sz: Math.max(0.02, winC  * wm * mergeMult) }),
        Object.assign({}, tiles.find(function(t) { return t.type === 'lose'; }), { sz: Math.max(0.02, loseC * lm) }),
      ];
      if (tmp > 0) result.push({ id: '_vt0', type: 'win', _virt: true, _count: tmp, sz: Math.max(0.02, tmp * wm), temp: true });
      return result;
    }

    var result = tiles.map(function(t) {
      var base = t.type === 'win' ? wm : lm;
      if (t.type === 'win') base *= (1 + (t.mergeBonus || 0));
      if (t.type === 'lose' && t.anchored) base *= (t.anchorScale || 1);
      return Object.assign({}, t, { sz: Math.max(0.02, base) });
    });

    for (var j = 0; j < tmp; j++) result.push({ id: '_t' + j, type: 'win', sz: wm, temp: true });
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

  function rescueToken(b, idx) {
    return b.iid || (b.id ? b.id + '_' + idx : 'boon_' + idx);
  }

  function tryRescue(boons) {
    var nb = boons.map(function(b) { return Object.assign({}, b); });
    var triggered = [];
    var addP = 0, addCap = 0;
    var failMul = 1;
    var hasMul = false;

    // Pre-compute combined rescue fail probability to enforce a ≤99% win cap.
    // Shield and sacrifice always guarantee a win, so skip the cap check for those.
    var preHasGuarantee = nb.some(function(b) {
      return (b.effect === 'shield' && (b.charges || 0) > 0) || b.effect === 'sacrifice_instead';
    });
    if (!preHasGuarantee) {
      var preIndFail = 1.0, preAddFail = 1.0, preMulFail = 1.0, preFragFail = 1.0;
      var preAddP = 0, preAddCap = 0.95, preFailMul = 1.0;
      // Each rescue type uses sequential independent random checks, so the combined failure
      // probability is the product of every individual check's failure probability.
      // Additive: after each boon the check uses the running cumulative addP (not just the
      //   marginal addition), so preAddFail = ∏(1 - clamp(addP_k, 0, addCap)).
      // Multiplicative: each boon checks against the running combined win probability, so
      //   preMulFail = ∏(1 - clamp(1 - failMul_k, 0, 0.995)).
      nb.forEach(function(b) {
        if (b.effect === 'rescue_independent') preIndFail *= (1 - boonNumeric(b, 'chance'));
        if (b.effect === 'rescue_additive') {
          preAddP += boonNumeric(b, 'chance');
          preAddCap = Math.max(preAddCap, boonNumeric(b, 'cap'));
          preAddFail *= (1 - clamp(preAddP, 0, preAddCap));
        }
        if (b.effect === 'rescue_multiplicative') {
          preFailMul *= (1 - boonNumeric(b, 'chance'));
          preMulFail *= (1 - clamp(1 - preFailMul, 0, 0.995));
        }
        if (b.effect === 'rescue_fragile') preFragFail *= (1 - boonNumeric(b, 'chance'));
      });
      var combinedFail = preIndFail * preAddFail * preMulFail * preFragFail;
      if (combinedFail < 0.01) {
        // Win probability would exceed 99%; apply a forced-loss pre-roll to cap it.
        // Solving P(forced loss) × 1 + P(not forced) × combinedFail = 0.01 gives:
        //   forceFail = (0.01 - combinedFail) / (1 - combinedFail)
        var forceFail = (0.01 - combinedFail) / (1 - combinedFail);
        if (Math.random() < forceFail) {
          return { ok: false, boons: nb, triggered: [], winBy: null };
        }
      }
    }

    for (var i = 0; i < nb.length; i++) {
      var b = nb[i];
      var token = rescueToken(b, i);

      if (b.effect === 'shield' && (b.charges || 0) > 0) {
        triggered.push(token);
        nb = consumeProtected(nb, i);
        return { ok: true, boons: nb, triggered: triggered, winBy: 'shield' };
      }

      if (b.effect === 'rescue_independent') {
        triggered.push(token);
        if (Math.random() < boonNumeric(b, 'chance')) {
          return { ok: true, boons: nb, triggered: triggered, winBy: 'rescue_independent' };
        }
      }

      if (b.effect === 'rescue_additive') {
        triggered.push(token);
        addP += boonNumeric(b, 'chance');
        addCap = Math.max(addCap, boonNumeric(b, 'cap'));
        if (Math.random() < clamp(addP, 0, addCap || 0.95)) {
          return { ok: true, boons: nb, triggered: triggered, winBy: 'rescue_additive' };
        }
      }

      if (b.effect === 'rescue_multiplicative') {
        triggered.push(token);
        hasMul = true;
        failMul *= (1 - boonNumeric(b, 'chance'));
        if (Math.random() < clamp(1 - failMul, 0, 0.995)) {
          return { ok: true, boons: nb, triggered: triggered, winBy: 'rescue_multiplicative' };
        }
      }

      if (b.effect === 'rescue_fragile') {
        triggered.push(token);
        if (Math.random() < boonNumeric(b, 'chance')) {
          if (Math.random() < boonNumeric(b, 'breakChance')) nb = consumeProtected(nb, i);
          return { ok: true, boons: nb, triggered: triggered, winBy: 'rescue_fragile' };
        }
      }

      if (b.effect === 'sacrifice_instead') {
        triggered.push(token);
        var candidates = [];
        for (var c = 0; c < nb.length; c++) if (c !== i) candidates.push(c);
        var idx = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : i;
        nb.splice(idx, 1);
        return { ok: true, boons: nb, triggered: triggered, winBy: 'sacrifice_instead' };
      }
    }

    return { ok: false, boons: nb, triggered: triggered, winBy: null };
  }

  function convertLoseToWin(t2, amount) {
    if (isVirtWheel(t2)) {
      // Adjust virtual counts; return no individual IDs (no flip animation in virtual mode).
      for (var v = 0; v < t2.length; v++) {
        if (t2[v].type === 'win')  t2[v] = Object.assign({}, t2[v], { _count: t2[v]._count + amount });
        if (t2[v].type === 'lose') t2[v] = Object.assign({}, t2[v], { _count: Math.max(1, t2[v]._count - amount) });
      }
      return [];
    }
    var flipped = [];
    for (var i = 0; i < amount; i++) {
      var li = -1;
      for (var k = 0; k < t2.length; k++) {
        if (t2[k].type === 'lose' && !t2[k].anchored) { li = k; break; }
      }
      if (li !== -1) {
        flipped.push(t2[li].id);
        t2[li] = { id: t2[li].id, type: 'win' };
      } else {
        var id = '_x' + Date.now() + '_' + i;
        t2.push({ id: id, type: 'win' });
        flipped.push(id);
      }
    }
    return flipped;
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
    // Lookup table for first five growths, then linear interpolation toward 5% win at level 9+.
    if (growthLevel < GROWTH_WIN_RATIOS.length) return GROWTH_WIN_RATIOS[growthLevel];
    var span = GROWTH_WIN_RATIO_LATE_END_LEVEL - GROWTH_WIN_RATIO_LATE_START_LEVEL;
    var t = Math.min(growthLevel - GROWTH_WIN_RATIO_LATE_START_LEVEL, span) / span;
    return GROWTH_WIN_RATIO_LATE_START + t * (GROWTH_WIN_RATIO_LATE_END - GROWTH_WIN_RATIO_LATE_START);
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
    // Reconstruct prior growth count directly from wheel size progression (base size * 3^n).
    var level = 0;
    var size = INIT_TILES.length;
    while (size < tileCount) {
      size *= WHEEL_GROWTH_MULTIPLIER;
      level += 1;
    }
    return level;
  }

  function growWheel(tiles, boons, startId) {
    var n = isVirtWheel(tiles) ? virtTotalCount(tiles) : tiles.length;
    var priorGrowthLevel = inferGrowthLevelFromTileCount(n);
    var ratio = growthWinRatio(priorGrowthLevel);
    var newTotal = n * WHEEL_GROWTH_MULTIPLIER;
    var b2 = boons.filter(function(b) { return b.effect !== 'tide_shift'; });
    var bonusWins = 0;
    boons.forEach(function(b) { if (b.effect === 'growth_bonus_win') bonusWins += boonNumeric(b, 'amount'); });
    var flippedIds = [];
    var t2, id;

    if (isVirtWheel(tiles) || priorGrowthLevel + 1 >= FULL_PROB_THRESHOLD) {
      // Compress (or stay) in virtual-tile mode.
      var rawWin  = Math.max(1, Math.round(newTotal * ratio)) + bonusWins;
      var rawLose = Math.max(1, newTotal - Math.round(newTotal * ratio));
      t2 = makeVirtWheel(rawWin, rawLose);
      id = startId; // no individual tile IDs needed
    } else {
      var grown = buildGrowthTiles(newTotal, ratio, startId);
      t2 = grown.tiles;
      id = grown.nextId;
      if (bonusWins > 0) {
        flippedIds = flippedIds.concat(convertLoseToWin(t2, bonusWins));
      }
    }

    return { tiles: t2, boons: b2, nextId: id, flippedIds: flippedIds };
  }

  function loseAreaRatio(tiles, boons) {
    var layout = buildLayout(tiles, boons, false);
    var total = layout.reduce(function(sum, t) { return sum + t.sz; }, 0);
    if (total <= 0) return 0;
    var lose = layout.reduce(function(sum, t) { return sum + (t.type === 'lose' ? t.sz : 0); }, 0);
    return lose / total;
  }

  function enforceMinimumLoseAreaAfterSpin(tiles, boons, nid) {
    if (loseAreaRatio(tiles, boons) >= MIN_POST_SPIN_LOSE_AREA_RATIO) {
      return { tiles: tiles, boons: boons, nextId: nid, grew: false, flippedIds: [] };
    }
    var grown = growWheel(tiles, boons, nid);
    return {
      tiles: grown.tiles,
      boons: grown.boons,
      nextId: grown.nextId,
      grew: true,
      flippedIds: grown.flippedIds
    };
  }

  function applyBoon(boon, tiles, boons, nid) {
    var t2 = tiles.slice();
    var picked = Object.assign({}, boon, { iid: boon.iid || makeIid(boon.id) });
    if (picked.randomValue && picked.flatBonus === undefined) picked.flatBonus = 0;
    var b2 = boons.concat([picked]);
    var id = nid;
    var flippedIds = [];

    if (picked.effect === 'temp_win') {
      // Passive, no immediate tile change.
    }

    if (picked.effect === 'anchor_lose') {
      if (!isVirtWheel(t2)) {
        var loseIdx = [];
        for (var a = 0; a < t2.length; a++) if (t2[a].type === 'lose' && !t2[a].anchored) loseIdx.push(a);
        if (loseIdx.length > 0) {
          var li = pick(loseIdx);
          t2[li] = Object.assign({}, t2[li], { anchored: true, anchorScale: 1 });
        }
      }
      // Virtual mode: boon is kept for probability-level effects; individual anchor skipped.
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

    var keptBoons = [];
    var pendingAddWins = 0;
    b2.forEach(function(b) {
      if (b.effect === 'add_win') pendingAddWins += boonNumeric(b, 'amount') || b.amount || 1;
      else keptBoons.push(b);
    });
    b2 = keptBoons;
    if (pendingAddWins > 0) {
      flippedIds = flippedIds.concat(convertLoseToWin(t2, pendingAddWins));
    }

    var grew;
    if (isVirtWheel(t2)) {
      grew = virtGetCount(t2, 'lose') <= 0;
    } else {
      grew = t2.every(function(t) { return t.type === 'win'; });
    }
    if (grew) {
      var growth = growWheel(t2, b2, id);
      t2 = growth.tiles;
      b2 = growth.boons;
      id = growth.nextId;
      flippedIds = flippedIds.concat(growth.flippedIds);
    }

    b2 = applyValueAuraOnPick(b2, picked);
    b2 = maybeFreeCopy(b2, picked);

    return { tiles: t2, boons: b2, nextId: id, grew: grew, flippedIds: flippedIds };
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
    PROB_DISPLAY_THRESHOLD: PROB_DISPLAY_THRESHOLD,
    FULL_PROB_THRESHOLD: FULL_PROB_THRESHOLD,
    DOOM_THRESHOLD: DOOM_THRESHOLD,
    DOOM_CHANCES: DOOM_CHANCES,
    isVirtWheel: isVirtWheel,
    virtGetCount: virtGetCount,
    virtTotalCount: virtTotalCount,
    rarityMult: rarityMult,
    polar: polar,
    slicePath: slicePath,
    revealWedge: revealWedge,
    prepareSpin: prepareSpin,
    buildLayout: buildLayout,
    calcAngles: calcAngles,
    pickWeighted: pickWeighted,
    tryDoom: tryDoom,
    findLoseIndex: findLoseIndex,
    drawBoons: drawBoons,
    getShopRerolls: getShopRerolls,
    rerollShop: rerollShop,
    tryRescue: tryRescue,
    enforceMinimumLoseAreaAfterSpin: enforceMinimumLoseAreaAfterSpin,
    applyBoon: applyBoon,
    getStackedDesc: getStackedDesc,
    instantiateTemplate: instantiateTemplate,
  };
})(window);
