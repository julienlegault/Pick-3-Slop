// Barrel re-export — provides a single import surface for all game-logic modules.
// The window.Pick3Logic global is not used here; consumers import directly from this file.

export {
  CX, CY, R, LAND,
  RARITY_ORDER, RARITY_RANK, RARITY_SCALE,
  RC, INIT_TILES,
  PROB_DISPLAY_THRESHOLD, FULL_PROB_THRESHOLD,
  WIN_AREA_BOON_CAPS, WIN_MERGE_BOON_CAPS,
} from './constants';

export { rarityMult } from './utils';

export { BOONS, TOTAL_W, TEMPLATE_MAP, getTemplateRangeDesc } from './boons/templates';

export {
  makeIid, cloneBoon, instantiateTemplate,
  boonNumeric, getEffectiveDesc, getStackedDesc,
} from './boons/helpers';

export {
  isVirtWheel, virtGetCount, virtTotalCount, makeVirtWheel,
  polar, slicePath, revealWedge,
  prepareSpin, buildLayout, calcAngles, pickWeighted,
} from './wheel';

export { tryRescue, consumeProtected } from './rescue';

export {
  drawBoons, computeRarityWeights,
  getShopRerolls, rerollShop, consumeNextShopFlags,
} from './shop';

export {
  applyBoon, growWheel, buildGrowthTiles,
  convertLoseToWin, applyValueAuraOnPick, maybeFreeCopy,
  enforceMinimumLoseAreaAfterSpin,
} from './applyBoon';

export { calcBoonDoomChance, calcGroupDoomChance, findLoseIndex } from './doom';
