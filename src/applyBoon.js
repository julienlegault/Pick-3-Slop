import {
  RARITY_ORDER, RARITY_RANK,
  WHEEL_GROWTH_MULTIPLIER, FULL_PROB_THRESHOLD,
  GROWTH_WIN_RATIOS, GROWTH_WIN_RATIO_LATE_START_LEVEL, GROWTH_WIN_RATIO_LATE_END_LEVEL,
  GROWTH_WIN_RATIO_LATE_START, GROWTH_WIN_RATIO_LATE_END,
  MIN_POST_SPIN_LOSE_AREA_RATIO, INIT_TILES,
} from './constants.js';
import { clamp, pick } from './utils.js';
import { boonNumeric, makeIid, instantiateTemplate } from './boons/helpers.js';
import { BOONS } from './boons/templates.js';
import { isVirtWheel, virtGetCount, virtTotalCount, makeVirtWheel, buildLayout } from './wheel.js';

function getTemplatesBy(filter) {
  return BOONS.filter(filter);
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

export function buildGrowthTiles(size, winRatio, startId) {
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

export function convertLoseToWin(t2, amount) {
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

export function applyValueAuraOnPick(allBoons, picked) {
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

export function maybeFreeCopy(boons, picked) {
  var p = 0;
  boons.forEach(function(b) { if (b.effect === 'free_copy_on_pick') p += boonNumeric(b, 'chance'); });
  if (Math.random() < clamp(p, 0, 0.9)) {
    boons.push(Object.assign({}, picked, { iid: makeIid(picked.id) }));
  }
  return boons;
}

export function growWheel(tiles, boons, startId) {
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

export function enforceMinimumLoseAreaAfterSpin(tiles, boons, nid) {
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

export function applyBoon(boon, tiles, boons, nid) {
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
