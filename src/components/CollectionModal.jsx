import { BOONS, RC } from '../logic.js';

// CollectionModal — the boon collection discovery modal.
// Returns null when showCollection is false.
export function CollectionModal({ showCollection, collection, seenBoons, totalBoons, setShowCollection }) {
  if (!showCollection) return null;

  var rarityOrder = ['common', 'uncommon', 'rare', 'legendary'];
  var sorted = BOONS.slice().sort(function(a, b) {
    var ri = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
    if (ri !== 0) return ri;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  return (
    <div className="collection-overlay" onClick={function() { setShowCollection(false); }}>
      <div className="collection-panel" onClick={function(e) { e.stopPropagation(); }}>
        <div className="collection-header">
          <div>
            <div className="collection-title">BOON COLLECTION</div>
            <div className="collection-count">{seenBoons} / {totalBoons} DISCOVERED</div>
          </div>
          <button className="btn-close" onClick={function() { setShowCollection(false); }}>CLOSE</button>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: (totalBoons > 0 ? (seenBoons / totalBoons * 100) : 0) + '%' }} />
        </div>
        <div className="boon-grid">
          {sorted.map(function(b) {
            var seen = collection.has(b.id);
            var c = RC[b.rarity];
            return (
              <div key={b.id} className="boon-grid-item" style={{
                border: '1px solid ' + (seen ? c + '88' : '#1c1c1c'),
                background: seen ? c + '0d' : '#080808',
              }}>
                <div className="boon-grid-rarity" style={{ color: seen ? c : '#2a2a2a' }}>{b.rarity}</div>
                <div className="boon-grid-name" style={{ color: seen ? '#ccc' : '#2a2a2a', fontWeight: seen ? 600 : 400 }}>
                  {seen ? b.name : '???'}
                </div>
              </div>
            );
          })}
          {collection.has('doom_unlock') && (
            <div key="doom_unlock" className="boon-grid-item" style={{ border: '1px solid #CC101088', background: 'rgba(180,16,16,.08)' }}>
              <div className="boon-grid-rarity" style={{ color: '#CC1010' }}>doom</div>
              <div className="boon-grid-name" style={{ color: '#ccc', fontWeight: 600 }}>DOOM</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
