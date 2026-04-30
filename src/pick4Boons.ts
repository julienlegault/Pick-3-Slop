// Pick 4 Slop — boon definitions and shop drawing logic.
// Entirely separate from the Pick 3 boon system.

export type Pick4Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** A boon template as defined in PICK4_BOON_TEMPLATES. */
export interface Pick4BoonTemplate {
  id: string;
  name: string;
  rarity: Pick4Rarity;
  /** Draw weight used by the shop. */
  w: number;
  effect: string;
  desc: string;
  /** Starting charges for charge-based boons (e.g. Aegis). */
  charges?: number;
}

/** A boon instance held by the player (template + unique instance id + live charges). */
export interface Pick4BoonInstance extends Pick4BoonTemplate {
  /** Per-instance unique id for React keys and de-duplication. */
  iid: string;
}

/** Rarity colours, matching Pick 3's RC palette. */
export const PICK4_RC: Record<Pick4Rarity, string> = {
  common:    '#909090',
  uncommon:  '#4a9eff',
  rare:      '#c060ff',
  legendary: '#D4AF37',
};

var _iidSeq = 0;
export function makeP4Iid(id: string): string {
  return id + '_' + Date.now() + '_' + (++_iidSeq);
}

export const PICK4_BOON_TEMPLATES: Pick4BoonTemplate[] = [
  // ── Common ────────────────────────────────────────────────────────────
  {
    id: 'p4_add_win',
    name: "Fortune's Gift",
    rarity: 'common',
    w: 10,
    effect: 'add_win',
    desc: 'Add a win card to the deck.',
  },
  {
    id: 'p4_remove_lose',
    name: 'Purge',
    rarity: 'common',
    w: 10,
    effect: 'remove_lose',
    desc: 'Remove a lose card from the deck.',
  },
  // ── Uncommon ──────────────────────────────────────────────────────────
  {
    id: 'p4_add_two_wins',
    name: 'Double Fortune',
    rarity: 'uncommon',
    w: 6,
    effect: 'add_two_wins',
    desc: 'Add two win cards to the deck.',
  },
  {
    id: 'p4_turn_lose_to_win',
    name: 'Transmute',
    rarity: 'uncommon',
    w: 6,
    effect: 'turn_lose_to_win',
    desc: 'Turn a lose card into a win card in the deck.',
  },
  {
    id: 'p4_shop_reroll',
    name: 'Market Savvy',
    rarity: 'uncommon',
    w: 6,
    effect: 'shop_reroll',
    desc: 'Gain one shop reroll.',
  },
  // ── Rare ──────────────────────────────────────────────────────────────
  {
    id: 'p4_two_x_reroll',
    name: "Merchant's Favor",
    rarity: 'rare',
    w: 3,
    effect: 'two_x_reroll',
    desc: 'Gain two shop rerolls.',
  },
  {
    id: 'p4_next_lose_win',
    name: 'Aegis',
    rarity: 'rare',
    w: 3,
    effect: 'next_lose_win',
    charges: 1,
    desc: 'The next lose card drawn becomes a win instead. Consumed on use.',
  },
  {
    id: 'p4_discard_top_two',
    name: 'Skip Ahead',
    rarity: 'rare',
    w: 3,
    effect: 'discard_top_two',
    desc: 'Immediately discard the top two cards of the deck. Those cards have no effect.',
  },
  // ── Legendary ─────────────────────────────────────────────────────────
  {
    id: 'p4_draw_2_choose_1',
    name: "Oracle's Vision",
    rarity: 'legendary',
    w: 1,
    effect: 'draw_2_choose_1',
    desc: 'Whenever you draw, draw 2 cards and choose one to have an effect.',
  },
  {
    id: 'p4_reroll_every_shop',
    name: 'Eternal Market',
    rarity: 'legendary',
    w: 1,
    effect: 'reroll_every_shop',
    desc: 'Gain a free reroll at the start of every shop.',
  },
  {
    id: 'p4_shuffle_drawn',
    name: "Time's Reversal",
    rarity: 'legendary',
    w: 1,
    effect: 'shuffle_drawn_back',
    desc: 'Shuffle all cards drawn this game back into the deck.',
  },
  {
    id: 'p4_lose_50_win',
    name: "Luck's Embrace",
    rarity: 'legendary',
    w: 1,
    effect: 'lose_50pct_win',
    desc: "Whenever you draw a lose card, 50% chance for it to become a win instead.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function shuffleArr<T>(arr: T[]): T[] {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/** Build and shuffle a fresh 52-card deck. */
export function makePick4Deck(wins: number, loses: number): ('win' | 'lose')[] {
  var cards: ('win' | 'lose')[] = [];
  for (var i = 0; i < wins; i++) cards.push('win');
  for (var i = 0; i < loses; i++) cards.push('lose');
  return shuffleArr(cards);
}

/**
 * Draw `count` boon choices from PICK4_BOON_TEMPLATES, weighted by `w`,
 * excluding boon IDs already held by the player.
 */
export function drawPick4BoonChoices(
  heldBoons: Pick4BoonInstance[],
  count: number
): Pick4BoonTemplate[] {
  var heldIds = new Set(heldBoons.map(function(b) { return b.id; }));
  var available = PICK4_BOON_TEMPLATES.filter(function(b) { return !heldIds.has(b.id); });
  if (available.length === 0) return [];

  var chosen: Pick4BoonTemplate[] = [];
  var pool = available.slice();

  for (var i = 0; i < count && pool.length > 0; i++) {
    var totalW = pool.reduce(function(s, b) { return s + b.w; }, 0);
    var r = Math.random() * totalW;
    var acc = 0;
    var idx = pool.length - 1;
    for (var j = 0; j < pool.length; j++) {
      acc += pool[j].w;
      if (r < acc) { idx = j; break; }
    }
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return chosen;
}

/** Create a held boon instance from a template. */
export function instantiatePick4Boon(template: Pick4BoonTemplate): Pick4BoonInstance {
  return Object.assign({}, template, { iid: makeP4Iid(template.id) });
}
