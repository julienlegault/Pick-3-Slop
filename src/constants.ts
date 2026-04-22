import type { RarityKey, Tile } from './types';

export const CX = 210;
export const CY = 210;
export const R = 175;
export const LAND = 90;

export const RARITY_ORDER: RarityKey[] = ['common', 'uncommon', 'rare', 'legendary'];
export const RARITY_RANK: Record<RarityKey, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
export const RARITY_SCALE: Record<RarityKey, number[]> = {
  common:    [0.9, 0.76, 0.64, 0.53, 0.36],
  uncommon:  [0.05, 0.26, 0.62, 1.2, 1.75],
  rare:      [0.001, 0.065, 0.38, 1.12, 2.35],
  legendary: [0.0002, 0.014, 0.15, 0.64, 1.78],
};
export const RC: Record<RarityKey, string> = {
  common: '#909090',
  uncommon: '#4a9eff',
  rare: '#c060ff',
  legendary: '#D4AF37',
};

export const FLAT_BONUS_STACK_TO_COUNT = 100;
export const FLAT_BONUS_STACK_TO_SIZE = 2;
export const MIN_STACKABLE_COUNT = 1;
export const MIN_DEAD_ZONE_SIZE = 0.1;
export const MIN_ANCHOR_SCALE = 0.08;
export const ANCHOR_SCALE_EPSILON = 1e-9;
export const MIN_LOSE_TILE_MULT = 0.08;
export const COMMON_CATCHUP_MIN_STREAK = 2;
export const COMMON_CATCHUP_PER_EXTRA_NON_COMMON = 0.45;
export const COMMON_CATCHUP_MAX_MULT = 3.0;
export const WHEEL_GROWTH_MULTIPLIER = 3;
export const EARLY_GROWTH_LEVEL_LIMIT = 3;
export const MID_GROWTH_LEVEL_LIMIT = 5;
export const MID_GROWTH_DECAY_START_LEVEL = MID_GROWTH_LEVEL_LIMIT - 1;
export const EARLY_GROWTH_WIN_RATIO = 2 / 3;
export const MID_GROWTH_WIN_RATIO = 5 / 9;
export const MIN_GROWTH_WIN_RATIO = 1 / 3;
export const GROWTH_WIN_RATIO_STEP = 1 / 18;

export const INIT_TILES: Tile[] = [
  { id: 0, type: 'win' }, { id: 1, type: 'lose' },
  { id: 2, type: 'win' }, { id: 3, type: 'win' },
  { id: 4, type: 'lose' }, { id: 5, type: 'win' },
];
