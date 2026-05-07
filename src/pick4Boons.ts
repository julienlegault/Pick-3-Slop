// Pick 4 Slop — boon definitions and shop drawing logic.
// Entirely separate from the Pick 3 boon system.

export type Pick4Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** A card in the deck that represents a drawn boon card. */
export interface BoonDeckCard {
  type: 'boon';
  boonId: string;
  iid: string;
}

/** A single card in the Pick 4 deck (win, lose, or a boon card). */
export type DeckCard = 'win' | 'lose' | BoonDeckCard;

/** Type guard: returns true if a DeckCard is a boon card object. */
export function isBoonDeckCard(c: DeckCard): c is BoonDeckCard {
  return typeof c === 'object' && c.type === 'boon';
}

/** Create a new boon deck card instance for a given boon template id. */
export function makeBoonDeckCard(boonId: string): BoonDeckCard {
  return { type: 'boon', boonId: boonId, iid: makeP4Iid(boonId) };
}

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
  /**
   * When true this boon is a "card boon": purchasing it inserts a card into
   * the deck rather than adding a permanent boon to the boon hand.
   */
  isCardBoon?: boolean;
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

// ── Rarity-scale multipliers by level ────────────────────────────────────────
// Initialized with the same values as Pick 3's RARITY_SCALE (constants.ts).
// Kept as separate named constants so each can be tuned independently.
export const PICK4_COMMON_SCALE:    number[] = [0.9,    0.76,  0.64,  0.53,  0.36 ];
export const PICK4_UNCOMMON_SCALE:  number[] = [0.05,   0.26,  0.62,  1.2,   1.75 ];
export const PICK4_RARE_SCALE:      number[] = [0.001,  0.065, 0.38,  1.12,  2.35 ];
export const PICK4_LEGENDARY_SCALE: number[] = [0.0002, 0.014, 0.15,  0.64,  1.78 ];

export const PICK4_RARITY_SCALE: Record<Pick4Rarity, number[]> = {
  common:    PICK4_COMMON_SCALE,
  uncommon:  PICK4_UNCOMMON_SCALE,
  rare:      PICK4_RARE_SCALE,
  legendary: PICK4_LEGENDARY_SCALE,
};

/** Returns the draw-weight multiplier for a rarity at the given level. */
export function pick4RarityMult(rarity: Pick4Rarity, level: number): number {
  var arr = PICK4_RARITY_SCALE[rarity] || [1];
  return arr[Math.min(Math.max(0, level - 1), arr.length - 1)];
}

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
  // ── Uncommon card boons ───────────────────────────────────────────────
  {
    id: 'p4_card_dave',
    name: 'Dave',
    rarity: 'uncommon',
    w: 4,
    effect: 'card_dave',
    isCardBoon: true,
    desc: 'When drawn: immediately draw two cards and choose one of those whose effects to apply.',
  },
  {
    id: 'p4_card_andrew',
    name: 'Andrew',
    rarity: 'uncommon',
    w: 4,
    effect: 'card_andrew',
    isCardBoon: true,
    desc: 'When drawn: add a random uncommon boon card to your deck.',
  },
  {
    id: 'p4_card_jessica',
    name: 'Jessica',
    rarity: 'uncommon',
    w: 4,
    effect: 'card_jessica',
    isCardBoon: true,
    desc: 'When drawn: shuffle all previously drawn cards back into the deck, then draw a card.',
  },
  // ── Rare card boons ───────────────────────────────────────────────────
  {
    id: 'p4_card_tom',
    name: 'Tom',
    rarity: 'rare',
    w: 2,
    effect: 'card_tom',
    isCardBoon: true,
    desc: 'When drawn: discard the top 5 cards of the deck, then draw a card.',
  },
  {
    id: 'p4_card_marry',
    name: 'Marry',
    rarity: 'rare',
    w: 2,
    effect: 'card_marry',
    isCardBoon: true,
    desc: 'When drawn: gain one shop reroll. Counts as a win.',
  },
  {
    id: 'p4_card_herald',
    name: 'Herald',
    rarity: 'rare',
    w: 2,
    effect: 'card_herald',
    isCardBoon: true,
    desc: 'When drawn: permanently destroy this card and 3 random cards from the deck.',
  },
  // ── Legendary card boons ──────────────────────────────────────────────
  {
    id: 'p4_card_wanda',
    name: 'Wanda',
    rarity: 'legendary',
    w: 1,
    effect: 'card_wanda',
    isCardBoon: true,
    desc: 'When drawn: add two copies of it to your deck, then draw a card.',
  },
  {
    id: 'p4_card_tony',
    name: 'Tony',
    rarity: 'legendary',
    w: 1,
    effect: 'card_tony',
    isCardBoon: true,
    desc: "When drawn: draw a card for each time you've drawn a Tony this game, then choose one of those whose effects to apply.",
  },
  {
    id: 'p4_card_sarah',
    name: 'Sarah',
    rarity: 'legendary',
    w: 1,
    effect: 'card_sarah',
    isCardBoon: true,
    desc: 'While in deck: when you draw a win, add a win to your deck. Sarah counts as a win when drawn.',
  },
  {
    id: 'p4_card_alfred',
    name: 'Alfred',
    rarity: 'legendary',
    w: 1,
    effect: 'card_alfred',
    isCardBoon: true,
    desc: 'While in deck: when you draw a lose, instead win and destroy a win in your deck. Alfred counts as a win when drawn.',
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

/** Build and shuffle a fresh deck. */
export function makePick4Deck(wins: number, loses: number): DeckCard[] {
  var cards: DeckCard[] = [];
  for (var i = 0; i < wins; i++) cards.push('win');
  for (var i = 0; i < loses; i++) cards.push('lose');
  return shuffleArr(cards);
}

/**
 * Draw `count` boon choices from PICK4_BOON_TEMPLATES, weighted by `w` scaled
 * by the level-based rarity multiplier, excluding non-card boon IDs already held.
 * Card boons (isCardBoon: true) can always appear since they live in the deck,
 * not in the held boon list.
 */
export function drawPick4BoonChoices(
  heldBoons: Pick4BoonInstance[],
  count: number,
  level: number
): Pick4BoonTemplate[] {
  var heldIds = new Set(heldBoons.map(function(b) { return b.id; }));
  // Card boons are never in the held list; exclude only regular held boons.
  var available = PICK4_BOON_TEMPLATES.filter(function(b) { return b.isCardBoon || !heldIds.has(b.id); });
  if (available.length === 0) return [];

  var chosen: Pick4BoonTemplate[] = [];
  var pool = available.slice();

  for (var i = 0; i < count && pool.length > 0; i++) {
    var totalW = pool.reduce(function(s, b) { return s + b.w * pick4RarityMult(b.rarity, level); }, 0);
    var r = Math.random() * totalW;
    var acc = 0;
    var idx = pool.length - 1;
    for (var j = 0; j < pool.length; j++) {
      acc += pool[j].w * pick4RarityMult(pool[j].rarity, level);
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
