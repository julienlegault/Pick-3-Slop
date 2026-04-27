import { BOONS, PROB_DISPLAY_THRESHOLD, buildLayout, isVirtWheel, virtGetCount, virtTotalCount } from './logic.js';
import { useGameState } from './useGameState.js';
import { Wheel } from './components/Wheel.jsx';
import { BoonStack } from './components/BoonStack.jsx';
import { TileReveal } from './components/TileReveal.jsx';
import { PhaseBanner } from './components/PhaseBanner.jsx';
import { GameOverlay } from './components/GameOverlay.jsx';
import { CollectionModal } from './components/CollectionModal.jsx';
import { MenuModal } from './components/MenuModal.jsx';

function formatWinPct(frac) {
  return (Math.round(frac * 1000) / 10) + '% WIN';
}

export function App() {
  var state = useGameState();
  var {
    tiles, boons, sc, gl, phase, wdeg, anim, rtile, choices,
    flippedTiles, revealFlip, revealDoom, dragOverIid,
    collection, showCollection, showMenu,
    doomGroupKeys, collectionAtRunStart, doomRevealGroup, victoryIsGameOver,
    setShowCollection, setShowMenu,
    spin, handleInteract, handleWheelClick, handleWheelKeyDown,
    pick, rerollChoices, restart, enterEndless, giveUp,
    startDragBoon, moveDragBoon, endDragBoon, cancelDragBoon,
    shopRerolls, shownBoons, displayBoonGroups, shakingGroupKey,
  } = state;

  var dl             = buildLayout(tiles, boons, false);
  var isVirt         = isVirtWheel(tiles);
  var wins           = isVirt ? virtGetCount(tiles, 'win') : tiles.filter(function(t) { return t.type === 'win'; }).length;
  var totalTileCount = isVirt ? virtTotalCount(tiles) : tiles.length;
  var totalSz        = gl >= PROB_DISPLAY_THRESHOLD ? dl.reduce(function(s, t) { return s + t.sz; }, 0) : 0;
  var probWinFrac    = gl >= PROB_DISPLAY_THRESHOLD ? (totalSz > 0 ? dl.reduce(function(s, t) { return s + (t.type === 'win' ? t.sz : 0); }, 0) / totalSz : 0.5) : null;
  var isOverlay      = phase === 'boon_select' || phase === 'game_over' || phase === 'victory';
  var doomUnlocked   = collection.has('doom_unlock');
  var totalBoons     = BOONS.length + (doomUnlocked ? 1 : 0);
  var seenBoons      = BOONS.filter(function(b) { return collection.has(b.id); }).length + (doomUnlocked ? 1 : 0);

  return (
    <div
      className="app-root"
      style={{ cursor: phase === 'spinning' || phase === 'reveal' ? 'pointer' : 'default' }}
      onClick={handleInteract}
    >
      {phase !== 'game_over' && phase !== 'victory' && (
        <button className="btn-menu" onClick={function(e) { e.stopPropagation(); setShowMenu(true); }} aria-label="Open menu">
          &#8801;
        </button>
      )}

      <div className={'app-main' + (isOverlay ? ' blurred' : '')}>
        <div className="app-header">
          <h1 className="app-title">PICK 3 SLOP</h1>
          <div className="app-subtitle">
            SPIN {sc} &nbsp;|&nbsp;
            {probWinFrac !== null ? formatWinPct(probWinFrac) : wins + ' / ' + totalTileCount + ' WIN'}
            &nbsp;|&nbsp; LVL {gl}
          </div>
        </div>

        <Wheel wdeg={wdeg} anim={anim} dl={dl} probWinFrac={probWinFrac} gl={gl}
          totalTileCount={totalTileCount} flippedTiles={flippedTiles} phase={phase}
          onWheelClick={handleWheelClick} onWheelKeyDown={handleWheelKeyDown} />

        <div className="spin-row">
          {phase === 'idle' && (
            <button className="spin-btn"
              onPointerDown={function(e) { e.stopPropagation(); spin(); }}
              onClick={function(e) { e.stopPropagation(); }}
            >SPIN</button>
          )}
          {(phase === 'spinning' || phase === 'reveal') && (
            <span className="phase-hint">
              {phase === 'spinning' ? 'CLICK ANYWHERE TO RESOLVE' : 'CLICK TO CONTINUE'}
            </span>
          )}
        </div>

        <BoonStack displayBoonGroups={displayBoonGroups} shakingGroupKey={shakingGroupKey}
          dragOverIid={dragOverIid} startDragBoon={startDragBoon} moveDragBoon={moveDragBoon}
          endDragBoon={endDragBoon} cancelDragBoon={cancelDragBoon} />
      </div>

      <TileReveal phase={phase} rtile={rtile} revealDoom={revealDoom} revealFlip={revealFlip} />
      <PhaseBanner phase={phase} doomRevealGroup={doomRevealGroup} />
      <GameOverlay phase={phase} choices={choices} shopRerolls={shopRerolls}
        displayBoonGroups={displayBoonGroups} shownBoons={shownBoons} sc={sc}
        victoryIsGameOver={victoryIsGameOver} collection={collection}
        collectionAtRunStart={collectionAtRunStart} seenBoons={seenBoons} totalBoons={totalBoons}
        pick={pick} rerollChoices={rerollChoices} restart={restart}
        enterEndless={enterEndless} setShowCollection={setShowCollection} />
      <CollectionModal showCollection={showCollection} collection={collection}
        seenBoons={seenBoons} totalBoons={totalBoons} setShowCollection={setShowCollection} />

      <MenuModal showMenu={showMenu} setShowMenu={setShowMenu} giveUp={giveUp}
        setShowCollection={setShowCollection} seenBoons={seenBoons} totalBoons={totalBoons} />
    </div>
  );
}
