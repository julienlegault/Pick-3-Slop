import { RARITY_SCALE } from './constants';
import type { RarityKey } from './types';

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
export function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
export function randInt(min: number, max: number): number {
  return Math.floor(randFloat(min, max + 1));
}
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
export function pct(v: number): number {
  return Math.round(v * 100);
}
export function makeIid(id: string): string {
  return id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
export function rarityMult(rarity: RarityKey, gl: number): number {
  const arr = RARITY_SCALE[rarity] || [1];
  return arr[Math.min(gl, arr.length - 1)];
}
export function rarityRange<T>(rarity: RarityKey, map: Record<string, T>): T {
  return map[rarity] || map['rare'];
}
