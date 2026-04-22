import { CX, CY, R, MIN_LOSE_TILE_MULT, MIN_ANCHOR_SCALE, ANCHOR_SCALE_EPSILON } from './constants';
import { clamp } from './utils';
import { boonNumeric } from './boons/templates';
import type { Tile, Boon, LayoutTile, AngleEntry } from './types';

export function polar(deg: number, r?: number): { x: number; y: number } {
  var rr = r === undefined ? R : r;
  var rad = (deg - 90) * Math.PI / 180;
  return { x: CX + rr * Math.cos(rad), y: CY + rr * Math.sin(rad) };
}

export function slicePath(a1: number, a2: number): string {
  if (a2 - a1 >= 359.99) {
    var p = polar(a1);
    return 'M ' + CX + ',' + CY + ' L ' + p.x + ',' + p.y + ' A ' + R + ',' + R + ' 0 1 1 ' + (p.x - 0.01) + ',' + p.y + ' Z';
  }
  var s = polar(a1), e = polar(a2);
  var lg = a2 - a1 > 180 ? 1 : 0;
  return 'M ' + CX + ',' + CY + ' L ' + s.x + ',' + s.y + ' A ' + R + ',' + R + ' 0 ' + lg + ' 1 ' + e.x + ',' + e.y + ' Z';
}

export function revealWedge(halfSpan: number): string {
  var hs = Math.max(12, Math.min(65, halfSpan));
  var ox = 0, oy = 130, rr = 265;
  function p(d: number) {
    var rad = (d - 90) * Math.PI / 180;
    return { x: ox + rr * Math.cos(rad), y: oy + rr * Math.sin(rad) };
  }
  var s = p(90 - hs), e = p(90 + hs);
  return 'M ' + ox + ',' + oy + ' L ' + s.x + ',' + s.y + ' A ' + rr + ',' + rr + ' 0 0 1 ' + e.x + ',' + e.y + ' Z';
}

export function buildLayout(tiles: Tile[], boons: Boon[], addTemp: boolean): LayoutTile[] {
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

  var result: LayoutTile[] = tiles.map(function(t) {
    var base = t.type === 'win' ? wm : lm;
    if (t.type === 'win') base *= (1 + (t.mergeBonus || 0));
    if (t.type === 'lose' && t.anchored) base *= (t.anchorScale || 1);
    return Object.assign({}, t, { sz: Math.max(0.02, base) }) as LayoutTile;
  });

  for (var j = 0; j < tmp; j++) result.push({ id: '_t' + j, type: 'win', sz: wm, temp: true });
  if (dead > 0) result.push({ id: '_dead', type: 'dead', sz: dead, temp: true });
  return result;
}

export function calcAngles(layout: LayoutTile[]): AngleEntry[] {
  var total = layout.reduce(function(s, t) { return s + t.sz; }, 0);
  var cum = 0;
  return layout.map(function(t) {
    var span = (t.sz / total) * 360;
    var start = cum; cum += span;
    return { start: start, end: cum, center: start + span / 2 };
  });
}

export function pickWeighted(layout: LayoutTile[]): number {
  var tot = layout.reduce(function(s, t) { return s + t.sz; }, 0);
  var r = Math.random() * tot;
  for (var i = 0; i < layout.length; i++) {
    r -= layout[i].sz;
    if (r <= 0) return i;
  }
  return layout.length - 1;
}

export function prepareSpin(tiles: Tile[], boons: Boon[]): { tiles: Tile[]; boons: Boon[] } {
  var t2 = tiles.map(function(t) { return Object.assign({}, t); });
  var b2 = boons.map(function(b) { return Object.assign({}, b); });
  var mergeGrow = 0;
  var anchorShrink = 0;
  b2.forEach(function(b) {
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
    var expiredAnchorTileIdx: number[] = [];
    var anchorBoonIdx: number[] = [];
    for (var j = 0; j < t2.length; j++) {
      if (t2[j].type === 'lose' && t2[j].anchored) {
        var nextScale = clamp((t2[j].anchorScale || 1) * (1 - anchorShrink), MIN_ANCHOR_SCALE, 1);
        t2[j].anchorScale = nextScale;
        if (nextScale <= MIN_ANCHOR_SCALE + ANCHOR_SCALE_EPSILON) {
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
