import { RC } from '../logic.js';

// PhaseOverlay — banners and doom-reveal that appear between wheel spins.
// Handles: growing, victory_grow, doom_approaches, doom_reveal phases.
// Props: phase, doomRevealGroup
export function PhaseOverlay({ phase, doomRevealGroup }) {
  if (phase === 'growing') {
    return (
      <div className="growing-overlay">
        <div className="growing-text">WHEEL GROWS</div>
      </div>
    );
  }
  if (phase === 'victory_grow') {
    return (
      <div className="growing-overlay">
        <div className="growing-text victory-grow-text">VICTORY</div>
      </div>
    );
  }
  if (phase === 'doom_approaches') {
    return (
      <div className="growing-overlay">
        <div className="growing-text doom-approaches-text">DOOM APPROACHES</div>
      </div>
    );
  }
  if (phase === 'doom_reveal' && doomRevealGroup) {
    return (
      <div className="doom-reveal-overlay">
        <div className="doom-reveal-boon">
          <div className="doom-reveal-original">
            <span style={{ color: RC[doomRevealGroup.first.rarity] }}>
              {doomRevealGroup.first.name}{doomRevealGroup.boons.length > 1 ? ' \xd7' + doomRevealGroup.boons.length : ''}
            </span>
          </div>
          <div className="doom-reveal-doom">DOOM</div>
        </div>
      </div>
    );
  }
  return null;
}
