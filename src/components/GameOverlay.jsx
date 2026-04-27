import { RC } from '../logic.js';
import { BoonTag } from './BoonTag.jsx';

// GameOverlay — the full-screen modal for boon-shop, game-over, and victory phases.
// Props: phase, choices, shopRerolls, shownBoons, displayBoonGroups, collection,
//        collectionAtRunStart, victoryIsGameOver, sc, seenBoons, totalBoons,
//        pick, rerollChoices, restart, enterEndless, setShowCollection
export function GameOverlay({
  phase, choices, shopRerolls, shownBoons, displayBoonGroups,
  collection, collectionAtRunStart, victoryIsGameOver, sc,
  seenBoons, totalBoons,
  pick, rerollChoices, restart, enterEndless, setShowCollection,
}) {
  var isOverlay = phase === 'boon_select' || phase === 'game_over' || phase === 'victory';
  if (!isOverlay) return null;

  return (
    <div
      className="game-overlay"
      onClick={function(e) { e.stopPropagation(); }}
    >
      {phase === 'boon_select' && (
        <div className="shop-panel">
          <div className="shop-label">CHOOSE A BOON</div>
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
                  <div className="boon-card-rarity" style={{ color: RC[b.rarity] }}>{b.rarity}</div>
                  <div className="boon-card-name">{b.name}</div>
                  <div className="boon-card-desc">{b.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {phase === 'game_over' && (
        <div className="game-over-panel">
          <div className="eliminated-text">ELIMINATED</div>
          <div className="spins-survived">{sc} SPINS SURVIVED</div>
          {shownBoons.length > 0 && (
            <div className="final-boons">
              <div className="final-boons-label">FINAL BOON STACK</div>
              <div className="final-boons-items">
                {displayBoonGroups.map(function(b) {
                  return <BoonTag key={'go_' + b.iid} b={b} large={true} />;
                })}
              </div>
            </div>
          )}
          <button className="again-btn" onClick={function(e) { e.stopPropagation(); restart(); }}>
            PLAY AGAIN
          </button>
          <button className="btn-view-collection" onClick={function(e) { e.stopPropagation(); setShowCollection(true); }}>
            VIEW COLLECTION ({seenBoons}/{totalBoons})
          </button>
        </div>
      )}

      {phase === 'victory' && (
        <div className="victory-panel">
          <div className={victoryIsGameOver ? 'eliminated-text' : 'victory-title'}>
            {victoryIsGameOver ? 'GAME OVER' : 'VICTORY!'}
          </div>
          <div className="spins-survived">{sc} SPINS SURVIVED</div>
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
              <button className="victory-btn victory-btn-endless" onClick={function(e) { e.stopPropagation(); enterEndless(); }}>
                ENDLESS
              </button>
            )}
            <button className="victory-btn victory-btn-collection" onClick={function(e) { e.stopPropagation(); setShowCollection(true); }}>
              COLLECTION
            </button>
            <button className="victory-btn victory-btn-restart" onClick={function(e) { e.stopPropagation(); restart(); }}>
              START OVER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
