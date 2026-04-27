import { boonNumeric } from './boons/helpers.js';

// ── Boon-based doom system (endless mode) ────────────────────────────────────
// Each doom boon has a per-spin chance of immediate loss.
// Value-based boons (randomValue: true): doom% = 10% of the boon's primary ratio value.
// Count/other boons (randomValue absent or count-based): flat 10%.
export function calcBoonDoomChance(boon) {
  // randomValue is explicitly set to true only for boons with randomized numeric values;
  // it is absent (undefined) for fixed-value boons, making the falsy check correct here.
  if (!boon.randomValue || !boon.valueKeys || !boon.valueKeys.length) return 0.10;
  var primaryKey = boon.valueKeys[0];
  var val = boonNumeric(boon, primaryKey);
  // Ratio-based values are between 0 and 1; count-based (charges, tile amounts) are >= 1.
  if (typeof val === 'number' && val > 0 && val < 1) return val * 0.10;
  return 0.10;
}

// Doom chance for a group of same-type boons (additive, capped at 90%).
export function calcGroupDoomChance(groupBoons) {
  if (!groupBoons || !groupBoons.length) return 0;
  var total = groupBoons.reduce(function(s, b) { return s + calcBoonDoomChance(b); }, 0);
  return Math.min(0.90, total);
}

// Return the index of the first lose tile in a layout, or -1 if none exists.
// Used by callers to redirect a doom-forced spin to the lose sector.
export function findLoseIndex(layout) {
  for (var li = 0; li < layout.length; li++) {
    if (layout[li].type === 'lose') return li;
  }
  return -1;
}
