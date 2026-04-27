import { clamp, pct } from '../utils.js';
import { FLAT_BONUS_STACK_TO_COUNT, MIN_STACKABLE_COUNT, MAX_PERCENTAGE } from '../constants.js';

export function makeIid(id) { return id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }

export function cloneBoon(b) { return Object.assign({}, b, { iid: makeIid(b.id) }); }

export function instantiateTemplate(tpl) {
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

export function boonNumeric(boon, key) {
  var val = boon[key] === undefined ? 0 : boon[key];
  if (!boon.randomValue) return val;
  var fb = boon.flatBonus || 0;
  if (typeof val !== 'number') return val;
  if (key === 'charges' || key === 'amount') return Math.max(MIN_STACKABLE_COUNT, Math.round(val + fb * FLAT_BONUS_STACK_TO_COUNT));
  var capKey = key + 'Cap';
  var cap = (boon[capKey] !== undefined) ? Math.min(boon[capKey], MAX_PERCENTAGE) : MAX_PERCENTAGE;
  return clamp(val + fb, 0, cap);
}

export function getEffectiveDesc(boon) {
  if (!boon.descFn || !boon.randomValue) return boon.desc;
  var vals = {};
  (boon.valueKeys || []).forEach(function(k) {
    vals[k] = boonNumeric(boon, k);
  });
  return boon.descFn(boon.rarity, vals);
}

export function getStackedDesc(groupBoons) {
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
