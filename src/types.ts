export type RarityKey = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface Tile {
  id: number | string;
  type: 'win' | 'lose' | 'dead';
  anchored?: boolean;
  anchorScale?: number;
  mergeBonus?: number;
  temp?: boolean;
  sz?: number;
}

export interface BoonTemplate {
  id: string;
  group: string;
  name: string;
  rarity: RarityKey;
  w: number;
  effect: string;
  desc?: string;
  amount?: number;
  chance?: number;
  cap?: number;
  bonus?: number;
  charges?: number;
  mergeGrow?: number;
  winGrow?: number;
  loseShrink?: number;
  shrinkPerSpin?: number;
  size?: number;
  breakChance?: number;
  randomValue?: boolean;
  oneTimeTrigger?: boolean;
  flatBonus?: number;
  uses?: number;
  lastGrowthUsed?: number;
  targetRarity?: RarityKey;
  valueRanges?: Record<string, Record<string, { min: number; max: number; step?: number; int?: boolean }>>;
  roll?: () => Partial<BoonTemplate>;
}

export interface Boon extends BoonTemplate {
  iid: string;
}

export interface LayoutTile extends Tile {
  sz: number;
}

export interface AngleEntry {
  start: number;
  end: number;
  center: number;
}

export interface SpinData {
  targetDeg: number;
  result: 'win' | 'lose';
  baseType: 'win' | 'lose' | 'dead';
  triggered: string[];
  fb: Boon[];
  nc: number;
  halfSpan: number;
  gl: number;
  shopsSeen: number;
  nonCommonPickStreak: number;
}

export interface DrawResult {
  choices: Boon[];
  boons: Boon[];
}

export interface RescueResult {
  ok: boolean;
  boons: Boon[];
  triggered: string[];
  winBy: string | null;
}

export interface ApplyBoonResult {
  tiles: Tile[];
  boons: Boon[];
  nextId: number;
  grew: boolean;
  flippedIds: (number | string)[];
}

export interface RerollResult {
  ok: boolean;
  choices: Boon[];
  boons: Boon[];
}

export interface RevealTile {
  type: 'win' | 'lose';
  baseType: 'win' | 'lose' | 'dead';
  halfSpan: number;
}
