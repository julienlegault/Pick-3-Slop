import React, { useState, useRef, useCallback, useEffect } from 'react';
import { INIT_TILES, LAND } from './constants';
import { buildLayout, calcAngles, pickWeighted, prepareSpin } from './wheel';
import { drawBoons, getShopRerolls, rerollShop } from './shop';
import { tryRescue } from './rescue';
import { applyBoon } from './applyBoon';
import BoonTag from './components/BoonTag';
import WheelView from './components/WheelView';
import TileReveal from './components/TileReveal';
import BoonShop from './components/BoonShop';
import GameOver from './components/GameOver';
import WheelGrows from './components/WheelGrows';
import type { Tile, Boon, SpinData, RevealTile } from './types';

export default function App() {
  var MAX_DEAD_ZONE_RETRIES = 18;
  var [tiles, setTiles] = useState<Tile[]>(INIT_TILES);
  var [boons, setBoons] = useState<Boon[]>([]);
  var [sc, setSc] = useState(0);
  var [gl, setGl] = useState(0);
  var [phase, setPhase] = useState('idle');
  var [wdeg, setWdeg] = useState(0);
  var [anim, setAnim] = useState(false);
  var [rtile, setRtile] = useState<RevealTile | null>(null);
  var [choices, setChoices] = useState<Boon[]>([]);
  var [nid, setNid] = useState(6);
  var [shopsSeen, setShopsSeen] = useState(0);
  var [flippedTiles, setFlippedTiles] = useState<(number | string)[]>([]);
  var [shakingBoon, setShakingBoon] = useState<string | null>(null);
  var [revealFlip, setRevealFlip] = useState(false);
  var [dragIid, setDragIid] = useState<string | null>(null);
  var [dragOverIid, setDragOverIid] = useState<string | null>(null);
  var [nonCommonPickStreak, setNonCommonPickStreak] = useState(0);

  var spinRef = useRef<SpinData | null>(null);
  var t1 = useRef<any>(null), t2 = useRef<any>(null), t3 = useRef<any>(null), t4 = useRef<any[]>([]);
  var doneRef = useRef(false);
  var revDone = useRef(false);

  var nChoices = 3 + boons.filter(function(b) { return b.effect === 'extra_choice'; }).length;
  var shopRerolls = getShopRerolls(boons, gl);

  var advance = useCallback(function() {
    if (revDone.current) return;
    revDone.current = true;
    clearTimeout(t2.current);
    var d = spinRef.current;
    if (!d) return;
    if (d.result === 'win') {
      var shop = drawBoons(d.nc, d.gl, d.fb, {
        firstShop: d.shopsSeen === 0,
        nonCommonPickStreak: d.nonCommonPickStreak,
      });
      setBoons(shop.boons);
      setChoices(shop.choices);
      setShopsSeen(function(n) { return n + 1; });
      setPhase('boon_select');
    }
    else setPhase('game_over');
  }, []);

  var finalizeReveal = useCallback(function(d: SpinData) {
    setAnim(false);
    setWdeg(d.targetDeg);
    setBoons(d.fb);
    setRtile({ type: d.result, baseType: d.baseType, halfSpan: d.halfSpan });
    setRevealFlip(false);
    setPhase('reveal');
    setSc(function(n) { return n + 1; });
    revDone.current = false;
    t2.current = setTimeout(advance, 720);
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
      var idx = 0;
      function step() {
        if (idx >= chain.length) {
          setShakingBoon(null);
          finalizeReveal(d!);
          return;
        }
        setShakingBoon(chain[idx++]);
        var tid = setTimeout(function() { step(); }, 180);
        t4.current.push(tid);
      }
      step();
    } else {
      finalizeReveal(d);
    }
  }, [finalizeReveal]);

  var spin = useCallback(function() {
    if (phase !== 'idle') return;
    var prep = prepareSpin(tiles, boons);
    var spinTiles = prep.tiles;
    var spinBoons = prep.boons;
    setTiles(spinTiles);
    var layout = buildLayout(spinTiles, spinBoons, true);
    var angles = calcAngles(layout);
    var idx = pickWeighted(layout);
    var guard = MAX_DEAD_ZONE_RETRIES;
    while (layout[idx].type === 'dead' && guard-- > 0) idx = pickWeighted(layout);
    var tc = angles[idx].center;
    var hs = (angles[idx].end - angles[idx].start) / 2;
    var cm = wdeg % 360;
    var delta = ((LAND - tc - cm) % 360 + 360) % 360;
    var target = wdeg + (5 + Math.floor(Math.random() * 4)) * 360 + delta;

    var landed = layout[idx].type;
    var result: 'win' | 'lose' = landed as 'win' | 'lose';
    var fb = spinBoons;
    var triggered: string[] = [];
    if (landed === 'lose') {
      var res = tryRescue(spinBoons);
      result = res.ok ? 'win' : 'lose';
      fb = res.boons;
      triggered = res.triggered || [];
    }

    spinRef.current = {
      targetDeg: target, result: result, baseType: landed as any,
      triggered: triggered, fb: fb, nc: nChoices, halfSpan: hs,
      gl: gl, shopsSeen: shopsSeen, nonCommonPickStreak: nonCommonPickStreak,
    };
    doneRef.current = false;
    setAnim(true);
    setWdeg(target);
    setPhase('spinning');
    t1.current = setTimeout(finish, 3500);
  }, [phase, tiles, boons, wdeg, nChoices, gl, shopsSeen, nonCommonPickStreak, finish]);

  var handleClick = useCallback(function() {
    if (phase === 'spinning') finish();
    else if (phase === 'reveal') advance();
  }, [phase, finish, advance]);

  useEffect(function() {
    if (phase !== 'reveal' || !rtile) return;
    if (rtile.baseType === 'lose' && rtile.type === 'win') {
      var tid = setTimeout(function() { setRevealFlip(true); }, 140);
      return function() { clearTimeout(tid); };
    }
  }, [phase, rtile]);

  var pick = useCallback(function(boon: Boon) {
    var res = applyBoon(boon, tiles, boons, nid);
    setTiles(res.tiles);
    setBoons(res.boons);
    setNid(res.nextId);
    setChoices([]);
    setFlippedTiles(res.flippedIds || []);
    if (res.flippedIds && res.flippedIds.length > 0) {
      setTimeout(function() { setFlippedTiles([]); }, 560);
    }
    if (res.grew) {
      setGl(function(g) { return g + 1; });
      setPhase('growing');
      t3.current = setTimeout(function() { setPhase('idle'); }, 1900);
    } else {
      setPhase('idle');
    }
    setNonCommonPickStreak(function(streak) {
      return boon.rarity === 'common' ? 0 : (streak + 1);
    });
  }, [tiles, boons, nid]);

  var rerollChoices = useCallback(function() {
    if (phase !== 'boon_select') return;
    var rr = rerollShop(nChoices, gl, boons, { nonCommonPickStreak: nonCommonPickStreak });
    if (!rr.ok) return;
    setBoons(rr.boons);
    setChoices(rr.choices);
  }, [phase, nChoices, gl, boons, nonCommonPickStreak]);

  var restart = useCallback(function() {
    [t1, t2, t3].forEach(function(r) { clearTimeout(r.current); });
    t4.current.forEach(function(tid) { clearTimeout(tid); });
    t4.current = [];
    doneRef.current = true;
    revDone.current = true;
    spinRef.current = null;
    setTiles(INIT_TILES);
    setBoons([]); setSc(0); setGl(0); setPhase('idle');
    setWdeg(0); setAnim(false); setRtile(null);
    setFlippedTiles([]); setShakingBoon(null); setRevealFlip(false);
    setDragIid(null); setDragOverIid(null);
    setChoices([]); setNid(6); setShopsSeen(0); setNonCommonPickStreak(0);
  }, []);

  var shownBoons = boons.filter(function(b) { return b.effect !== 'add_win'; });
  var flippedMap: Record<string | number, boolean> = {};
  flippedTiles.forEach(function(id) { flippedMap[id] = true; });

  var startDragBoon = useCallback(function(iid: string) {
    setDragIid(iid);
  }, []);

  var overDragBoon = useCallback(function(e: React.DragEvent, iid: string) {
    if (!dragIid || dragIid === iid) return;
    e.preventDefault();
    setDragOverIid(iid);
  }, [dragIid]);

  var dropDragBoon = useCallback(function(e: React.DragEvent, iid: string) {
    e.preventDefault();
    if (!dragIid || dragIid === iid) return;
    setBoons(function(prev) {
      var src = prev.findIndex(function(b) { return b.iid === dragIid; });
      var dst = prev.findIndex(function(b) { return b.iid === iid; });
      if (src < 0 || dst < 0) return prev;
      var next = prev.slice();
      var moved = next.splice(src, 1)[0];
      next.splice(dst, 0, moved);
      return next;
    });
    setDragIid(null);
    setDragOverIid(null);
  }, [dragIid]);

  var endDragBoon = useCallback(function() {
    setDragIid(null);
    setDragOverIid(null);
  }, []);

  var dl = buildLayout(tiles, boons, false);
  var da = calcAngles(dl);
  var wins = tiles.filter(function(t) { return t.type === 'win'; }).length;
  var isOverlay = phase === 'boon_select' || phase === 'game_over';

  return (
    <div
      style={{
        minHeight: '100vh', background: '#0f0f0f', color: '#e0e0e0',
        fontFamily: "'Cinzel', serif",
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 12px 38px',
        cursor: phase === 'spinning' || phase === 'reveal' ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      onClick={handleClick}
    >
      <div style={{
        width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        filter: isOverlay ? 'blur(6px)' : 'none',
        transition: 'filter .35s',
        pointerEvents: isOverlay ? 'none' : 'auto',
      }}>
        <h1 style={{
          fontSize: 'clamp(1.25rem, 3.2vw, 1.72rem)', letterSpacing: '.28em',
          color: '#D4AF37', margin: '0 0 4px', fontWeight: 700,
          textShadow: '0 0 24px rgba(212,175,55,.22)',
        }}>PICK 3 SLOP</h1>
        <div style={{ fontFamily: 'monospace', fontSize: '.68rem', color: '#2c2c2c', letterSpacing: '.32em', marginBottom: '12px' }}>
          SPIN {sc} &nbsp;|&nbsp; {wins} / {tiles.length} WIN &nbsp;|&nbsp; LVL {gl}
        </div>

        <WheelView wdeg={wdeg} anim={anim} dl={dl} da={da} flippedMap={flippedMap} />

        <div style={{ height: 45, display: 'flex', alignItems: 'center', marginTop: '4px' }}>
          {phase === 'idle' && (
            <button
              className="spin-btn"
              onClick={function(e) { e.stopPropagation(); spin(); }}
              style={{
                padding: '9px 42px', background: 'transparent',
                border: '2px solid #D4AF37', color: '#D4AF37',
                fontSize: '.82rem', fontFamily: "'Cinzel', serif",
                letterSpacing: '.4em', cursor: 'pointer',
                transition: 'background .15s, box-shadow .15s',
                boxShadow: '0 0 14px rgba(212,175,55,.1)',
              }}
            >
              SPIN
            </button>
          )}
          {(phase === 'spinning' || phase === 'reveal') && (
            <span style={{ fontSize: '.62rem', letterSpacing: '.32em', color: '#2b2b2b', animation: 'blink 1.3s infinite' }}>
              {phase === 'spinning' ? 'CLICK ANYWHERE TO RESOLVE' : 'CLICK TO CONTINUE'}
            </span>
          )}
        </div>

        {shownBoons.length > 0 && (
          <div style={{
            marginTop: '10px', width: '100%', maxWidth: '680px',
            background: 'rgba(8,8,8,0.9)', border: '1px solid #1e1e1e',
            borderRadius: '4px', padding: '8px 11px',
          }}>
            <div style={{ fontSize: '.5rem', letterSpacing: '.35em', color: '#444', marginBottom: '5px' }}>
              BOON STACK &mdash; DRAG TO REORDER | HOVER OR CLICK TO INSPECT
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {shownBoons.map(function(b, i) {
                return (
                  <BoonTag
                    key={(b.iid || b.id) + '_' + i}
                    b={b}
                    shaking={shakingBoon === (b.iid || (b.id + '_' + i))}
                    draggable={true}
                    dropTarget={dragOverIid === b.iid}
                    onDragStart={function(e) { e.stopPropagation(); startDragBoon(b.iid); }}
                    onDragOver={function(e) { overDragBoon(e, b.iid); }}
                    onDrop={function(e) { e.stopPropagation(); dropDragBoon(e, b.iid); }}
                    onDragEnd={endDragBoon}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {phase === 'reveal' && rtile && (
        <TileReveal rtile={rtile} revealFlip={revealFlip} />
      )}

      {isOverlay && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(6,6,6,.82)',
            padding: '14px', overflowY: 'auto',
            animation: 'overlayIn .3s ease',
          }}
          onClick={function(e) { e.stopPropagation(); }}
        >
          {phase === 'boon_select' && (
            <BoonShop
              choices={choices}
              shopRerolls={shopRerolls}
              onPick={pick}
              onReroll={rerollChoices}
            />
          )}
          {phase === 'game_over' && (
            <GameOver sc={sc} shownBoons={shownBoons} onRestart={restart} />
          )}
        </div>
      )}

      {phase === 'growing' && <WheelGrows />}
    </div>
  );
}
