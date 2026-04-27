import {
  RC, BOONS,
  PROB_DISPLAY_THRESHOLD,
  buildLayout, calcAngles,
  isVirtWheel, virtGetCount, virtTotalCount,
  R,
  revealWedge,
} from './logic.js';
import { useGameState } from './useGameState.js';
import { BoonTag } from './components/BoonTag.jsx';
import { Wheel } from './components/Wheel.jsx';

// Divider-suppression constants
var DIVIDER_SKIP_PX  = 3;   // screen-pixels at the outer rim before a divider is suppressed
var SVG_RENDER_PX    = 370; // rendered SVG width in screen-pixels
var SVG_VIEWBOX      = 420; // SVG viewBox width in SVG units
var MERGE_THRESHOLD_DEG = DIVIDER_SKIP_PX * 180 * SVG_VIEWBOX / (R * Math.PI * SVG_RENDER_PX);

function formatWinPct(frac) {
  return (Math.round(frac * 1000) / 10) + '% WIN';
}

export function App() {
  var state = useGameState();
  var {
    tiles, boons, sc, gl, phase, wdeg, anim, rtile, choices,
    flippedTiles, revealFlip, revealDoom, dragOverIid,
    collection, showCollection, showMenu, isEndless,
    doomGroupKeys, collectionAtRunStart, doomRevealGroup, victoryIsGameOver,
    setShowCollection, setShowMenu,
    spin, handleInteract, handleWheelClick, handleWheelKeyDown,
    pick, rerollChoices, restart, enterEndless, giveUp,
    startDragBoon, moveDragBoon, endDragBoon, cancelDragBoon,
    shopRerolls,
    shownBoons, displayBoonGroups, shakingGroupKey,
  } = state;

  var flippedMap = {};
  flippedTiles.forEach(function(id) { flippedMap[id] = true; });

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

  var isOverlay = phase === 'boon_select' || phase === 'game_over' || phase === 'victory';
  var doomUnlocked = collection.has('doom_unlock');
  var totalBoons = BOONS.length + (doomUnlocked ? 1 : 0);
  var seenBoons  = BOONS.filter(function(b) { return collection.has(b.id); }).length + (doomUnlocked ? 1 : 0);

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
        <Wheel
          wdeg={wdeg}
          anim={anim}
          probWinFrac={probWinFrac}
          renderGroups={renderGroups}
          dl={dl}
          da={da}
          flippedMap={flippedMap}
          gl={gl}
          totalTileCount={totalTileCount}
          phase={phase}
          onWheelClick={handleWheelClick}
          onWheelKeyDown={handleWheelKeyDown}
        />

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
                var items = sorted.map(function(b) {
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
                if (collection.has('doom_unlock')) {
                  items.push(
                    <div
                      key="doom_unlock"
                      className="boon-grid-item"
                      style={{
                        border: '1px solid #CC101088',
                        background: 'rgba(180,16,16,.08)',
                      }}
                    >
                      <div className="boon-grid-rarity" style={{ color: '#CC1010' }}>
                        doom
                      </div>
                      <div className="boon-grid-name" style={{ color: '#ccc', fontWeight: 600 }}>
                        DOOM
                      </div>
                    </div>
                  );
                }
                return items;
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
