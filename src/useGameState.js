import { useState, useRef, useCallback, useEffect } from 'react';
import {
  INIT_TILES, LAND, PROB_DISPLAY_THRESHOLD,
  prepareSpin, buildLayout, calcAngles, pickWeighted, findLoseIndex,
  calcGroupDoomChance,
  drawBoons, getShopRerolls, rerollShop,
  tryRescue, enforceMinimumLoseAreaAfterSpin,
  applyBoon,
  getStackedDesc,
} from './logic.js';
import {
  loadRunState, saveRunState, clearRunState,
  loadCollection, saveCollection,
  serializeBoon, deserializeBoon,
} from './storage.js';

var NO_TRACK = (new URLSearchParams(window.location.search)).has('notrack');

var SHAKE_INTERVAL_MS     = 120;
var SHAKE_CLEAR_DELAY_MS  = 140;
var SPIN_INTERACT_GUARD_MS = 80;

export function useGameState() {
  var _s1  = useState(INIT_TILES); var tiles = _s1[0]; var setTiles = _s1[1];
  var _s2  = useState([]);         var boons = _s2[0]; var setBoons = _s2[1];
  var _s3  = useState(0);          var sc    = _s3[0]; var setSc    = _s3[1];
  var _s4  = useState(0);          var gl    = _s4[0]; var setGl    = _s4[1];
  var _s5  = useState('idle');     var phase = _s5[0]; var setPhase = _s5[1];
  var _s6  = useState(0);          var wdeg  = _s6[0]; var setWdeg  = _s6[1];
  var _s7  = useState(false);      var anim  = _s7[0]; var setAnim  = _s7[1];
  var _s8  = useState(null);       var rtile = _s8[0]; var setRtile = _s8[1];
  var _s9  = useState([]);         var choices = _s9[0]; var setChoices = _s9[1];
  var _s10 = useState(6);          var nid   = _s10[0]; var setNid   = _s10[1];
  var _s11 = useState(0);          var shopsSeen = _s11[0]; var setShopsSeen = _s11[1];
  var _s12 = useState([]);         var flippedTiles = _s12[0]; var setFlippedTiles = _s12[1];
  var _s13 = useState(null);       var shakingBoon = _s13[0]; var setShakingBoon = _s13[1];
  var _s14 = useState(false);      var revealFlip = _s14[0]; var setRevealFlip = _s14[1];
  var _s15 = useState(null);       var dragIid = _s15[0]; var setDragIid = _s15[1];
  var _s16 = useState(null);       var dragOverIid = _s16[0]; var setDragOverIid = _s16[1];
  var _s17 = useState(0);          var nonCommonPickStreak = _s17[0]; var setNonCommonPickStreak = _s17[1];
  var _s18 = useState(loadCollection); var collection = _s18[0]; var setCollection = _s18[1];
  var _s19 = useState(false);      var showCollection = _s19[0]; var setShowCollection = _s19[1];
  var _s20 = useState(false);      var showMenu = _s20[0]; var setShowMenu = _s20[1];
  // Endless mode state
  var _s21 = useState(false);      var isEndless = _s21[0]; var setIsEndless = _s21[1];
  var _s22 = useState(0);          var endlessSpin = _s22[0]; var setEndlessSpin = _s22[1];
  var _s23 = useState([]);         var doomGroupKeys = _s23[0]; var setDoomGroupKeys = _s23[1];
  var _s24 = useState(loadCollection); var collectionAtRunStart = _s24[0]; var setCollectionAtRunStart = _s24[1];
  var _s25 = useState(null);       var doomRevealGroup = _s25[0]; var setDoomRevealGroup = _s25[1];
  var _s26 = useState(false);      var victoryIsGameOver = _s26[0]; var setVictoryIsGameOver = _s26[1];
  var _s27 = useState(false);      var revealDoom = _s27[0]; var setRevealDoom = _s27[1];

  var spinRef = useRef(null);
  var t1 = useRef(null), t2 = useRef(null), t3 = useRef(null), t4 = useRef([]);
  var spinGuardTimeoutRef = useRef(null);
  var doneRef = useRef(false);
  var revDone = useRef(false);
  var spinInteractGuardRef = useRef(false);
  var dragPointerTargetRef = useRef(null);
  var dragPointerIdRef = useRef(null);

  var activeBoons = boons.filter(function(b) {
    return doomGroupKeys.indexOf(b.group || b.id) === -1;
  });
  var nChoices = 3 + activeBoons.filter(function(b) { return b.effect === 'extra_choice'; }).length;
  var shopRerolls = getShopRerolls(activeBoons, gl);

  var advance = useCallback(function() {
    if (revDone.current) return;
    revDone.current = true;
    clearTimeout(t2.current);
    var d = spinRef.current;
    if (d.result === 'win') {
      var boonsForShop = d.fb;
      var growthAdjustedLevel = d.gl;

      // Increment endless spin counter before boon shop
      if (d.isEndless) setEndlessSpin(function(s) { return s + 1; });

      if (d.postSpinGrowth && d.postSpinGrowth.grew) {
        setTiles(d.postSpinGrowth.tiles);
        setNid(d.postSpinGrowth.nextId);
        boonsForShop = d.postSpinGrowth.boons;
        growthAdjustedLevel += 1;
        setGl(function(g) { return g + 1; });
        if (!d.isEndless && growthAdjustedLevel === 5) {
          // Victory!
          setBoons(boonsForShop);
          setPhase('victory_grow');
          t3.current = setTimeout(function() {
            setVictoryIsGameOver(false);
            setPhase('victory');
          }, 1900);
        } else {
          var shop = drawBoons(d.nc, growthAdjustedLevel, boonsForShop, {
            firstShop: d.shopsSeen === 0,
            nonCommonPickStreak: d.nonCommonPickStreak,
          });
          setBoons(shop.boons);
          setChoices(shop.choices);
          setShopsSeen(function(n) { return n + 1; });
          setPhase('growing');
          t3.current = setTimeout(function() { setPhase('boon_select'); }, 1900);
        }
      } else {
        var shop2 = drawBoons(d.nc, growthAdjustedLevel, boonsForShop, {
          firstShop: d.shopsSeen === 0,
          nonCommonPickStreak: d.nonCommonPickStreak,
        });
        setBoons(shop2.boons);
        setChoices(shop2.choices);
        setShopsSeen(function(n) { return n + 1; });
        setPhase('boon_select');
      }
    }
    else {
      if (d.isDoom) {
        setCollection(function(prev) {
          var next = new Set(prev);
          next.add('doom_unlock');
          saveCollection(next);
          return next;
        });
      }
      if (d.isEndless) {
        setVictoryIsGameOver(true);
        setPhase('victory');
      } else {
        setPhase('game_over');
      }
    }
  }, []);

  var finalizeReveal = useCallback(function(d) {
    setAnim(false);
    setWdeg(d.targetDeg);
    setBoons(d.fb);
    setRtile({ type: d.result, baseType: d.baseType, halfSpan: d.halfSpan, isDoom: d.isDoom });
    setRevealFlip(false);
    setRevealDoom(false);
    setPhase('reveal');
    setSc(function(n) { return n + 1; });
    revDone.current = false;
    var isRescued = !d.isDoom && d.baseType === 'lose' && d.result === 'win';
    var delay = d.isDoom ? 3000 : (isRescued ? 2500 : 720);
    t2.current = setTimeout(advance, delay);
  }, [advance]);

  var finish = useCallback(function() {
    if (doneRef.current) return;
    doneRef.current = true;
    clearTimeout(t1.current);
    var d = spinRef.current;
    if (!d) return;

    t4.current.forEach(function(tid) { clearTimeout(tid); });
    t4.current = [];
    setShakingBoon(null);

    var chain = d.triggered || [];
    if (chain.length > 0) {
      chain.forEach(function(token, idx) {
        var tid = setTimeout(function() { setShakingBoon(token); }, idx * SHAKE_INTERVAL_MS);
        t4.current.push(tid);
      });
      var clearTid = setTimeout(function() { setShakingBoon(null); }, chain.length * SHAKE_INTERVAL_MS + SHAKE_CLEAR_DELAY_MS);
      t4.current.push(clearTid);
      finalizeReveal(d);
    } else {
      finalizeReveal(d);
    }
  }, [finalizeReveal]);

  var spin = useCallback(function() {
    if (phase !== 'idle') return;
    var doomedBoons = boons.filter(function(b) { return doomGroupKeys.indexOf(b.group || b.id) !== -1; });
    var activeForSpin = boons.filter(function(b) { return doomGroupKeys.indexOf(b.group || b.id) === -1; });
    var prep = prepareSpin(tiles, activeForSpin);
    if (!NO_TRACK) { fetch('https://api.counterapi.dev/v2/pick3slop/spins/up').catch(function() {}); }
    var spinTiles = prep.tiles;
    var spinBoons = prep.boons;
    setTiles(spinTiles);
    var layout = buildLayout(spinTiles, spinBoons, true);
    var angles = calcAngles(layout);

    // Boon-based doom check in endless mode
    var doomFired = false;
    if (isEndless && doomGroupKeys.length > 0) {
      for (var di = 0; di < doomGroupKeys.length; di++) {
        var dKey = doomGroupKeys[di];
        var dGroup = spinBoons.filter(function(b) { return (b.group || b.id) === dKey; });
        if (dGroup.length > 0 && Math.random() < calcGroupDoomChance(dGroup)) {
          doomFired = true;
          break;
        }
      }
    }

    var idx;
    if (doomFired) {
      // Try to land on a win tile so the reveal can show Win → DOOM → result
      var wIdx = -1;
      for (var wDi = 0; wDi < layout.length; wDi++) {
        if (layout[wDi].type === 'win') { wIdx = wDi; break; }
      }
      if (wIdx >= 0) {
        idx = wIdx;
      } else {
        idx = findLoseIndex(layout);
        if (idx < 0) { doomFired = false; idx = pickWeighted(layout); }
      }
    } else {
      idx = pickWeighted(layout);
    }
    var tc     = angles[idx].center;
    // halfSpan: at virtual wheel sizes use type probability; at real tile sizes use the individual tile's slice
    var totalSz = layout.reduce(function(s, t) { return s + t.sz; }, 0);
    var displayType = doomFired ? 'win' : layout[idx].type;
    var typeSz = layout.reduce(function(s, t) { return s + (t.type === displayType ? t.sz : 0); }, 0);
    var hs     = totalSz > 0
      ? (gl >= PROB_DISPLAY_THRESHOLD ? (typeSz / totalSz) : (layout[idx].sz / totalSz)) * 90
      : 30;
    var cm     = wdeg % 360;
    var delta  = ((LAND - tc - cm) % 360 + 360) % 360;
    var target = wdeg + (5 + Math.floor(Math.random() * 4)) * 360 + delta;

    var landed = layout[idx].type;
    var result = landed, fb = spinBoons, triggered = [];
    if (landed === 'lose' || doomFired) {
      if (doomFired) result = 'lose'; // doom forces a loss before rescue check
      var res = tryRescue(spinBoons);
      result = res.ok ? 'win' : 'lose';
      fb = res.boons;
      triggered = res.triggered || [];
    }
    var postSpinGrowth = null;
    if (result === 'win') {
      var growth = enforceMinimumLoseAreaAfterSpin(spinTiles, fb, nid);
      if (growth.grew) postSpinGrowth = growth;
      fb = fb.concat(doomedBoons);
      if (postSpinGrowth) postSpinGrowth.boons = postSpinGrowth.boons.concat(doomedBoons);
    } else {
      fb = fb.concat(doomedBoons);
    }

    spinRef.current = {
      targetDeg: target, result: result, baseType: landed, triggered: triggered,
      fb: fb, postSpinGrowth: postSpinGrowth, nc: nChoices, halfSpan: hs, gl: gl, shopsSeen: shopsSeen,
      nonCommonPickStreak: nonCommonPickStreak,
      isEndless: isEndless, endlessSpin: endlessSpin, doomGroupKeys: doomGroupKeys,
      isDoom: doomFired,
    };
    doneRef.current = false;
    spinInteractGuardRef.current = true;
    clearTimeout(spinGuardTimeoutRef.current);
    spinGuardTimeoutRef.current = setTimeout(function() {
      spinInteractGuardRef.current = false;
      spinGuardTimeoutRef.current = null;
    }, SPIN_INTERACT_GUARD_MS);
    setAnim(true);
    setWdeg(target);
    setPhase('spinning');
    t1.current = setTimeout(finish, 3500);
  }, [phase, tiles, boons, wdeg, nChoices, gl, shopsSeen, nonCommonPickStreak, isEndless, endlessSpin, doomGroupKeys, finish]);

  var handleInteract = useCallback(function(e) {
    e.stopPropagation();
    if (spinInteractGuardRef.current) return;
    if (phase === 'spinning') finish();
    else if (phase === 'reveal') advance();
  }, [phase, finish, advance]);

  var handleWheelClick = useCallback(function(e) {
    if (phase !== 'idle') return;
    e.preventDefault();
    e.stopPropagation();
    spin();
  }, [phase, spin]);

  var handleWheelKeyDown = useCallback(function(e) {
    if (phase !== 'idle') return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      spin();
    }
  }, [phase, spin]);

  useEffect(function() {
    if (phase !== 'reveal' || !rtile) return;
    if (rtile.isDoom) {
      // Win (0ms) → DOOM (700ms) → Lose/Saved (1500ms)
      var doomTid1 = setTimeout(function() { setRevealDoom(true); }, 700);
      var doomTid2 = setTimeout(function() { setRevealFlip(true); }, 1500);
      return function() { clearTimeout(doomTid1); clearTimeout(doomTid2); };
    }
    if (rtile.baseType === 'lose' && rtile.type === 'win') {
      var tid = setTimeout(function() { setRevealFlip(true); }, 800);
      return function() { clearTimeout(tid); };
    }
  }, [phase, rtile]);

  useEffect(function() {
    return function() {
      [t1, t2, t3, spinGuardTimeoutRef].forEach(function(r) { clearTimeout(r.current); });
      t4.current.forEach(function(tid) { clearTimeout(tid); });
      t4.current = [];
    };
  }, []);

  // Restore saved run state on mount
  useEffect(function() {
    var saved = loadRunState();
    if (!saved) {
      // Fresh run: snapshot current collection as run-start baseline
      setCollectionAtRunStart(loadCollection());
      return;
    }
    try {
      var restoredBoons = (saved.boons || []).map(deserializeBoon).filter(Boolean);
      setTiles(saved.tiles || INIT_TILES);
      setBoons(restoredBoons);
      setSc(saved.sc || 0);
      setGl(saved.gl || 0);
      setNid(saved.nid || 6);
      setShopsSeen(saved.shopsSeen || 0);
      setNonCommonPickStreak(saved.nonCommonPickStreak || 0);
      setWdeg(saved.wdeg || 0);
      setIsEndless(saved.isEndless || false);
      setEndlessSpin(saved.endlessSpin || 0);
      setDoomGroupKeys(saved.doomGroupKeys || []);
      setCollectionAtRunStart(new Set(saved.collectionAtRunStart || []));
    } catch(e) { clearRunState(); }
  }, []);

  // Persist run state whenever core game state changes
  useEffect(function() {
    if (phase === 'game_over' || phase === 'victory') { clearRunState(); return; }
    if (phase !== 'idle') return;
    try {
      saveRunState({
        tiles: tiles,
        boons: boons.map(serializeBoon),
        sc: sc, gl: gl, nid: nid,
        shopsSeen: shopsSeen,
        nonCommonPickStreak: nonCommonPickStreak,
        wdeg: wdeg,
        isEndless: isEndless,
        endlessSpin: endlessSpin,
        doomGroupKeys: doomGroupKeys,
        collectionAtRunStart: Array.from(collectionAtRunStart),
      });
    } catch(e) {}
  }, [tiles, boons, sc, gl, nid, shopsSeen, nonCommonPickStreak, wdeg, phase, isEndless, endlessSpin, doomGroupKeys, collectionAtRunStart]);

  var pick = useCallback(function(boon) {
    var doomedBoons = boons.filter(function(b) { return doomGroupKeys.indexOf(b.group || b.id) !== -1; });
    var activeForPick = boons.filter(function(b) { return doomGroupKeys.indexOf(b.group || b.id) === -1; });
    var res = applyBoon(boon, tiles, activeForPick, nid);
    setTiles(res.tiles);
    setBoons(res.boons.concat(doomedBoons));
    setNid(res.nextId);
    setChoices([]);
    setFlippedTiles(res.flippedIds || []);
    if (res.flippedIds && res.flippedIds.length > 0) {
      setTimeout(function() { setFlippedTiles([]); }, 560);
    }

    // Helper: trigger doom mechanics then go idle (used in endless mode after each shop pick)
    function triggerEndlessDoomThenIdle(postPickBoons) {
      if (endlessSpin === 2) {
        setPhase('doom_approaches');
        t3.current = setTimeout(function() { setPhase('idle'); }, 1900);
      } else if (endlessSpin >= 3) {
        var doomChance = Math.min(0.95, 0.33 + (endlessSpin - 3) * 0.02);
        if (Math.random() < doomChance) {
          var shownPP = postPickBoons.filter(function(b) { return b.effect !== 'add_win'; });
          var gMap = {}, gOrder = [];
          shownPP.forEach(function(b) {
            var key = b.group || b.id;
            if (!gMap[key]) { gMap[key] = []; gOrder.push(key); }
            gMap[key].push(b);
          });
          var nonDoom = gOrder.filter(function(k) { return doomGroupKeys.indexOf(k) === -1; });
          if (nonDoom.length > 0) {
            var vKey = nonDoom[Math.floor(Math.random() * nonDoom.length)];
            var vBoons = gMap[vKey];
            setDoomRevealGroup({ groupKey: vKey, boons: vBoons, first: vBoons[0] });
            setPhase('doom_reveal');
            var newDoomKeys = doomGroupKeys.concat([vKey]);
            t3.current = setTimeout(function() {
              setDoomGroupKeys(newDoomKeys);
              setDoomRevealGroup(null);
              setPhase('idle');
            }, 3500);
          } else {
            setPhase('idle');
          }
        } else {
          setPhase('idle');
        }
      } else {
        setPhase('idle');
      }
    }

    if (res.grew) {
      var newGl = gl + 1;
      setGl(newGl);
      if (!isEndless && newGl === 5) {
        // Victory via boon pick growth
        setPhase('victory_grow');
        t3.current = setTimeout(function() {
          setVictoryIsGameOver(false);
          setPhase('victory');
        }, 1900);
      } else if (isEndless) {
        setPhase('growing');
        t3.current = setTimeout(function() {
          var fullBoons = res.boons.concat(doomedBoons);
          triggerEndlessDoomThenIdle(fullBoons);
        }, 1900);
      } else {
        setPhase('growing');
        t3.current = setTimeout(function() { setPhase('idle'); }, 1900);
      }
    } else {
      if (isEndless) {
        var fullBoons = res.boons.concat(doomedBoons);
        triggerEndlessDoomThenIdle(fullBoons);
      } else {
        setPhase('idle');
      }
    }
    if (!NO_TRACK && boon.rarity === 'legendary') { fetch('https://api.counterapi.dev/v2/pick3slop/legendary-boons/up').catch(function() {}); }
    setNonCommonPickStreak(function(streak) {
      return boon.rarity === 'common' ? 0 : (streak + 1);
    });
    setCollection(function(prev) {
      var next = new Set(prev);
      next.add(boon.id);
      saveCollection(next);
      return next;
    });
  }, [tiles, boons, nid, gl, isEndless, endlessSpin, doomGroupKeys]);

  var rerollChoices = useCallback(function() {
    if (phase !== 'boon_select') return;
    var rr = rerollShop(nChoices, gl, boons, { nonCommonPickStreak: nonCommonPickStreak });
    if (!rr.ok) return;
    setBoons(rr.boons);
    setChoices(rr.choices);
  }, [phase, nChoices, gl, boons, nonCommonPickStreak]);

  var restart = useCallback(function() {
    [t1, t2, t3, spinGuardTimeoutRef].forEach(function(r) { clearTimeout(r.current); });
    t4.current.forEach(function(tid) { clearTimeout(tid); });
    t4.current = [];
    doneRef.current = true;
    revDone.current = true;
    spinRef.current = null;
    clearRunState();
    var currentColl = loadCollection();
    setCollectionAtRunStart(currentColl);
    setTiles(INIT_TILES);
    setBoons([]); setSc(0); setGl(0); setPhase('idle');
    setWdeg(0); setAnim(false); setRtile(null);
    setFlippedTiles([]); setShakingBoon(null); setRevealFlip(false); setRevealDoom(false);
    setDragIid(null); setDragOverIid(null);
    setChoices([]); setNid(6); setShopsSeen(0); setNonCommonPickStreak(0);
    setIsEndless(false); setEndlessSpin(0); setDoomGroupKeys([]);
    setDoomRevealGroup(null); setVictoryIsGameOver(false);
  }, []);

  var enterEndless = useCallback(function() {
    [t1, t2, t3, spinGuardTimeoutRef].forEach(function(r) { clearTimeout(r.current); });
    t4.current.forEach(function(tid) { clearTimeout(tid); });
    t4.current = [];
    setIsEndless(true);
    setEndlessSpin(0);
    setDoomGroupKeys([]);
    setDoomRevealGroup(null);
    setVictoryIsGameOver(false);
    // Show "Wheel Grows" animation then resume play
    setPhase('growing');
    t3.current = setTimeout(function() { setPhase('idle'); }, 1900);
  }, []);

  var giveUp = useCallback(function() {
    [t1, t2, t3, spinGuardTimeoutRef].forEach(function(r) { clearTimeout(r.current); });
    t4.current.forEach(function(tid) { clearTimeout(tid); });
    t4.current = [];
    doneRef.current = true;
    revDone.current = true;
    spinRef.current = null;
    setAnim(false);
    setShakingBoon(null);
    setRevealFlip(false);
    setRevealDoom(false);
    clearRunState();
    setShowMenu(false);
    if (isEndless) {
      setVictoryIsGameOver(true);
      setPhase('victory');
    } else {
      setPhase('game_over');
    }
  }, [isEndless]);

  var reorderBoonsByIid = useCallback(function(fromIid, toIid) {
    if (!fromIid || !toIid || fromIid === toIid) return;
    setBoons(function(prev) {
      var src = prev.findIndex(function(b) { return b.iid === fromIid; });
      var dst = prev.findIndex(function(b) { return b.iid === toIid; });
      if (src < 0 || dst < 0 || src === dst) return prev;
      var next = prev.slice();
      var moved = next.splice(src, 1)[0];
      next.splice(dst, 0, moved);
      return next;
    });
  }, []);

  var startDragBoon = useCallback(function(e, iid) {
    if (phase !== 'idle') return;
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    dragPointerTargetRef.current = e.currentTarget;
    dragPointerIdRef.current = e.pointerId;
    setDragIid(iid);
    setDragOverIid(iid);
  }, [phase]);

  var moveDragBoon = useCallback(function(e) {
    if (!dragIid) return;
    var target = document.elementFromPoint(e.clientX, e.clientY);
    var holder = target ? target.closest('[data-boon-iid]') : null;
    var overIid = holder ? holder.getAttribute('data-boon-iid') : null;
    if (!overIid) return;
    setDragOverIid(overIid);
  }, [dragIid]);

  var releaseDragPointerCapture = useCallback(function() {
    var ptrTarget = dragPointerTargetRef.current;
    var ptrId = dragPointerIdRef.current;
    if (ptrTarget && ptrTarget.releasePointerCapture && ptrId !== null) {
      try { ptrTarget.releasePointerCapture(ptrId); } catch (err) { /* Pointer may already be released/cancelled. */ }
    }
    dragPointerTargetRef.current = null;
    dragPointerIdRef.current = null;
  }, []);

  var endDragBoon = useCallback(function() {
    releaseDragPointerCapture();
    reorderBoonsByIid(dragIid, dragOverIid);
    setDragIid(null);
    setDragOverIid(null);
  }, [dragIid, dragOverIid, reorderBoonsByIid, releaseDragPointerCapture]);

  var cancelDragBoon = useCallback(function() {
    releaseDragPointerCapture();
    setDragIid(null);
    setDragOverIid(null);
  }, [releaseDragPointerCapture]);

  // Build grouped display boons: collapse same-group boons into one icon
  var shownBoons = boons.filter(function(b) { return b.effect !== 'add_win'; });
  var displayBoonGroups = (function() {
    var map = {};
    var order = [];
    shownBoons.forEach(function(b) {
      var key = b.group || b.id;
      if (!map[key]) { map[key] = []; order.push(key); }
      map[key].push(b);
    });
    return order.map(function(key) {
      var grp = map[key];
      var first = grp[0];
      var n = grp.length;
      var totalCharges = grp.reduce(function(sum, b) { return sum + (b.charges || 0); }, 0);
      var isDoom = doomGroupKeys.indexOf(key) !== -1;
      var doomChancePct = isDoom ? Math.round(calcGroupDoomChance(grp) * 1000) / 10 : 0;
      return Object.assign({}, first, {
        name: isDoom ? 'DOOM' : (first.name + (n > 1 ? ' \xd7' + n : '')),
        desc: isDoom
          ? doomChancePct + '% chance of immediate loss per spin'
          : getStackedDesc(grp),
        charges: totalCharges,
        isDoom: isDoom,
        doomChancePct: doomChancePct,
      });
    });
  })();

  // Determine which group is shaking for highlight
  var shakingGroupKey = null;
  if (shakingBoon) {
    var foundShaking = shownBoons.find(function(b) { return b.iid === shakingBoon; });
    if (foundShaking) shakingGroupKey = foundShaking.group || foundShaking.id;
  }

  return {
    // State
    tiles, boons, sc, gl, phase, wdeg, anim, rtile, choices, nid, shopsSeen,
    flippedTiles, shakingBoon, revealFlip, dragIid, dragOverIid, nonCommonPickStreak,
    collection, showCollection, showMenu, isEndless, endlessSpin, doomGroupKeys,
    collectionAtRunStart, doomRevealGroup, victoryIsGameOver, revealDoom,
    // Setters exposed to App
    setShowCollection, setShowMenu,
    // Actions
    spin, handleInteract, handleWheelClick, handleWheelKeyDown,
    pick, rerollChoices, restart, enterEndless, giveUp,
    startDragBoon, moveDragBoon, endDragBoon, cancelDragBoon,
    // Derived
    activeBoons, nChoices, shopRerolls,
    shownBoons, displayBoonGroups, shakingGroupKey,
  };
}
