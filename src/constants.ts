export var CX = 210, CY = 210, R = 175;
export var LAND = 90;
export var RARITY_ORDER = ['common', 'uncommon', 'rare', 'legendary'];
export var RARITY_RANK = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
export var RARITY_SCALE = {
  common:    [0.9, 0.76, 0.64, 0.53, 0.36],
  uncommon:  [0.05, 0.26, 0.62, 1.2, 1.75],
  rare:      [0.001, 0.065, 0.38, 1.12, 2.35],
  legendary: [0.0002, 0.014, 0.15, 0.64, 1.78],
};
export var FLAT_BONUS_STACK_TO_COUNT = 100;
export var FLAT_BONUS_STACK_TO_SIZE = 2;
export var MIN_STACKABLE_COUNT = 1;
export var MIN_ANCHOR_SCALE = 0.08;
// Tolerance for float comparisons when checking if a clamped scale reached its minimum.
export var ANCHOR_SCALE_EPSILON = 1e-9;
export var WIN_AREA_BOON_CAPS = { uncommon: 0.35, rare: 0.60, legendary: 0.90 };
export var WIN_MERGE_BOON_CAPS = { uncommon: 0.10, rare: 0.20, legendary: 0.35 };
export var MIN_LOSE_TILE_MULT = 0.08;
export var COMMON_CATCHUP_MIN_STREAK = 2;
export var COMMON_CATCHUP_PER_EXTRA_NON_COMMON = 0.45;
export var COMMON_CATCHUP_MAX_MULT = 3.0;
// Wheel-growth difficulty curve: grows progressively harder each time.
// Loss ratios: 1/3, 4/9, 1/2, 2/3, 4/5, …, 95% at the 10th growth.
export var WHEEL_GROWTH_MULTIPLIER = 3;
// Win ratios indexed by growthLevel (0 = first growth, 1 = second, …)
export var GROWTH_WIN_RATIOS = [2/3, 5/9, 1/2, 1/3, 1/5];
export var GROWTH_WIN_RATIO_LATE_START_LEVEL = 4;   // growthLevel where late curve begins
export var GROWTH_WIN_RATIO_LATE_END_LEVEL = 9;     // growthLevel of the 10th growth
export var GROWTH_WIN_RATIO_LATE_START = 0.20;      // win ratio at late-start level
export var GROWTH_WIN_RATIO_LATE_END = 0.05;        // win ratio at late-end level (95% loss)
export var MIN_POST_SPIN_LOSE_AREA_RATIO = 0.005;
export var MAX_PERCENTAGE = 0.99;
// At gl >= PROB_DISPLAY_THRESHOLD the wheel is rendered as two probability sectors.
export var PROB_DISPLAY_THRESHOLD = 4;
// At gl >= FULL_PROB_THRESHOLD the internal tile array is replaced by two virtual tiles,
// trading per-tile bookkeeping for a compact win/lose count pair.
export var FULL_PROB_THRESHOLD = 6;
export var RC = { common:'#909090', uncommon:'#4a9eff', rare:'#c060ff', legendary:'#D4AF37' };
export var INIT_TILES = [
  { id:0, type:'win'  }, { id:1, type:'lose' },
  { id:2, type:'win'  }, { id:3, type:'win'  },
  { id:4, type:'lose' }, { id:5, type:'win'  },
];
