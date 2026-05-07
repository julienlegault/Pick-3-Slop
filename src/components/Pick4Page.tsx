import { useState, useRef, useEffect } from 'react';
import {
  PICK4_RC, PICK4_BOON_TEMPLATES,
  Pick4BoonTemplate, Pick4BoonInstance,
  BoonDeckCard, DeckCard,
  isBoonDeckCard, makeBoonDeckCard,
  makePick4Deck, drawPick4BoonChoices, instantiatePick4Boon,
} from '../pick4Boons';
import { BoonTag } from './BoonTag';
import { Pick4CollectionModal } from './Pick4CollectionModal';
import {
  loadPick4Collection, savePick4Collection,
  loadPick4RunState, savePick4RunState, clearPick4RunState,
} from '../storage';

const INIT_WIN_CARDS  = 34;
const INIT_LOSE_CARDS = 18;
const SHOP_SIZE       = 4;

interface Pick4PageProps {
  navigateToPick3: () => void;
}

type Phase    = 'idle' | 'drawing' | 'revealed' | 'choose2' | 'choose_card_effect' | 'shop' | 'game_over' | 'eliminated';
type CardType = 'win' | 'lose';
type CardDisplay = 'win' | 'lose' | 'boon';

export function Pick4Page({ navigateToPick3 }: Pick4PageProps) {
  // ── Deck / history ────────────────────────────────────────────────────
  var [deck, setDeck]               = useState<DeckCard[]>(() => makePick4Deck(INIT_WIN_CARDS, INIT_LOSE_CARDS));
  var [drawnHistory, setDrawnHistory] = useState<DeckCard[]>([]);

  // ── Progress ──────────────────────────────────────────────────────────
  var [drawCount, setDrawCount]         = useState(0);
  var [winDrawCount, setWinDrawCount]   = useState(0);
  var [tonyDrawCount, setTonyDrawCount] = useState(0);

  // ── Boons / shop ──────────────────────────────────────────────────────
  var [boons, setBoons]             = useState<Pick4BoonInstance[]>([]);
  var [shopRerolls, setShopRerolls] = useState(0);
  var [shopChoices, setShopChoices] = useState<Pick4BoonTemplate[]>([]);

  // ── Phase / card result ───────────────────────────────────────────────
  var [phase, setPhase]                     = useState<Phase>('idle');
  var [baseCard, setBaseCard]               = useState<CardType | null>(null);
  var [currentCard, setCurrentCard]         = useState<CardDisplay | null>(null);
  var [currentBoonCard, setCurrentBoonCard] = useState<BoonDeckCard | null>(null);
  var [savedAnimActive, setSavedAnimActive] = useState(false);
  var [choose2Cards, setChoose2Cards]       = useState<DeckCard[]>([]);
  var [cardChoices, setCardChoices]         = useState<DeckCard[]>([]);

  // ── Collection ────────────────────────────────────────────────────────
  var [collection, setCollection]         = useState<Set<string>>(() => loadPick4Collection() as Set<string>);
  var [showCollection, setShowCollection] = useState(false);

  // ── UI ────────────────────────────────────────────────────────────────
  var [showMenu, setShowMenu]       = useState(false);
  var [showLevelUp, setShowLevelUp] = useState(false);
  var [showDeckView, setShowDeckView] = useState(false);

  // ── Timer helpers ─────────────────────────────────────────────────────
  var timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  function later(fn: () => void, ms: number) {
    var t = setTimeout(fn, ms);
    timersRef.current.push(t);
  }
  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  // ── Restore saved run state on mount ──────────────────────────────────
  useEffect(function() {
    var saved = loadPick4RunState();
    if (!saved) return;
    try {
      setDeck(saved.deck || makePick4Deck(INIT_WIN_CARDS, INIT_LOSE_CARDS));
      setDrawnHistory(saved.drawnHistory || []);
      setBoons(saved.boons || []);
      setDrawCount(saved.drawCount || 0);
      setWinDrawCount(saved.winDrawCount || 0);
      setShopRerolls(saved.shopRerolls || 0);
      setTonyDrawCount(saved.tonyDrawCount || 0);
    } catch(e) { clearPick4RunState(); }
  }, []);

  // ── Persist run state when idle ────────────────────────────────────────
  useEffect(function() {
    if (phase === 'game_over' || phase === 'eliminated') { clearPick4RunState(); return; }
    if (phase !== 'idle') return;
    try {
      savePick4RunState({
        deck: deck,
        drawnHistory: drawnHistory,
        boons: boons,
        drawCount: drawCount,
        winDrawCount: winDrawCount,
        shopRerolls: shopRerolls,
        tonyDrawCount: tonyDrawCount,
      });
    } catch(e) {}
  }, [deck, drawnHistory, boons, drawCount, winDrawCount, shopRerolls, tonyDrawCount, phase]);

  // ── Derived state ─────────────────────────────────────────────────────
  var deckWins  = deck.filter(function(c) { return c === 'win';  }).length;
  var deckLoses = deck.filter(function(c) { return c === 'lose'; }).length;
  var deckBoons = deck.filter(function(c) { return isBoonDeckCard(c); }) as BoonDeckCard[];
  var level     = Math.floor(winDrawCount / 4) + 1;
  var isSaved   = baseCard === 'lose' && currentCard === 'win';
  var isOverlay = phase === 'choose2' || phase === 'choose_card_effect' || phase === 'shop' || phase === 'game_over' || phase === 'eliminated';
  var seenBoons = PICK4_BOON_TEMPLATES.filter(function(b) { return collection.has(b.id); }).length;
  var totalBoons = PICK4_BOON_TEMPLATES.length;

  // ── Open shop ─────────────────────────────────────────────────────────
  function openShop(curBoons: Pick4BoonInstance[], baseRerolls: number, curLevel: number) {
    var hasEternalMarket = curBoons.some(function(b) { return b.effect === 'reroll_every_shop'; });
    var rerolls = baseRerolls + (hasEternalMarket ? 1 : 0);
    setShopChoices(drawPick4BoonChoices(curBoons, SHOP_SIZE, curLevel));
    setShopRerolls(rerolls);
    setPhase('shop');
  }

  // ── Apply passive draw boon effects ───────────────────────────────────
  // Returns the final card type and updated boon/deck lists after all checks.
  function applyDrawBoons(
    drawnCard: CardType,
    curBoons: Pick4BoonInstance[],
    curDeck: DeckCard[]
  ): { finalCard: CardType; newBoons: Pick4BoonInstance[]; savedBy50: boolean; newDeck: DeckCard[] } {
    var finalCard = drawnCard;
    var newBoons  = curBoons.slice();
    var newDeck   = curDeck.slice();
    var savedBy50 = false;

    // Alfred passive: while Alfred is in deck, lose → win + remove a win from deck
    if (finalCard === 'lose') {
      var alfredInDeck = newDeck.some(function(c) { return isBoonDeckCard(c) && c.boonId === 'p4_card_alfred'; });
      if (alfredInDeck) {
        finalCard = 'win';
        var winIndices: number[] = [];
        for (var ai = 0; ai < newDeck.length; ai++) { if (newDeck[ai] === 'win') winIndices.push(ai); }
        if (winIndices.length > 0) {
          var wIdx = winIndices[Math.floor(Math.random() * winIndices.length)];
          newDeck.splice(wIdx, 1);
        }
      }
    }

    // Aegis (next_lose_win) — consumes a charge
    if (finalCard === 'lose') {
      var aegisIdx = -1;
      for (var i = 0; i < newBoons.length; i++) {
        if (newBoons[i].effect === 'next_lose_win' && (newBoons[i].charges || 0) > 0) {
          aegisIdx = i; break;
        }
      }
      if (aegisIdx >= 0) {
        finalCard = 'win';
        var aegis      = newBoons[aegisIdx];
        var remaining  = (aegis.charges || 1) - 1;
        newBoons.splice(aegisIdx, 1);
        if (remaining > 0) {
          newBoons.splice(aegisIdx, 0, Object.assign({}, aegis, { charges: remaining }));
        }
      }
    }

    // Luck's Embrace (lose_50pct_win) — 50 % chance
    if (finalCard === 'lose') {
      var has50pct = newBoons.some(function(b) { return b.effect === 'lose_50pct_win'; });
      if (has50pct && Math.random() < 0.5) {
        finalCard = 'win';
        savedBy50  = true;
      }
    }

    // Sarah passive: while Sarah is in deck, when a win is drawn, add a win to deck
    if (finalCard === 'win') {
      var sarahInDeck = newDeck.some(function(c) { return isBoonDeckCard(c) && c.boonId === 'p4_card_sarah'; });
      if (sarahInDeck) {
        var sarahPos = Math.floor(Math.random() * (newDeck.length + 1));
        newDeck.splice(sarahPos, 0, 'win');
      }
    }

    return { finalCard: finalCard, newBoons: newBoons, savedBy50: savedBy50, newDeck: newDeck };
  }

  // ── Resolve a single drawn win/lose card and transition phases ─────────
  function resolveCard(
    card: CardType,
    curDeck: DeckCard[],
    curBoons: Pick4BoonInstance[],
    curShopRerolls: number,
    curWinDrawCount: number
  ) {
    var result = applyDrawBoons(card, curBoons, curDeck);
    setBaseCard(card);
    setCurrentCard(result.finalCard);
    setCurrentBoonCard(null);
    setBoons(result.newBoons);
    setDeck(result.newDeck);
    setSavedAnimActive(false);
    setPhase('revealed');

    if (result.finalCard === 'win') {
      var newWinCount = curWinDrawCount + 1;
      setWinDrawCount(newWinCount);
      var newLevel      = Math.floor(newWinCount / 4) + 1;
      var isLevelUp     = newWinCount % 4 === 0;
      var isNowSaved    = card === 'lose';

      if (isLevelUp) {
        setShowLevelUp(true);
        later(function() { setShowLevelUp(false); }, 1500);
        later(function() { openShop(result.newBoons, curShopRerolls, newLevel); }, 1600);
      } else if (isNowSaved) {
        later(function() { setSavedAnimActive(true); }, 700);
        later(function() { openShop(result.newBoons, curShopRerolls, newLevel); }, 1600);
      } else {
        later(function() { openShop(result.newBoons, curShopRerolls, newLevel); }, 500);
      }
    } else {
      // Unprotected lose → game over
      setPhase('eliminated');
    }
  }

  // ── Resolve a win triggered by a card boon (Marry, Sarah, Alfred) ─────
  function resolveAsWin(
    curDeck: DeckCard[],
    curBoons: Pick4BoonInstance[],
    curShopRerolls: number,
    curWinDrawCount: number
  ) {
    // Sarah passive: even a "counts as win" from a boon card triggers Sarah
    var newDeck = curDeck.slice();
    var sarahInDeck = newDeck.some(function(c) { return isBoonDeckCard(c) && c.boonId === 'p4_card_sarah'; });
    if (sarahInDeck) {
      var sarahPos = Math.floor(Math.random() * (newDeck.length + 1));
      newDeck.splice(sarahPos, 0, 'win');
      setDeck(newDeck);
    }

    setCurrentCard('win');
    setCurrentBoonCard(null);
    setPhase('revealed');

    var newWinCount = curWinDrawCount + 1;
    setWinDrawCount(newWinCount);
    var newLevel  = Math.floor(newWinCount / 4) + 1;
    var isLevelUp = newWinCount % 4 === 0;

    if (isLevelUp) {
      setShowLevelUp(true);
      later(function() { setShowLevelUp(false); }, 1500);
      later(function() { openShop(curBoons, curShopRerolls, newLevel); }, 1600);
    } else {
      later(function() { openShop(curBoons, curShopRerolls, newLevel); }, 500);
    }
  }

  // ── Dispatch: resolve a generic DeckCard (win/lose/boon) ──────────────
  function resolveDrawn(
    card: DeckCard,
    curDeck: DeckCard[],
    curBoons: Pick4BoonInstance[],
    curShopRerolls: number,
    curWinDrawCount: number,
    curDrawnHistory: DeckCard[],
    curTonyDrawCount: number
  ) {
    if (isBoonDeckCard(card)) {
      setCurrentBoonCard(card);
      setCurrentCard('boon');
      resolveBoonCard(card, curDeck, curBoons, curShopRerolls, curWinDrawCount, curDrawnHistory, curTonyDrawCount);
    } else {
      resolveCard(card, curDeck, curBoons, curShopRerolls, curWinDrawCount);
    }
  }

  // ── Resolve a card boon that was drawn ────────────────────────────────
  function resolveBoonCard(
    boonCard: BoonDeckCard,
    curDeck: DeckCard[],
    curBoons: Pick4BoonInstance[],
    curShopRerolls: number,
    curWinDrawCount: number,
    curDrawnHistory: DeckCard[],
    curTonyDrawCount: number
  ) {
    var newDeck = curDeck.slice();
    var boonId  = boonCard.boonId;

    function shuffleInPlace(arr: DeckCard[]) {
      for (var si = arr.length - 1; si > 0; si--) {
        var sj = Math.floor(Math.random() * (si + 1));
        var st = arr[si]; arr[si] = arr[sj]; arr[sj] = st;
      }
    }

    function addToCollection(id: string) {
      setCollection(function(prev) {
        var next = new Set(prev); next.add(id); savePick4Collection(next); return next;
      });
    }

    switch (boonId) {
      case 'p4_card_dave': {
        // Draw 2 cards, choose 1 effect
        var daveChoices: DeckCard[] = [];
        if (newDeck.length > 0) daveChoices.push(newDeck.pop()!);
        if (newDeck.length > 0) daveChoices.push(newDeck.pop()!);
        setDeck(newDeck);
        if (daveChoices.length === 0) {
          setPhase('idle');
        } else if (daveChoices.length === 1) {
          resolveDrawn(daveChoices[0], newDeck, curBoons, curShopRerolls, curWinDrawCount, curDrawnHistory, curTonyDrawCount);
        } else {
          setCardChoices(daveChoices);
          setPhase('choose_card_effect');
        }
        break;
      }
      case 'p4_card_andrew': {
        // Add a random uncommon card boon to the deck
        var uncommonCards = PICK4_BOON_TEMPLATES.filter(function(b) { return b.isCardBoon && b.rarity === 'uncommon'; });
        if (uncommonCards.length > 0) {
          var picked = uncommonCards[Math.floor(Math.random() * uncommonCards.length)];
          var aPos = Math.floor(Math.random() * (newDeck.length + 1));
          newDeck.splice(aPos, 0, makeBoonDeckCard(picked.id));
          addToCollection(picked.id);
        }
        setDeck(newDeck);
        setPhase('idle');
        break;
      }
      case 'p4_card_jessica': {
        // Shuffle all drawn cards back into deck, then draw a card
        var toReshuffle = curDrawnHistory.slice();
        var combined = newDeck.concat(toReshuffle);
        shuffleInPlace(combined);
        setDrawnHistory([]);
        if (combined.length === 0) {
          setDeck([]);
          setPhase('game_over');
          return;
        }
        var jessCard = combined.pop()!;
        var afterJess = combined.slice();
        setDeck(afterJess);
        setDrawnHistory([jessCard]);
        resolveDrawn(jessCard, afterJess, curBoons, curShopRerolls, curWinDrawCount, [jessCard], curTonyDrawCount);
        break;
      }
      case 'p4_card_tom': {
        // Discard top 5 cards, then draw a card
        for (var ti = 0; ti < 5 && newDeck.length > 0; ti++) newDeck.pop();
        if (newDeck.length === 0) {
          setDeck([]);
          setPhase('game_over');
          return;
        }
        var tomCard = newDeck.pop()!;
        setDeck(newDeck);
        setDrawnHistory(function(h) { return h.concat(tomCard); });
        resolveDrawn(tomCard, newDeck, curBoons, curShopRerolls, curWinDrawCount, curDrawnHistory.concat(tomCard), curTonyDrawCount);
        break;
      }
      case 'p4_card_marry': {
        // Gain 1 shop reroll; counts as a win
        var newRerolls = curShopRerolls + 1;
        setShopRerolls(newRerolls);
        resolveAsWin(newDeck, curBoons, newRerolls, curWinDrawCount);
        break;
      }
      case 'p4_card_herald': {
        // Destroy this card + 3 random cards from deck
        for (var hi = 0; hi < 3 && newDeck.length > 0; hi++) {
          var hIdx = Math.floor(Math.random() * newDeck.length);
          newDeck.splice(hIdx, 1);
        }
        setDeck(newDeck);
        setPhase('idle');
        break;
      }
      case 'p4_card_wanda': {
        // Add two copies of Wanda to deck, then draw a card
        var wPos1 = Math.floor(Math.random() * (newDeck.length + 1));
        newDeck.splice(wPos1, 0, makeBoonDeckCard('p4_card_wanda'));
        var wPos2 = Math.floor(Math.random() * (newDeck.length + 1));
        newDeck.splice(wPos2, 0, makeBoonDeckCard('p4_card_wanda'));
        addToCollection('p4_card_wanda');
        if (newDeck.length === 0) {
          setDeck([]);
          setPhase('game_over');
          return;
        }
        var wandaCard = newDeck.pop()!;
        setDeck(newDeck);
        setDrawnHistory(function(h) { return h.concat(wandaCard); });
        resolveDrawn(wandaCard, newDeck, curBoons, curShopRerolls, curWinDrawCount, curDrawnHistory.concat(wandaCard), curTonyDrawCount);
        break;
      }
      case 'p4_card_tony': {
        // Draw N cards (N = draws so far + 1), then choose 1 effect
        var newTonyCount = curTonyDrawCount + 1;
        setTonyDrawCount(newTonyCount);
        var tonyChoices: DeckCard[] = [];
        for (var ti2 = 0; ti2 < newTonyCount && newDeck.length > 0; ti2++) {
          tonyChoices.push(newDeck.pop()!);
        }
        setDeck(newDeck);
        if (tonyChoices.length === 0) {
          setPhase('idle');
        } else if (tonyChoices.length === 1) {
          resolveDrawn(tonyChoices[0], newDeck, curBoons, curShopRerolls, curWinDrawCount, curDrawnHistory, newTonyCount);
        } else {
          setCardChoices(tonyChoices);
          setPhase('choose_card_effect');
        }
        break;
      }
      case 'p4_card_sarah':
      case 'p4_card_alfred': {
        // Counts as a win when drawn
        resolveAsWin(newDeck, curBoons, curShopRerolls, curWinDrawCount);
        break;
      }
      default: {
        setPhase('idle');
      }
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────
  function handleDraw() {
    if (phase !== 'idle') return;
    if (deck.length === 0) { setPhase('game_over'); return; }

    clearTimers();
    setSavedAnimActive(false);
    setDrawCount(function(c) { return c + 1; });
    setPhase('drawing');
    setCurrentBoonCard(null);

    // Capture current state for use inside the timeout closures
    var curDeck          = deck;
    var curBoons         = boons;
    var curShopRerolls   = shopRerolls;
    var curDrawnHistory  = drawnHistory;
    var curWinDrawCount  = winDrawCount;
    var curTonyDrawCount = tonyDrawCount;

    var hasOracle = curBoons.some(function(b) { return b.effect === 'draw_2_choose_1'; });

    if (hasOracle && curDeck.length >= 2) {
      // Oracle's Vision: draw 2 cards and let the player choose one
      var newDeck = curDeck.slice();
      var card1   = newDeck.pop()!;
      var card2   = newDeck.pop()!;
      setDeck(newDeck);
      // Drawn history updated when player makes their choice
      later(function() {
        setChoose2Cards([card1, card2]);
        setPhase('choose2');
      }, 950);
    } else {
      // Normal single draw
      var newDeck2    = curDeck.slice();
      var drawnCard   = newDeck2.pop()!;
      setDeck(newDeck2);
      setDrawnHistory(curDrawnHistory.concat(drawnCard));
      // Pre-set the card face so it is visible as the flip animation completes
      if (isBoonDeckCard(drawnCard)) {
        setCurrentBoonCard(drawnCard);
        setCurrentCard('boon');
      } else {
        setCurrentCard(drawnCard);
      }
      later(function() {
        if (isBoonDeckCard(drawnCard)) {
          resolveBoonCard(drawnCard, newDeck2, curBoons, curShopRerolls, curWinDrawCount, curDrawnHistory.concat(drawnCard), curTonyDrawCount);
        } else {
          resolveCard(drawnCard, newDeck2, curBoons, curShopRerolls, curWinDrawCount);
        }
      }, 950);
    }
  }

  // ── Oracle's Vision: player picks one of two cards ────────────────────
  function handleChoose2(idx: number) {
    if (choose2Cards.length === 0 || phase !== 'choose2') return;
    var chosen = choose2Cards[idx];
    var newHistory = drawnHistory.concat(chosen);
    setDrawnHistory(newHistory);
    setChoose2Cards([]);
    if (isBoonDeckCard(chosen)) {
      setCurrentBoonCard(chosen);
      setCurrentCard('boon');
      resolveBoonCard(chosen, deck, boons, shopRerolls, winDrawCount, newHistory, tonyDrawCount);
    } else {
      setCurrentCard(chosen);
      resolveCard(chosen, deck, boons, shopRerolls, winDrawCount);
    }
  }

  // ── Dave / Tony: player picks one of N drawn cards ────────────────────
  function handleChooseCardEffect(idx: number) {
    if (cardChoices.length === 0 || phase !== 'choose_card_effect') return;
    var chosen = cardChoices[idx];
    setCardChoices([]);
    var newHistory = drawnHistory.concat(chosen);
    setDrawnHistory(newHistory);
    if (isBoonDeckCard(chosen)) {
      setCurrentBoonCard(chosen);
      setCurrentCard('boon');
      resolveBoonCard(chosen, deck, boons, shopRerolls, winDrawCount, newHistory, tonyDrawCount);
    } else {
      setCurrentCard(chosen);
      resolveCard(chosen, deck, boons, shopRerolls, winDrawCount);
    }
  }

  // ── Reroll the shop ───────────────────────────────────────────────────
  function rerollShop() {
    if (shopRerolls <= 0) return;
    setShopRerolls(function(r) { return r - 1; });
    setShopChoices(drawPick4BoonChoices(boons, SHOP_SIZE, level));
  }
  function pickBoon(boon: Pick4BoonTemplate) {
    // ── Card boons go into the deck, not the boon hand ──────────────────
    if (boon.isCardBoon) {
      var cbDeck = deck.slice();
      var cbPos  = Math.floor(Math.random() * (cbDeck.length + 1));
      cbDeck.splice(cbPos, 0, makeBoonDeckCard(boon.id));
      setDeck(cbDeck);
      setShopChoices([]);
      setCollection(function(prev) {
        var next = new Set(prev); next.add(boon.id); savePick4Collection(next); return next;
      });
      setPhase('idle');
      return;
    }

    var newDeck    = deck.slice();
    var newHistory = drawnHistory.slice();
    var newRerolls = shopRerolls;

    switch (boon.effect) {
      case 'add_win': {
        var pos = Math.floor(Math.random() * (newDeck.length + 1));
        newDeck.splice(pos, 0, 'win');
        break;
      }
      case 'remove_lose': {
        var loseIs: number[] = [];
        for (var i = 0; i < newDeck.length; i++) { if (newDeck[i] === 'lose') loseIs.push(i); }
        if (loseIs.length > 0) newDeck.splice(loseIs[Math.floor(Math.random() * loseIs.length)], 1);
        break;
      }
      case 'add_two_wins': {
        for (var k = 0; k < 2; k++) {
          var p = Math.floor(Math.random() * (newDeck.length + 1));
          newDeck.splice(p, 0, 'win');
        }
        break;
      }
      case 'turn_lose_to_win': {
        var loseIs2: number[] = [];
        for (var j = 0; j < newDeck.length; j++) { if (newDeck[j] === 'lose') loseIs2.push(j); }
        if (loseIs2.length > 0) newDeck[loseIs2[Math.floor(Math.random() * loseIs2.length)]] = 'win';
        break;
      }
      case 'shop_reroll': {
        newRerolls += 1;
        break;
      }
      case 'two_x_reroll': {
        newRerolls += 2;
        break;
      }
      case 'discard_top_two': {
        if (newDeck.length > 0) newDeck.pop();
        if (newDeck.length > 0) newDeck.pop();
        break;
      }
      case 'shuffle_drawn_back': {
        var toShuffle = newHistory.slice();
        newHistory = [];
        for (var m = 0; m < toShuffle.length; m++) {
          var sp = Math.floor(Math.random() * (newDeck.length + 1));
          newDeck.splice(sp, 0, toShuffle[m]);
        }
        break;
      }
      // Passive boons (draw_2_choose_1, reroll_every_shop, next_lose_win, lose_50pct_win):
      // no immediate deck/history change; instance is added to held list below.
    }

    // Add boon to held list (excludes it from future shop offers)
    var instance = instantiatePick4Boon(boon);
    setBoons(function(prev) { return prev.concat(instance); });
    setDeck(newDeck);
    setDrawnHistory(newHistory);
    setShopRerolls(newRerolls);
    setShopChoices([]);
    setCollection(function(prev) {
      var next = new Set(prev);
      next.add(boon.id);
      savePick4Collection(next);
      return next;
    });
    setPhase('idle');
  }

  // ── Restart ───────────────────────────────────────────────────────────
  function handleRestart() {
    clearTimers();
    clearPick4RunState();
    setDeck(makePick4Deck(INIT_WIN_CARDS, INIT_LOSE_CARDS));
    setDrawnHistory([]);
    setBoons([]);
    setDrawCount(0);
    setWinDrawCount(0);
    setTonyDrawCount(0);
    setShopRerolls(0);
    setPhase('idle');
    setBaseCard(null);
    setCurrentCard(null);
    setCurrentBoonCard(null);
    setSavedAnimActive(false);
    setChoose2Cards([]);
    setCardChoices([]);
    setShopChoices([]);
    setShowLevelUp(false);
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="pick4-root">
      <button
        className="btn-menu"
        onClick={function(e) { e.stopPropagation(); setShowMenu(true); }}
        aria-label="Open menu"
      >
        &#8801;
      </button>

      {showMenu && (
        <div className="menu-overlay" onClick={function(e) { e.stopPropagation(); setShowMenu(false); }}>
          <div className="menu-panel" onClick={function(e) { e.stopPropagation(); }}>
            <div className="menu-title">MENU</div>
            <button className="menu-btn menu-btn-pick3" onClick={function(e) { e.stopPropagation(); navigateToPick3(); }}>
              ← PICK 3 SLOP
            </button>
            <button
              className="menu-btn menu-btn-collection"
              onClick={function(e) { e.stopPropagation(); setShowMenu(false); setShowCollection(true); }}
            >
              COLLECTION ({seenBoons}/{totalBoons})
            </button>
            <button className="menu-btn-close" onClick={function(e) { e.stopPropagation(); setShowMenu(false); }}>
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* ── Main content (blurs behind overlays) ── */}
      <div className={'pick4-main' + (isOverlay ? ' blurred' : '')}>
        <div className="pick4-header">
          <h1 className="pick4-title">
            PICK&nbsp;
            <span className="pick4-three">3</span>
            <span className="pick4-four">4</span>
            &nbsp;SLOP
          </h1>
          <div className="pick4-subtitle">
            DRAW {drawCount}
            &nbsp;|&nbsp;
            {deckWins} WIN / {deckLoses} LOSE
            &nbsp;|&nbsp;
            LVL {level}
          </div>
        </div>

        <div className="pick4-arena">
          {/* Deck of stacked face-down cards */}
          <div className="pick4-deck">
            <div className="pick4-deck-card pick4-deck-card--back" />
            <div className="pick4-deck-card pick4-deck-card--mid"  />
            <div className="pick4-deck-card pick4-deck-card--top"  />
          </div>

          {/* Empty slot / drawn card */}
          <div className="pick4-slot">
            {(phase === 'idle' || phase === 'choose2' || phase === 'choose_card_effect') && <div className="pick4-slot-empty" />}

            {phase !== 'idle' && phase !== 'choose2' && phase !== 'choose_card_effect' && (
              <div className={'pick4-card-wrapper' + (phase === 'drawing' ? ' pick4-card-flying' : '')}>
                {(function() {
                  var showSaved = isSaved && savedAnimActive;
                  var boonTemplate = currentBoonCard
                    ? PICK4_BOON_TEMPLATES.find(function(b) { return b.id === currentBoonCard.boonId; })
                    : null;
                  var cardClass: string;
                  var cardText: string;
                  if (boonTemplate) {
                    cardClass = 'pick4-card-boon pick4-card-boon-' + boonTemplate.rarity;
                    cardText  = boonTemplate.name;
                  } else {
                    cardClass = currentCard === 'win' && !isSaved ? 'pick4-card-win' : 'pick4-card-lose';
                    cardText  = showSaved ? 'SAVED!' : (isSaved ? 'LOSE' : (currentCard === 'win' ? 'WIN' : 'LOSE'));
                  }
                  return (
                    <div className={
                      'pick4-card-inner'
                      + (phase === 'drawing' ? ' pick4-card-flipping' : '')
                      + (phase !== 'drawing' ? ' pick4-card-flipped'  : '')
                    }>
                      <div className="pick4-card-face pick4-card-back" />
                      <div className={'pick4-card-face pick4-card-front ' + cardClass}>
                        {cardText}
                      </div>
                    </div>
                  );
                })()}
                {/* Saved animation overlay */}
                {isSaved && savedAnimActive && (
                  <div className="pick4-saved-overlay">
                    <span style={{ animation: 'rescueTextFade .3s ease' }}>SAVED!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Draw button */}
        {phase === 'idle' && (
          <button className="pick4-draw-btn" onClick={handleDraw}>DRAW</button>
        )}

        {/* View Deck button */}
        <button
          className="pick4-view-deck-btn"
          onClick={function(e) { e.stopPropagation(); setShowDeckView(true); }}
        >
          VIEW DECK ({deckWins + deckLoses + deckBoons.length})
        </button>

        {/* Boon stack (held boons only — card boons live in the deck) */}
        {boons.length > 0 && (
          <div className="pick4-boon-stack">
            <div className="pick4-boon-stack-items">
              {boons.map(function(b) {
                return <BoonTag key={b.iid} b={b} />;
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Oracle's Vision: choose 2 overlay ── */}
      {phase === 'choose2' && choose2Cards.length > 0 && (
        <div className="game-overlay" onClick={function(e) { e.stopPropagation(); }}>
          <div className="shop-panel">
            <div className="shop-label">CHOOSE A CARD</div>
            <div className="pick4-choose2-cards">
              {choose2Cards.map(function(card, i) {
                var isBC = isBoonDeckCard(card);
                var bc   = isBC ? card as BoonDeckCard : null;
                var tpl  = bc ? PICK4_BOON_TEMPLATES.find(function(b) { return b.id === bc!.boonId; }) : null;
                var cardClass = isBC
                  ? ('pick4-choose2-card pick4-card-front pick4-card-boon pick4-card-boon-' + (tpl ? tpl.rarity : 'common'))
                  : ('pick4-choose2-card pick4-card-front ' + (card === 'win' ? 'pick4-card-win' : 'pick4-card-lose'));
                var label = isBC ? (tpl ? tpl.name : 'BOON') : (card === 'win' ? 'WIN' : 'LOSE');
                return (
                  <div
                    key={i}
                    className={cardClass}
                    onClick={function() { handleChoose2(i); }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Dave / Tony: choose card effect overlay ── */}
      {phase === 'choose_card_effect' && cardChoices.length > 0 && (
        <div className="game-overlay" onClick={function(e) { e.stopPropagation(); }}>
          <div className="shop-panel">
            <div className="shop-label">CHOOSE AN EFFECT</div>
            <div className="pick4-choose2-cards">
              {cardChoices.map(function(card, i) {
                var isBC = isBoonDeckCard(card);
                var bc   = isBC ? card as BoonDeckCard : null;
                var tpl  = bc ? PICK4_BOON_TEMPLATES.find(function(b) { return b.id === bc!.boonId; }) : null;
                var cardClass = isBC
                  ? ('pick4-choose2-card pick4-card-front pick4-card-boon pick4-card-boon-' + (tpl ? tpl.rarity : 'common'))
                  : ('pick4-choose2-card pick4-card-front ' + (card === 'win' ? 'pick4-card-win' : 'pick4-card-lose'));
                var label = isBC ? (tpl ? tpl.name : 'BOON') : (card === 'win' ? 'WIN' : 'LOSE');
                return (
                  <div
                    key={i}
                    className={cardClass}
                    onClick={function() { handleChooseCardEffect(i); }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Shop overlay ── */}
      {phase === 'shop' && (
        <div className="game-overlay" onClick={function(e) { e.stopPropagation(); }}>
          <div className="shop-panel">
            <div className="shop-label">CHOOSE A BOON</div>
            <div className="reroll-row">
              <button
                className="btn-reroll"
                disabled={shopRerolls <= 0}
                onClick={function(e) { e.stopPropagation(); rerollShop(); }}
                style={{
                  border: '1px solid ' + (shopRerolls > 0 ? '#D4AF37' : '#444'),
                  color: shopRerolls > 0 ? '#D4AF37' : '#888',
                  cursor: shopRerolls > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                REROLL SHOP ({shopRerolls})
              </button>
            </div>
            <div className="boon-choices">
              {shopChoices.map(function(b) {
                var c = PICK4_RC[b.rarity];
                return (
                  <div
                    key={b.id}
                    className="boon-card"
                    onClick={function(e) { e.stopPropagation(); pickBoon(b); }}
                    style={{
                      border: '2px solid ' + c,
                      background: c + '12',
                      boxShadow: '0 0 10px ' + c + '28',
                    }}
                    onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 0 24px ' + c + '58'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.boxShadow = '0 0 10px ' + c + '28'; }}
                  >
                    <div className="boon-card-rarity" style={{ color: c }}>{b.rarity}</div>
                    <div className="boon-card-name">{b.name}</div>
                    <div className="boon-card-desc">{b.desc}</div>
                    {b.isCardBoon && <div className="boon-card-deck-badge">CARD &mdash; GOES IN DECK</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Eliminated overlay (drew a lose card) ── */}
      {phase === 'eliminated' && (
        <div className="game-overlay" onClick={function(e) { e.stopPropagation(); }}>
          <div className="game-over-panel">
            <div className="eliminated-text">ELIMINATED</div>
            <div className="spins-survived">{winDrawCount} WINS / {drawCount} DRAWS</div>
            {boons.length > 0 && (
              <div className="final-boons">
                <div className="final-boons-label">FINAL BOON STACK</div>
                <div className="final-boons-items">
                  {boons.map(function(b) { return <BoonTag key={b.iid} b={b} large={true} />; })}
                </div>
              </div>
            )}
            <button className="btn-view-collection" onClick={function(e) { e.stopPropagation(); setShowCollection(true); }}>
              COLLECTION
            </button>
            <button className="again-btn" style={{ marginTop: '10px' }} onClick={function(e) { e.stopPropagation(); handleRestart(); }}>
              START OVER
            </button>
          </div>
        </div>
      )}

      {/* ── Deck exhausted overlay ── */}
      {phase === 'game_over' && (
        <div className="game-overlay" onClick={function(e) { e.stopPropagation(); }}>
          <div className="game-over-panel">
            <div className="victory-title">DECK EXHAUSTED</div>
            <div className="spins-survived">{winDrawCount} WINS / {drawCount} DRAWS</div>
            {boons.length > 0 && (
              <div className="final-boons">
                <div className="final-boons-label">YOUR BOONS</div>
                <div className="final-boons-items">
                  {boons.map(function(b) { return <BoonTag key={b.iid} b={b} large={true} />; })}
                </div>
              </div>
            )}
            <button className="again-btn" onClick={function(e) { e.stopPropagation(); handleRestart(); }}>
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* ── Level Up banner ── */}
      {showLevelUp && (
        <div className="growing-overlay">
          <div className="growing-text">LEVEL UP</div>
        </div>
      )}

      {/* ── View Deck modal ── */}
      {showDeckView && (
        <div className="menu-overlay" onClick={function(e) { e.stopPropagation(); setShowDeckView(false); }}>
          <div className="pick4-deck-view-panel" onClick={function(e) { e.stopPropagation(); }}>
            <div className="pick4-deck-view-title">DECK CONTENTS</div>
            <div className="pick4-deck-view-grid">
              {deckWins > 0 && (
                <div className="pick4-deck-view-card pick4-deck-view-win">
                  <span className="pick4-deck-view-count">&times;{deckWins}</span>
                  <span className="pick4-deck-view-label">WIN</span>
                </div>
              )}
              {deckLoses > 0 && (
                <div className="pick4-deck-view-card pick4-deck-view-lose">
                  <span className="pick4-deck-view-count">&times;{deckLoses}</span>
                  <span className="pick4-deck-view-label">LOSE</span>
                </div>
              )}
              {deckBoons.map(function(bc) {
                var tpl = PICK4_BOON_TEMPLATES.find(function(b) { return b.id === bc.boonId; });
                var rarity = tpl ? tpl.rarity : 'common';
                return (
                  <div
                    key={bc.iid}
                    className={'pick4-deck-view-card pick4-deck-view-boon pick4-deck-view-boon-' + rarity}
                  >
                    <span className="pick4-deck-view-rarity">{rarity}</span>
                    <span className="pick4-deck-view-label">{tpl ? tpl.name : bc.boonId}</span>
                  </div>
                );
              })}
              {deckWins === 0 && deckLoses === 0 && deckBoons.length === 0 && (
                <div className="pick4-deck-view-empty">Deck is empty</div>
              )}
            </div>
            <button className="menu-btn-close" onClick={function(e) { e.stopPropagation(); setShowDeckView(false); }}>
              CLOSE
            </button>
          </div>
        </div>
      )}

      <Pick4CollectionModal
        showCollection={showCollection}
        collection={collection}
        seenBoons={seenBoons}
        totalBoons={totalBoons}
        setShowCollection={setShowCollection}
      />
    </div>
  );
}
