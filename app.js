    const { useState, useRef, useCallback, useEffect } = React;
      const {
        CX, CY, R, LAND, BOONS, RC, INIT_TILES,
        PROB_DISPLAY_THRESHOLD, FULL_PROB_THRESHOLD,
        isVirtWheel, virtGetCount, virtTotalCount,
        slicePath, revealWedge, prepareSpin, buildLayout, calcAngles,
        pickWeighted, findLoseIndex, calcBoonDoomChance, calcGroupDoomChance, drawBoons, getShopRerolls, rerollShop, tryRescue, enforceMinimumLoseAreaAfterSpin, applyBoon,
        getStackedDesc, instantiateTemplate,
      } = window.Pick3Logic;

      // Build a template map for boon deserialization
      var BOON_TEMPLATE_MAP = {};
      BOONS.forEach(function(b) { BOON_TEMPLATE_MAP[b.id] = b; });

      // ── Persistent storage helpers ──────────────────────────────────────────
      var RUN_KEY  = 'pick3_run';
      var COLL_KEY = 'pick3_collection';

      function loadRunState() {
        try { var s = localStorage.getItem(RUN_KEY); return s ? JSON.parse(s) : null; }
        catch(e) { return null; }
      }
      function saveRunState(state) {
        try { localStorage.setItem(RUN_KEY, JSON.stringify(state)); } catch(e) {}
      }
      function clearRunState() {
        try { localStorage.removeItem(RUN_KEY); } catch(e) {}
      }
      function loadCollection() {
        try { var s = localStorage.getItem(COLL_KEY); return new Set(s ? JSON.parse(s) : []); }
        catch(e) { return new Set(); }
      }
      function saveCollection(col) {
        try { localStorage.setItem(COLL_KEY, JSON.stringify(Array.from(col))); } catch(e) {}
      }

      // Serialize a boon to plain JSON (strips functions)
      function serializeBoon(b) {
        var out = {};
        Object.keys(b).forEach(function(k) { if (typeof b[k] !== 'function') out[k] = b[k]; });
        return out;
      }
      // Reconstruct a boon from its serialized form by re-attaching template functions
      function deserializeBoon(saved) {
        if (!saved || !saved.id) return null;
        var tpl = BOON_TEMPLATE_MAP[saved.id];
        if (!tpl) return null;
        var fresh = instantiateTemplate(tpl);
        Object.keys(saved).forEach(function(k) { fresh[k] = saved[k]; });
        return fresh;
      }

    // BoonTag — tooltip via CSS class toggle + hover, no portal
    function BoonTag(props) {
      var DRAG_THRESHOLD_DISTANCE_SQUARED = 25; // 5px distance threshold (5^2) before treating pointer interaction as a drag.
      var b = props.b;
      var large = props.large;
      var shaking = props.shaking;
      var draggable = props.draggable;
      var [pinned, setPinned] = useState(false);
      var startRef = useRef(null);
      var movedRef = useRef(false);
      var tagRef = useRef(null);

      useEffect(function() {
        if (!pinned) return;
        var el = tagRef.current;
        function handleOutsideClick(e) {
          if (el && el.contains(e.target)) return;
          setPinned(false);
        }
        document.addEventListener('click', handleOutsideClick, true);
        return function() { document.removeEventListener('click', handleOutsideClick, true); };
      }, [pinned]);

      var isDoom = b.isDoom;
      var c = isDoom ? '#CC1010' : RC[b.rarity];
      var cls = 'boon-tag boon-tag-base ' + (large ? 'boon-tag-large' : 'boon-tag-small') + (pinned ? ' pinned' : '') + (shaking ? ' shaking' : '') + (isDoom ? ' doom-boon-tag' : '');

      return (
        <span
          ref={tagRef}
          className={cls}
          data-boon-iid={b.iid}
          onPointerDown={function(e) {
            if (draggable) {
              startRef.current = { x: e.clientX, y: e.clientY };
              movedRef.current = false;
            }
            if (props.onPointerDown) props.onPointerDown(e);
          }}
          onPointerMove={function(e) {
            if (draggable && startRef.current) {
              var dx = e.clientX - startRef.current.x;
              var dy = e.clientY - startRef.current.y;
              if ((dx * dx + dy * dy) > DRAG_THRESHOLD_DISTANCE_SQUARED) movedRef.current = true;
            }
            if (props.onPointerMove) props.onPointerMove(e);
          }}
          onPointerUp={function(e) {
            startRef.current = null;
            if (props.onPointerUp) props.onPointerUp(e);
          }}
          onPointerCancel={function(e) {
            startRef.current = null;
            if (props.onPointerCancel) props.onPointerCancel(e);
          }}
          onClick={function(e) {
            e.stopPropagation();
            if (movedRef.current) {
              movedRef.current = false;
              return;
            }
            setPinned(function(p) { return !p; });
          }}
          style={{
            border: '1px solid ' + c,
            color: c,
            background: isDoom ? (pinned ? 'rgba(180,16,16,.22)' : 'rgba(180,16,16,.12)') : (pinned ? c + '28' : c + '14'),
            cursor: draggable ? 'grab' : 'pointer',
            outline: props.dropTarget ? ('1px dashed ' + c) : 'none',
          }}
        >
          {b.name}{b.charges > 0 ? ' (' + b.charges + ')' : ''}
          <span
            className="boon-tip"
            style={{ border: '1px solid ' + c, boxShadow: '0 4px 24px rgba(0,0,0,.8), 0 0 12px ' + c + '30' }}
          >
            <span className="boon-tip-rarity" style={{ color: c }}>
              {isDoom ? 'doom' : b.rarity}
            </span>
            <span className="boon-tip-name">
              {b.name}
            </span>
            <span className="boon-tip-desc">
              {b.desc}
            </span>
            <span className="tip-arrow" style={{ borderTop: '7px solid ' + c }} />
          </span>
        </span>
      );
    }

    var NO_TRACK = (new URLSearchParams(window.location.search)).has('notrack');

    function App() {
      var SHAKE_INTERVAL_MS = 120;
      var SHAKE_CLEAR_DELAY_MS = 140;
      var SPIN_INTERACT_GUARD_MS = 80;
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
        // halfSpan: total proportion of win (for doom) or landed type (normal) → accurate triangle
        var totalSz = layout.reduce(function(s, t) { return s + t.sz; }, 0);
        var displayType = doomFired ? 'win' : layout[idx].type;
        var typeSz = layout.reduce(function(s, t) { return s + (t.type === displayType ? t.sz : 0); }, 0);
        var hs     = totalSz > 0 ? (typeSz / totalSz) * 90 : 30;
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
                triggerEndlessDoomThenIdle(fullBoons); }, 1900);
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

      var shownBoons = boons.filter(function(b) { return b.effect !== 'add_win'; });
      var flippedMap = {};
      flippedTiles.forEach(function(id) { flippedMap[id] = true; });

      // Build grouped display boons: collapse same-group boons into one icon
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

      var dl   = buildLayout(tiles, boons, false);
      var da   = calcAngles(dl);
      var isVirt = isVirtWheel(tiles);
      var wins = isVirt ? virtGetCount(tiles, 'win') : tiles.filter(function(t) { return t.type === 'win'; }).length;
      var totalTileCount = isVirt ? virtTotalCount(tiles) : tiles.length;

      // Pre-compute win fraction for the probabilistic two-sector display (gl >= PROB_DISPLAY_THRESHOLD).
      var probWinFrac = (function() {
        if (gl < PROB_DISPLAY_THRESHOLD) return null;
        var totalSz = dl.reduce(function(s, t) { return s + t.sz; }, 0);
        if (totalSz <= 0) return 0.5;
        var winSz = dl.reduce(function(s, t) { return s + (t.type === 'win' ? t.sz : 0); }, 0);
        return winSz / totalSz;
      })();

      var isOverlay = phase === 'boon_select' || phase === 'game_over' || phase === 'victory';
      var totalBoons = BOONS.length;
      var seenBoons  = BOONS.filter(function(b) { return collection.has(b.id); }).length;

      // Divider-suppression: skip the stroke between two adjacent same-type tiles when
      // the smaller tile's outer arc is < DIVIDER_SKIP_PX screen-pixels.
      // The SVG renders at SVG_RENDER_PX wide over a SVG_VIEWBOX-unit viewBox (R=175 units).
      // Rearranging arc_px = R * θ_deg * π/180 * (SVG_RENDER_PX/SVG_VIEWBOX) gives threshold ≈ 1.114°.
      var DIVIDER_SKIP_PX  = 3;   // screen-pixels at the outer rim before a divider is suppressed
      var SVG_RENDER_PX    = 370; // rendered SVG width in screen-pixels
      var SVG_VIEWBOX      = 420; // SVG viewBox width in SVG units
      var MERGE_THRESHOLD_DEG = DIVIDER_SKIP_PX * 180 * SVG_VIEWBOX / (R * Math.PI * SVG_RENDER_PX);
      // Display switches to scientific notation above this tile count (100 trillion).
      var SCIENTIFIC_NOTATION_THRESHOLD = 1e14;
      function tileColor(type) {
        return type === 'win' ? '#d4d4d4' : '#1e1e1e';
      }
      function formatTileCount(n) {
        if (n >= SCIENTIFIC_NOTATION_THRESHOLD) return n.toExponential(2);
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
      function formatWinPct(frac) {
        return (Math.round(frac * 1000) / 10) + '% WIN';
      }

      // Build render groups: consecutive same-type tiles are merged when at least one
      // of the neighbouring tiles is "tiny" (outer arc < 3 screen-px).
      // Skipped entirely when gl >= PROB_DISPLAY_THRESHOLD (two-sector rendering is used instead).
      var renderGroups = probWinFrac !== null ? [] : (function() {
        var n = dl.length;
        if (n === 0) return [];
        var tiny = dl.map(function(t, i) { return (da[i].end - da[i].start) < MERGE_THRESHOLD_DEG; });
        var groups = [];
        var i = 0;
        while (i < n) {
          var type = dl[i].type;
          var items = [i];
          var j = i + 1;
          while (j < n && dl[j].type === type && (tiny[j - 1] || tiny[j])) {
            items.push(j);
            j++;
          }
          groups.push({ items: items, startAngle: da[items[0]].start, endAngle: da[items[items.length - 1]].end, type: type });
          i = j;
        }
        // Circular merge: if the last group and first group are same type with a tiny boundary, merge them.
        if (groups.length >= 2) {
          var first = groups[0], last = groups[groups.length - 1];
          if (first.type === last.type && (tiny[last.items[last.items.length - 1]] || tiny[first.items[0]])) {
            groups[0] = {
              items: last.items.concat(first.items),
              startAngle: last.startAngle,
              endAngle: first.endAngle + 360, // wrap past 360° — slicePath() handles this via trig periodicity in polar()
              type: first.type,
            };
            groups.splice(groups.length - 1, 1);
          }
        }
        return groups;
      })();

      return (
        <div
          className="app-root"
          style={{ cursor: phase === 'spinning' || phase === 'reveal' ? 'pointer' : 'default' }}
          onClick={handleInteract}
        >
          {/* Menu button — fixed top-left, outside blurred area */}
          {phase !== 'game_over' && phase !== 'victory' && (
            <button
              className="btn-menu"
              onClick={function(e) { e.stopPropagation(); setShowMenu(true); }}
              aria-label="Open menu"
            >
              &#8801;
            </button>
          )}

          {/* Blurable main content */}
          <div className={'app-main' + (isOverlay ? ' blurred' : '')}>
            {/* Header row with title and subtitle */}
            <div className="app-header">
              <h1 className="app-title">PICK 3 SLOP</h1>
              <div className="app-subtitle">
                SPIN {sc} &nbsp;|&nbsp;
                  {probWinFrac !== null
                    ? formatWinPct(probWinFrac)
                    : wins + ' / ' + totalTileCount + ' WIN'
                  } &nbsp;|&nbsp; LVL {gl}
              </div>
            </div>

            {/* Wheel */}
            <div
              className="wheel-wrap"
              onClick={handleWheelClick}
              onKeyDown={handleWheelKeyDown}
              role="button"
              aria-label="Spin wheel"
              tabIndex={phase === 'idle' ? 0 : -1}
            >
              {/* Right-side pointer */}
              <div className="wheel-pointer" />

              <svg width={370} height={370} viewBox="0 0 420 420" style={{
                transform: 'rotate(' + wdeg + 'deg)',
                transition: anim ? 'transform 3.4s cubic-bezier(0.14, 0.58, 0.08, 1.0)' : 'none',
              }}>
                <circle cx={CX} cy={CY} r={R + 5} fill="none" stroke="#2a2a2a" strokeWidth={2} />
                {probWinFrac !== null ? (
                  /* Probabilistic two-sector wheel (gl >= PROB_DISPLAY_THRESHOLD) */
                  (function() {
                    var winDeg  = probWinFrac * 360;
                    var loseDeg = 360 - winDeg;
                    return (
                      <>
                        {winDeg  > 0.01 && <path d={slicePath(0, winDeg)}         fill="#d4d4d4" stroke="#0f0f0f" strokeWidth={1.5} />}
                        {loseDeg > 0.01 && <path d={slicePath(winDeg, 360)}        fill="#1e1e1e" stroke="#0f0f0f" strokeWidth={1.5} />}
                      </>
                    );
                  })()
                ) : renderGroups.map(function(group, gi) {
                  // Any tile in this group undergoing the flip animation? → render individually.
                  var hasFlipped = group.items.some(function(idx) { return flippedMap[dl[idx].id] && dl[idx].type === 'win'; });
                  if (hasFlipped) {
                    return group.items.map(function(idx) {
                      var t = dl[idx], a = da[idx];
                      if (flippedMap[t.id] && t.type === 'win') {
                        return (
                          <g key={t.id}>
                            <path d={slicePath(a.start, a.end)} fill="#1e1e1e" stroke="#0f0f0f" strokeWidth={1.5} />
                            <path d={slicePath(a.start, a.end)} fill="#d4d4d4" stroke="#0f0f0f" strokeWidth={1.5} style={{ animation: 'edgeOvertake .55s ease both' }} />
                          </g>
                        );
                      }
                      return <path key={t.id} d={slicePath(a.start, a.end)} fill={tileColor(t.type)} stroke="#0f0f0f" strokeWidth={1.5} />;
                    });
                  }
                  // Render entire merged group as a single path — no internal dividers.
                  return (
                    <path key={'g' + gi} d={slicePath(group.startAngle, group.endAngle)} fill={tileColor(group.type)} stroke="#0f0f0f" strokeWidth={1.5} />
                  );
                })}
                <circle cx={CX} cy={CY} r={17} fill="#0f0f0f" stroke="#333" strokeWidth={2} />
                <circle cx={CX} cy={CY} r={5.5} fill="#3a3a3a" />
              </svg>

              {/* Tile counter — static overlay (does not rotate with wheel), shown after 3rd growth */}
              {gl >= 3 && (
                <div className="tile-counter">
                  {formatTileCount(totalTileCount)}
                </div>
              )}
            </div>

            {/* Spin / hint */}
            <div className="spin-row">
              {phase === 'idle' && (
                <button
                  className="spin-btn"
                  onPointerDown={function(e) { e.stopPropagation(); spin(); }}
                  onClick={function(e) { e.stopPropagation(); }}
                >
                  SPIN
                </button>
              )}
              {(phase === 'spinning' || phase === 'reveal') && (
                <span className="phase-hint">
                  {phase === 'spinning' ? 'CLICK ANYWHERE TO RESOLVE' : 'CLICK TO CONTINUE'}
                </span>
              )}
            </div>

            {/* Boon stack */}
            {displayBoonGroups.length > 0 && (
              <div className="boon-stack">
                <div className="boon-stack-label">
                  BOON STACK &mdash; DRAG TO REORDER | HOVER OR CLICK TO INSPECT
                </div>
                <div className="boon-stack-items">
                  {displayBoonGroups.map(function(b) {
                    return (
                      <BoonTag
                        key={b.iid}
                        b={b}
                        shaking={shakingGroupKey !== null && (b.group || b.id) === shakingGroupKey}
                        draggable={true}
                        dropTarget={dragOverIid === b.iid}
                        onPointerDown={function(e) { e.stopPropagation(); startDragBoon(e, b.iid); }}
                        onPointerMove={moveDragBoon}
                        onPointerUp={function(e) { e.stopPropagation(); endDragBoon(e); }}
                        onPointerCancel={function(e) { e.stopPropagation(); cancelDragBoon(e); }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Tile reveal — slides in from the right */}
          {phase === 'reveal' && rtile && (
            <div className="reveal-overlay">
              <div className="reveal-card">
                <svg width={310} height={260} overflow="visible">
                  <g>
                  {rtile.isDoom ? (
                    <>
                      {/* Step 0: Win triangle */}
                      <path
                        d={revealWedge(rtile.halfSpan)}
                        fill="#d4d4d4"
                        stroke="#888"
                        strokeWidth={2}
                      />
                      {/* Step 1: DOOM overtakes (same size) */}
                      {revealDoom && !revealFlip && (
                        <path
                          d={revealWedge(rtile.halfSpan)}
                          fill="#CC1010"
                          stroke="#990000"
                          strokeWidth={2}
                          style={{ animation: 'edgeOvertake .45s ease both' }}
                        />
                      )}
                      {/* Step 2: Final outcome (same size) */}
                      {revealFlip && (
                        <path
                          d={revealWedge(rtile.halfSpan)}
                          fill={rtile.type === 'win' ? '#D4AF37' : '#242424'}
                          stroke={rtile.type === 'win' ? '#b8962a' : '#555'}
                          strokeWidth={2}
                          style={{ animation: 'edgeOvertake .45s ease both' }}
                        />
                      )}
                    </>
                  ) : (rtile.baseType === 'lose' && rtile.type === 'win') ? (
                    <>
                      <path
                        d={revealWedge(rtile.halfSpan)}
                        fill="#242424"
                        stroke="#555"
                        strokeWidth={2}
                      />
                      {revealFlip && (
                        <path
                          d={revealWedge(rtile.halfSpan)}
                          fill="#D4AF37"
                          stroke="#b8962a"
                          strokeWidth={2}
                          style={{ animation: 'edgeOvertake .45s ease both' }}
                        />
                      )}
                    </>
                  ) : (
                    <path
                      d={revealWedge(rtile.halfSpan)}
                      fill={rtile.type === 'win' ? '#d4d4d4' : '#242424'}
                      stroke={rtile.type === 'win' ? '#888' : '#555'}
                      strokeWidth={2}
                    />
                  )}
                  <text
                    x={160} y={132}
                    textAnchor="middle" dominantBaseline="middle"
                    fontFamily="'Cinzel', serif" fontWeight="700"
                    fontSize={20} letterSpacing="3"
                    fill={
                      rtile.isDoom
                        ? (revealFlip
                          ? (rtile.type === 'win' ? '#1a1a1a' : '#d0d0d0')
                          : (revealDoom ? '#d0d0d0' : '#1a1a1a'))
                        : (rtile.baseType === 'lose' && rtile.type === 'win')
                          ? (revealFlip ? '#1a1a1a' : '#d0d0d0')
                          : (rtile.type === 'win' ? '#1a1a1a' : '#d0d0d0')
                    }
                    style={
                      rtile.isDoom
                        ? ((revealDoom || revealFlip) ? { animation: 'rescueTextFade .3s ease' } : null)
                        : (rtile.baseType === 'lose' && rtile.type === 'win' && revealFlip) ? { animation: 'rescueTextFade .3s ease' } : null
                    }
                  >
                    {rtile.isDoom
                      ? (revealFlip
                        ? (rtile.type === 'win' ? 'SAVED!' : 'x LOSE x')
                        : (revealDoom ? 'DOOM' : '* WIN *'))
                      : (rtile.baseType === 'lose' && rtile.type === 'win')
                        ? (revealFlip ? 'SAVED!' : 'x LOSE x')
                        : (rtile.type === 'win' ? '* WIN *' : 'x LOSE x')
                    }
                  </text>
                  </g>
                </svg>
              </div>
            </div>
          )}

          {/* Overlay: boon shop / game over */}
          {isOverlay && (
            <div
              className="game-overlay"
              onClick={function(e) { e.stopPropagation(); }}
            >
              {phase === 'boon_select' && (
                <div className="shop-panel">
                  <div className="shop-label">
                    CHOOSE A BOON
                  </div>
                  <div className="reroll-row">
                    <button
                      onClick={function(e) { e.stopPropagation(); rerollChoices(); }}
                      disabled={shopRerolls <= 0}
                      className="btn-reroll"
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
                    {choices.map(function(b) {
                      return (
                        <div
                          key={b.iid}
                          className="boon-card"
                          onClick={function(e) { e.stopPropagation(); pick(b); }}
                          style={{
                            border: '2px solid ' + RC[b.rarity],
                            background: RC[b.rarity] + '12',
                            boxShadow: '0 0 10px ' + RC[b.rarity] + '28',
                          }}
                          onMouseEnter={function(e) { e.currentTarget.style.boxShadow = '0 0 24px ' + RC[b.rarity] + '58'; }}
                          onMouseLeave={function(e) { e.currentTarget.style.boxShadow = '0 0 10px ' + RC[b.rarity] + '28'; }}
                        >
                          <div className="boon-card-rarity" style={{ color: RC[b.rarity] }}>
                            {b.rarity}
                          </div>
                          <div className="boon-card-name">
                            {b.name}
                          </div>
                          <div className="boon-card-desc">
                            {b.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {phase === 'game_over' && (
                <div className="game-over-panel">
                  <div className="eliminated-text">
                    ELIMINATED
                  </div>
                  <div className="spins-survived">
                    {sc} SPINS SURVIVED
                  </div>
                  {shownBoons.length > 0 && (
                    <div className="final-boons">
                      <div className="final-boons-label">
                        FINAL BOON STACK
                      </div>
                      <div className="final-boons-items">
                        {displayBoonGroups.map(function(b) {
                          return <BoonTag key={'go_' + b.iid} b={b} large={true} />;
                        })}
                      </div>
                    </div>
                  )}
                  <button
                    className="again-btn"
                    onClick={function(e) { e.stopPropagation(); restart(); }}
                  >
                    PLAY AGAIN
                  </button>
                  <button
                    className="btn-view-collection"
                    onClick={function(e) { e.stopPropagation(); setShowCollection(true); }}
                  >
                    VIEW COLLECTION ({seenBoons}/{totalBoons})
                  </button>
                </div>
              )}

              {phase === 'victory' && (
                <div className="victory-panel">
                  <div className={victoryIsGameOver ? 'eliminated-text' : 'victory-title'}>
                    {victoryIsGameOver ? 'GAME OVER' : 'VICTORY!'}
                  </div>
                  <div className="spins-survived">
                    {sc} SPINS SURVIVED
                  </div>
                  {displayBoonGroups.length > 0 && (
                    <div className="final-boons">
                      <div className="final-boons-label">YOUR BOONS</div>
                      <div className="final-boons-items">
                        {displayBoonGroups.map(function(b) {
                          var isNew = !b.isDoom && collection.has(b.id) && !collectionAtRunStart.has(b.id);
                          return (
                            <span key={'v_' + b.iid} style={{ fontWeight: isNew ? 700 : undefined }}>
                              <BoonTag b={b} large={true} />
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="victory-btn-row">
                    {!victoryIsGameOver && (
                      <button
                        className="victory-btn victory-btn-endless"
                        onClick={function(e) { e.stopPropagation(); enterEndless(); }}
                      >
                        ENDLESS
                      </button>
                    )}
                    <button
                      className="victory-btn victory-btn-collection"
                      onClick={function(e) { e.stopPropagation(); setShowCollection(true); }}
                    >
                      COLLECTION
                    </button>
                    <button
                      className="victory-btn victory-btn-restart"
                      onClick={function(e) { e.stopPropagation(); restart(); }}
                    >
                      START OVER
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wheel grows */}
          {phase === 'growing' && (
            <div className="growing-overlay">
              <div className="growing-text">
                WHEEL GROWS
              </div>
            </div>
          )}

          {/* Victory grow banner */}
          {phase === 'victory_grow' && (
            <div className="growing-overlay">
              <div className="growing-text victory-grow-text">
                VICTORY
              </div>
            </div>
          )}

          {/* Doom Approaches banner */}
          {phase === 'doom_approaches' && (
            <div className="growing-overlay">
              <div className="growing-text doom-approaches-text">
                DOOM APPROACHES
              </div>
            </div>
          )}

          {/* Doom Reveal overlay */}
          {phase === 'doom_reveal' && doomRevealGroup && (
            <div className="doom-reveal-overlay">
              <div className="doom-reveal-boon">
                <div className="doom-reveal-original">
                  <span style={{ color: RC[doomRevealGroup.first.rarity] }}>
                    {doomRevealGroup.first.name}{doomRevealGroup.boons.length > 1 ? ' \xd7' + doomRevealGroup.boons.length : ''}
                  </span>
                </div>
                <div className="doom-reveal-doom">
                  DOOM
                </div>
              </div>
            </div>
          )}

          {/* Collection modal */}
          {showCollection && (
            <div
              className="collection-overlay"
              onClick={function() { setShowCollection(false); }}
            >
              <div
                className="collection-panel"
                onClick={function(e) { e.stopPropagation(); }}
              >
                {/* Header */}
                <div className="collection-header">
                  <div>
                    <div className="collection-title">BOON COLLECTION</div>
                    <div className="collection-count">
                      {seenBoons} / {totalBoons} DISCOVERED
                    </div>
                  </div>
                  <button
                    className="btn-close"
                    onClick={function() { setShowCollection(false); }}
                  >
                    CLOSE
                  </button>
                </div>

                {/* Progress bar */}
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: (totalBoons > 0 ? (seenBoons / totalBoons * 100) : 0) + '%',
                  }} />
                </div>

                {/* Boon grid — sorted by rarity then name */}
                <div className="boon-grid">
                  {(function() {
                    var rarityOrder = ['common', 'uncommon', 'rare', 'legendary'];
                    var sorted = BOONS.slice().sort(function(a, b) {
                      var ri = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
                      if (ri !== 0) return ri;
                      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
                    });
                    return sorted.map(function(b) {
                      var seen = collection.has(b.id);
                      var c = RC[b.rarity];
                      return (
                        <div
                          key={b.id}
                          className="boon-grid-item"
                          style={{
                            border: '1px solid ' + (seen ? c + '88' : '#1c1c1c'),
                            background: seen ? c + '0d' : '#080808',
                          }}
                        >
                          <div className="boon-grid-rarity" style={{ color: seen ? c : '#2a2a2a' }}>
                            {b.rarity}
                          </div>
                          <div className="boon-grid-name" style={{ color: seen ? '#ccc' : '#2a2a2a', fontWeight: seen ? 600 : 400 }}>
                            {seen ? b.name : '???'}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
          {/* Menu modal */}
          {showMenu && (
            <div
              className="menu-overlay"
              onClick={function(e) { e.stopPropagation(); setShowMenu(false); }}
            >
              <div
                className="menu-panel"
                onClick={function(e) { e.stopPropagation(); }}
              >
                <div className="menu-title">MENU</div>
                <button
                  className="menu-btn menu-btn-giveup"
                  onClick={function(e) { e.stopPropagation(); giveUp(); }}
                >
                  GIVE UP
                </button>
                <button
                  className="menu-btn menu-btn-collection"
                  onClick={function(e) { e.stopPropagation(); setShowMenu(false); setShowCollection(true); }}
                >
                  COLLECTION ({seenBoons}/{totalBoons})
                </button>
                <button
                  className="menu-btn-close"
                  onClick={function(e) { e.stopPropagation(); setShowMenu(false); }}
                >
                  CLOSE
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
