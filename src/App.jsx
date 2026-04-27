import { BOONS } from './logic.js';
import { useGameState } from './useGameState.js';
import { AppHeader } from './components/AppHeader.jsx';
import { Wheel } from './components/Wheel.jsx';
import { BoonStack } from './components/BoonStack.jsx';
import { TileReveal } from './components/TileReveal.jsx';
import { GameOverlay } from './components/GameOverlay.jsx';
import { PhaseOverlay } from './components/PhaseOverlay.jsx';
import { CollectionModal } from './components/CollectionModal.jsx';
import { MenuModal } from './components/MenuModal.jsx';

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

  var isOverlay = phase === 'boon_select' || phase === 'game_over' || phase === 'victory';
  var doomUnlocked = collection.has('doom_unlock');
  var totalBoons = BOONS.length + (doomUnlocked ? 1 : 0);
  var seenBoons = BOONS.filter(function(b) { return collection.has(b.id); }).length + (doomUnlocked ? 1 : 0);

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
        <AppHeader tiles={tiles} boons={boons} gl={gl} sc={sc} />
        <Wheel
          tiles={tiles} boons={boons} flippedTiles={flippedTiles}
          wdeg={wdeg} anim={anim} gl={gl} phase={phase}
          onWheelClick={handleWheelClick} onWheelKeyDown={handleWheelKeyDown}
        />
        <div className="spin-row">
          {phase === 'idle' && (
            <button className="spin-btn" onPointerDown={function(e) { e.stopPropagation(); spin(); }} onClick={function(e) { e.stopPropagation(); }}>
              SPIN
            </button>
          )}
          {(phase === 'spinning' || phase === 'reveal') && (
            <span className="phase-hint">
              {phase === 'spinning' ? 'CLICK ANYWHERE TO RESOLVE' : 'CLICK TO CONTINUE'}
            </span>
          )}
        </div>
        <BoonStack
          displayBoonGroups={displayBoonGroups} shakingGroupKey={shakingGroupKey}
          dragOverIid={dragOverIid} startDragBoon={startDragBoon}
          moveDragBoon={moveDragBoon} endDragBoon={endDragBoon} cancelDragBoon={cancelDragBoon}
        />
      </div>
      <TileReveal phase={phase} rtile={rtile} revealFlip={revealFlip} revealDoom={revealDoom} />
      <GameOverlay
        phase={phase} choices={choices} shopRerolls={shopRerolls}
        shownBoons={shownBoons} displayBoonGroups={displayBoonGroups}
        collection={collection} collectionAtRunStart={collectionAtRunStart}
        victoryIsGameOver={victoryIsGameOver} sc={sc}
        seenBoons={seenBoons} totalBoons={totalBoons}
        pick={pick} rerollChoices={rerollChoices}
        restart={restart} enterEndless={enterEndless} setShowCollection={setShowCollection}
      />
      <PhaseOverlay phase={phase} doomRevealGroup={doomRevealGroup} />
      <CollectionModal
        showCollection={showCollection} collection={collection}
        setShowCollection={setShowCollection} totalBoons={totalBoons} seenBoons={seenBoons}
      />
      <MenuModal
        showMenu={showMenu} setShowMenu={setShowMenu}
        setShowCollection={setShowCollection}
        giveUp={giveUp} seenBoons={seenBoons} totalBoons={totalBoons}
      />
    </div>
  );
}
