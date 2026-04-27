// MenuModal — the pause / give-up menu modal.
// Returns null when showMenu is false.
export function MenuModal({ showMenu, setShowMenu, giveUp, setShowCollection, seenBoons, totalBoons }) {
  if (!showMenu) return null;
  return (
    <div className="menu-overlay" onClick={function(e) { e.stopPropagation(); setShowMenu(false); }}>
      <div className="menu-panel" onClick={function(e) { e.stopPropagation(); }}>
        <div className="menu-title">MENU</div>
        <button className="menu-btn menu-btn-giveup" onClick={function(e) { e.stopPropagation(); giveUp(); }}>
          GIVE UP
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
  );
}
