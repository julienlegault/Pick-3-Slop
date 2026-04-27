import { PROB_DISPLAY_THRESHOLD, buildLayout, calcAngles, isVirtWheel, virtGetCount, virtTotalCount } from '../logic.js';

function formatWinPct(frac) {
  return (Math.round(frac * 1000) / 10) + '% WIN';
}

// AppHeader — title row with spin counter, win ratio, and level.
// Props: tiles, boons, gl, sc
export function AppHeader({ tiles, boons, gl, sc }) {
  var dl = buildLayout(tiles, boons, false);
  var isVirt = isVirtWheel(tiles);
  var wins = isVirt ? virtGetCount(tiles, 'win') : tiles.filter(function(t) { return t.type === 'win'; }).length;
  var totalTileCount = isVirt ? virtTotalCount(tiles) : tiles.length;

  var probWinFrac = null;
  if (gl >= PROB_DISPLAY_THRESHOLD) {
    var totalSz = dl.reduce(function(s, t) { return s + t.sz; }, 0);
    var winSz = dl.reduce(function(s, t) { return s + (t.type === 'win' ? t.sz : 0); }, 0);
    probWinFrac = totalSz > 0 ? winSz / totalSz : 0.5;
  }

  return (
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
  );
}
