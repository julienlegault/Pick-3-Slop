import { RARITY_SCALE } from './constants.js';

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function randFloat(min, max) { return min + Math.random() * (max - min); }
export function randInt(min, max) { return Math.floor(randFloat(min, max + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function pct(v) { return Math.round(v * 100); }
export function rarityMult(rarity, gl) {
  var arr = RARITY_SCALE[rarity] || [1];
  return arr[Math.min(gl, arr.length - 1)];
}
export function rarityRange(rarity, map) {
  return map[rarity] || map.rare;
}
