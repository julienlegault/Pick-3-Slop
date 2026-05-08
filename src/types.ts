// Core domain types shared across the Pick 3 Slop codebase.

/** The four rarity tiers for boons. */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** A single sector on the spinning wheel. */
export interface Tile {
  /** Unique tile identifier.  Negative integers are reserved for virtual tiles. */
  id: number | string;
  /** Whether this sector counts as a win or a loss when landed on. */
  type: 'win' | 'lose';
  /** Present on a lose tile that has been anchored by the anchor_lose boon. */
  anchored?: boolean;
  /** Relative size of an anchored tile (0–1), shrinking each spin until it expires. */
  anchorScale?: number;
  /** Extra size multiplier from the win_merge boon, applied at layout time. */
  mergeBonus?: number;
  /** True for temporary win tiles added by the temp_win boon (not counted toward growth). */
  temp?: boolean;
  /** Computed layout size in arbitrary units; set by buildLayout(), absent on raw tiles. */
  sz?: number;
  /** True when this tile is a virtual-mode entry representing many real tiles. */
  _virt?: boolean;
  /** Number of real tiles this virtual entry stands for (virtual mode only). */
  _count?: number;
}

/**
 * A boon held by the player.
 *
 * Boons are plain objects whose shape varies widely by effect type.
 * The index signature allows arbitrary extra keys carried by specific templates
 * (e.g. rolled numeric values, cap keys, serialisation fields) without losing
 * type-safety on the known properties listed below.
 */
export interface Boon {
  /** Template identifier, e.g. "rescue_independent_rare". */
  id: string;
  /** Per-instance unique id (id + timestamp + random suffix); absent on raw templates. */
  iid?: string;
  /** Group key shared by all rarity variants of the same boon family. */
  group?: string;
  name: string;
  rarity: Rarity;
  /** Relative draw-weight used by the shop when rolling boon offers. */
  w: number;
  /** Mechanical-effect identifier consumed by game-logic modules. */
  effect?: string;
  /** Display description; may be overwritten by descFn when randomValue is true. */
  desc?: string;
  /** True when this boon's primary values are randomized at instantiation time. */
  randomValue?: boolean;
  /** Accumulated flat bonus added to all numeric values of a randomValue boon. */
  flatBonus?: number;
  /** Names of the keys that carry randomized numeric values (used for display/stacking). */
  valueKeys?: string[];
  /** Rolls fresh random values; stripped from the object during serialization. */
  roll?: () => Record<string, unknown>;
  /** Generates a description string from the current effective values; stripped on save. */
  descFn?: (rarity: Rarity, vals: Record<string, number>) => string;
  // ── Common value fields (present depending on the boon effect type) ──────
  amount?: number;
  chance?: number;
  cap?: number;
  charges?: number;
  breakChance?: number;
  winGrow?: number;
  winGrowCap?: number;
  loseShrink?: number;
  mergeGrow?: number;
  mergeGrowCap?: number;
  shrinkPerSpin?: number;
  shrinkPerSpinCap?: number;
  bonus?: number;
  targetRarity?: Rarity;
  uses?: number;
  oneTimeTrigger?: boolean;
  lastGrowthUsed?: number;
  /** True on the synthetic doom entry rendered in the boon stack during endless mode. */
  isDoom?: boolean;
  /** Doom chance shown in the tooltip (0–100), set only on the display entry. */
  doomChancePct?: number;
  /** Allows arbitrary extra keys carried by specific boon templates. */
  [key: string]: unknown;
}

/**
 * Result returned by the rescue system (tryRescue).
 * Describes whether the player survived a would-be loss and which boons fired.
 */
export interface RescueResult {
  /** True when the player was saved from a loss by at least one rescue boon. */
  ok: boolean;
  /** Boon list after any one-time-use boons have been consumed. */
  boons: Boon[];
  /** Instance IDs (iid) of every boon that was checked during this rescue pass. */
  triggered: string[];
  /** Identifies the mechanic that produced the win (e.g. "shield"), or null on a loss. */
  winBy: string | null;
  /** The iid (or token) of the specific boon instance that completed the rescue. */
  savedByIid?: string;
  /** For sacrifice_instead rescues: the boon object that was destroyed. */
  sacrificedBoon?: Boon;
}

/**
 * Result returned by growWheel and related wheel-growth functions.
 * Contains the updated tile array, boon list, and any flip-animation metadata.
 */
export interface GrowthResult {
  tiles: Tile[];
  boons: Boon[];
  /** Next unused integer tile ID so future tiles can be uniquely identified. */
  nextId: number;
  /** IDs of tiles that were flipped to win during this growth step (for animation). */
  flippedIds: Array<number | string>;
}

/**
 * Result returned by applyBoon and enforceMinimumLoseAreaAfterSpin.
 * Extends GrowthResult with a flag indicating whether a wheel growth was triggered.
 */
export interface ApplyBoonResult extends GrowthResult {
  /** True when the wheel had to grow as a result of this operation. */
  grew: boolean;
}

/**
 * Internal snapshot written to spinRef during an active spin.
 * Carries everything needed by advance() / finalizeReveal() to settle the round.
 */
export interface SpinResult {
  /** Target wheel rotation in degrees at the end of the spin animation. */
  targetDeg: number;
  /** Final outcome after rescue boons have been applied. */
  result: 'win' | 'lose';
  /** The tile type that was physically landed on before any rescue checks. */
  baseType: 'win' | 'lose';
  /** iids of rescue boons that were triggered during the spin. */
  triggered: string[];
  /** Final boon list (after one-time boons consumed, plus doomed boons re-appended). */
  fb: Boon[];
  /** Non-null when the post-spin lose-area check forced an immediate wheel growth. */
  postSpinGrowth: (GrowthResult & { grew: boolean }) | null;
  /** Number of boon choices to offer in the shop this round. */
  nc: number;
  /** Half-span of the reveal wedge in degrees. */
  halfSpan: number;
  /** Growth level at spin time. */
  gl: number;
  /** Number of shops seen so far (used for first-shop guarantee logic). */
  shopsSeen: number;
  /** Consecutive non-common boon picks since last common pick (catchup mechanic). */
  nonCommonPickStreak: number;
  /** Whether the game is currently in endless mode. */
  isEndless: boolean;
  /** Endless-mode spin counter at the time of this spin. */
  endlessSpin: number;
  /** Group keys of boons that have been doomed this endless run. */
  doomGroupKeys: string[];
  /** True when a doom boon triggered a forced loss this spin. */
  isDoom: boolean;
  /** Display object for the boon (or stacked group) that rescued the player this spin. */
  savedByBoon?: Boon | null;
  /** For sacrifice_instead rescues: the boon object that was destroyed. */
  sacrificedBoon?: Boon | null;
  /** True when the saving boon itself was consumed by the rescue (e.g. shield depleted, fragile broke). */
  savedBoonConsumed?: boolean;
}
