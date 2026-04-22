import {
  RARITY_ORDER, RARITY_RANK, WHEEL_GROWTH_MULTIPLIER, INIT_TILES,
  EARLY_GROWTH_LEVEL_LIMIT, MID_GROWTH_LEVEL_LIMIT, MID_GROWTH_DECAY_START_LEVEL,
  EARLY_GROWTH_WIN_RATIO, MID_GROWTH_WIN_RATIO, MIN_GROWTH_WIN_RATIO, GROWTH_WIN_RATIO_STEP,
} from './constants';
import { clamp, makeIid, pickRandom } from './utils';
import { BOONS, boonNumeric, instantiateTemplate } from './boons/templates';
import { getTemplatesBy } from './shop';
import type { Tile, Boon, ApplyBoonResult } from './types';

function convertLoseToWin(t2: Tile[], amount: number): (number | string)[] {
  var flipped: (number | string)[] = [];
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

function applyValueAuraOnPick(allBoons: Boon[], picked: Boon): Boon[] {
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

function maybeFreeCopy(boons: Boon[], picked: Boon): Boon[] {
  var p = 0;
  boons.forEach(function(b) { if (b.effect === 'free_copy_on_pick') p += boonNumeric(b, 'chance'); });
  if (Math.random() < clamp(p, 0, 0.9)) {
    boons.push(Object.assign({}, picked, { iid: makeIid(picked.id) }));
  }
  return boons;
}

function upgradeTemplateFor(group: string, rarity: string) {
  var rank = RARITY_RANK[rarity as keyof typeof RARITY_RANK] || 0;
  var target = RARITY_ORDER[Math.min(rank + 1, RARITY_ORDER.length - 1)];
  var pool = BOONS.filter(function(t) { return t.group === group && t.rarity === target; });
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function growthWinRatio(growthLevel: number): number {
  if (growthLevel < EARLY_GROWTH_LEVEL_LIMIT) return EARLY_GROWTH_WIN_RATIO;
  if (growthLevel < MID_GROWTH_LEVEL_LIMIT) return MID_GROWTH_WIN_RATIO;
  var reduced = MID_GROWTH_WIN_RATIO - ((growthLevel - MID_GROWTH_DECAY_START_LEVEL) * GROWTH_WIN_RATIO_STEP);
  return clamp(reduced, MIN_GROWTH_WIN_RATIO, MID_GROWTH_WIN_RATIO);
}

function buildGrowthTiles(size: number, winRatio: number, startId: number): { tiles: Tile[]; nextId: number } {
  var winCount = Math.round(size * winRatio);
  winCount = Math.max(1, Math.min(size - 1, winCount));
  var out: Tile[] = [];
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

function inferGrowthLevelFromTileCount(tileCount: number): number {
  var level = 0;
  var size = INIT_TILES.length;
  while (size < tileCount) {
    size *= WHEEL_GROWTH_MULTIPLIER;
    level += 1;
  }
  return level;
}

export function applyBoon(boon: Boon, tiles: Tile[], boons: Boon[], nid: number): ApplyBoonResult {
  var t2 = tiles.slice();
  var picked = Object.assign({}, boon, { iid: boon.iid || makeIid(boon.id) }) as Boon;
  if (picked.randomValue && picked.flatBonus === undefined) picked.flatBonus = 0;
  var b2 = boons.concat([picked]) as Boon[];
  var id = nid;
  var flippedIds: (number | string)[] = [];

  if (picked.effect === 'anchor_lose') {
    var loseIdx: number[] = [];
    for (var a = 0; a < t2.length; a++) if (t2[a].type === 'lose' && !t2[a].anchored) loseIdx.push(a);
    if (loseIdx.length > 0) {
      var li = pickRandom(loseIdx);
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
    if (pool.length > 0) b2[cidx] = instantiateTemplate(pickRandom(pool));
  }

  var keptBoons: Boon[] = [];
  var pendingAddWins = 0;
  b2.forEach(function(b) {
    if (b.effect === 'add_win') pendingAddWins += boonNumeric(b, 'amount') || b.amount || 1;
    else keptBoons.push(b);
  });
  b2 = keptBoons;
  if (pendingAddWins > 0) {
    flippedIds = flippedIds.concat(convertLoseToWin(t2, pendingAddWins));
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
    if (bonusWins > 0) {
      flippedIds = flippedIds.concat(convertLoseToWin(t2, bonusWins));
    }
    b2 = b2.filter(function(b) { return b.effect !== 'tide_shift'; });
  }

  b2 = applyValueAuraOnPick(b2, picked);
  b2 = maybeFreeCopy(b2, picked);

  return { tiles: t2, boons: b2, nextId: id, grew: grew, flippedIds: flippedIds };
}
