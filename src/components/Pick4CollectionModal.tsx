import { useState, useRef } from 'react';
import { PICK4_BOON_TEMPLATES, PICK4_RC } from '../pick4Boons';

// Pick4CollectionModal — the boon collection discovery modal for Pick 4.
// Returns null when showCollection is false.
export function Pick4CollectionModal({ showCollection, collection, seenBoons, totalBoons, setShowCollection }) {
  if (!showCollection) return null;

  var rarityOrder = ['common', 'uncommon', 'rare', 'legendary'];
  var sorted = PICK4_BOON_TEMPLATES.slice().sort(function(a, b) {
    var ri = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
    if (ri !== 0) return ri;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  return (
    <Pick4CollectionModalInner
      sorted={sorted}
      collection={collection}
      seenBoons={seenBoons}
      totalBoons={totalBoons}
      setShowCollection={setShowCollection}
    />
  );
}

function Pick4CollectionModalInner({ sorted, collection, seenBoons, totalBoons, setShowCollection }) {
  var [tooltipState, setTooltipState] = useState<{
    boon: any;
    rect: DOMRect;
    pinned: boolean;
  } | null>(null);
  var pinnedRef = useRef(false);

  function openTooltip(b: any, rect: DOMRect, pinIt: boolean) {
    pinnedRef.current = pinIt;
    setTooltipState({ boon: b, rect, pinned: pinIt });
  }

  function clearTooltip() {
    pinnedRef.current = false;
    setTooltipState(null);
  }

  function handleMouseEnter(b: any, e: React.MouseEvent<HTMLDivElement>) {
    if (pinnedRef.current) return;
    openTooltip(b, e.currentTarget.getBoundingClientRect(), false);
  }

  function handleMouseLeave() {
    if (pinnedRef.current) return;
    setTooltipState(null);
  }

  function handleClick(b: any, e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (pinnedRef.current && tooltipState && tooltipState.boon.id === b.id) {
      clearTooltip();
    } else {
      openTooltip(b, e.currentTarget.getBoundingClientRect(), true);
    }
  }

  function handleOverlayClick() {
    clearTooltip();
    setShowCollection(false);
  }

  function handlePanelClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (pinnedRef.current) clearTooltip();
  }

  return (
    <div className="collection-overlay" onClick={handleOverlayClick}>
      {tooltipState && (
        <Pick4CollectionTooltip state={tooltipState} />
      )}
      <div className="collection-panel" onClick={handlePanelClick}>
        <div className="collection-header">
          <div>
            <div className="collection-title">BOON COLLECTION</div>
            <div className="collection-count">{seenBoons} / {totalBoons} DISCOVERED</div>
          </div>
          <button className="btn-close" onClick={function() { clearTooltip(); setShowCollection(false); }}>CLOSE</button>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: (totalBoons > 0 ? (seenBoons / totalBoons * 100) : 0) + '%' }} />
        </div>
        <div className="boon-grid" onScroll={clearTooltip}>
          {sorted.map(function(b) {
            var seen = collection.has(b.id);
            var c = PICK4_RC[b.rarity];
            var isActive = tooltipState && tooltipState.boon.id === b.id && tooltipState.pinned;
            return (
              <div
                key={b.id}
                className="boon-grid-item"
                style={{
                  border: '1px solid ' + (seen ? c + '88' : '#1c1c1c'),
                  background: seen ? (isActive ? c + '1a' : c + '0d') : '#080808',
                  cursor: seen ? 'pointer' : 'default',
                }}
                onMouseEnter={seen ? function(e) { handleMouseEnter(b, e); } : undefined}
                onMouseLeave={seen ? handleMouseLeave : undefined}
                onClick={seen ? function(e) { handleClick(b, e); } : undefined}
              >
                <div className="boon-grid-rarity" style={{ color: seen ? c : '#2a2a2a' }}>{b.rarity}</div>
                <div className="boon-grid-name" style={{ color: seen ? '#ccc' : '#2a2a2a', fontWeight: seen ? 600 : 400 }}>
                  {seen ? b.name : '???'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Pick4CollectionTooltip({ state }: { state: { boon: any; rect: DOMRect; pinned: boolean } }) {
  var b = state.boon;
  var c = PICK4_RC[b.rarity];

  var gap = 8;
  var showBelow = state.rect.top < 200;
  var left = state.rect.left + state.rect.width / 2;
  var top = showBelow
    ? state.rect.bottom + gap
    : state.rect.top - gap;
  var transform = showBelow ? 'translateX(-50%)' : 'translateX(-50%) translateY(-100%)';

  return (
    <div
      className="collection-boon-tip"
      style={{
        position: 'fixed',
        left: left,
        top: top,
        transform: transform,
        border: '1px solid ' + c,
        boxShadow: '0 4px 24px rgba(0,0,0,.8), 0 0 12px ' + c + '30',
      }}
      onClick={function(e) { e.stopPropagation(); }}
    >
      <span className="boon-tip-rarity" style={{ color: c }}>{b.rarity}</span>
      <span className="boon-tip-name">{b.name}</span>
      <span className="boon-tip-desc">{b.desc}</span>
      {showBelow
        ? <span className="tip-arrow tip-arrow-up" style={{ borderBottom: '7px solid ' + c }} />
        : <span className="tip-arrow" style={{ borderTop: '7px solid ' + c }} />
      }
    </div>
  );
}
