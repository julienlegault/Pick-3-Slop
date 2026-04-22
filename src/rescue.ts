import { clamp } from './utils';
import { boonNumeric } from './boons/templates';
import type { Boon, RescueResult } from './types';

function consumeProtected(nb: Boon[], idx: number): Boon[] {
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

function rescueToken(b: Boon, idx: number): string {
  return b.iid || (b.id ? b.id + '_' + idx : 'boon_' + idx);
}

export function tryRescue(boons: Boon[]): RescueResult {
  var nb = boons.map(function(b) { return Object.assign({}, b); }) as Boon[];
  var triggered: string[] = [];
  var addP = 0, addCap = 0;
  var failMul = 1;

  for (var i = 0; i < nb.length; i++) {
    var b = nb[i];
    var token = rescueToken(b, i);

    if (b.effect === 'shield' && (b.charges || 0) > 0) {
      triggered.push(token);
      nb = consumeProtected(nb, i) as Boon[];
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
      failMul *= (1 - boonNumeric(b, 'chance'));
      if (Math.random() < clamp(1 - failMul, 0, 0.995)) {
        return { ok: true, boons: nb, triggered: triggered, winBy: 'rescue_multiplicative' };
      }
    }

    if (b.effect === 'rescue_fragile') {
      triggered.push(token);
      if (Math.random() < boonNumeric(b, 'chance')) {
        if (Math.random() < boonNumeric(b, 'breakChance')) nb = consumeProtected(nb, i) as Boon[];
        return { ok: true, boons: nb, triggered: triggered, winBy: 'rescue_fragile' };
      }
    }

    if (b.effect === 'sacrifice_instead') {
      triggered.push(token);
      var candidates: number[] = [];
      for (var c = 0; c < nb.length; c++) if (c !== i) candidates.push(c);
      var sacrificeIdx = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : i;
      nb.splice(sacrificeIdx, 1);
      return { ok: true, boons: nb, triggered: triggered, winBy: 'sacrifice_instead' };
    }
  }

  return { ok: false, boons: nb, triggered: triggered, winBy: null };
}
