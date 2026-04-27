import { clamp } from './utils.js';
import { boonNumeric } from './boons/helpers.js';

export function consumeProtected(nb, idx) {
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

function rescueToken(b, idx) {
  return b.iid || (b.id ? b.id + '_' + idx : 'boon_' + idx);
}

export function tryRescue(boons) {
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

  // suppress unused-variable warning for hasMul (kept for future use)
  void hasMul;
  return { ok: false, boons: nb, triggered: triggered, winBy: null };
}
