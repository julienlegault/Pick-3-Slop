import {
  CX, CY, R, slicePath,
  PROB_DISPLAY_THRESHOLD, buildLayout, calcAngles,
  isVirtWheel, virtTotalCount,
} from '../logic.js';

// Divider-suppression constants (suppress thin slices at the rim)
var DIVIDER_SKIP_PX  = 3;
var SVG_RENDER_PX    = 370;
var SVG_VIEWBOX      = 420;
var MERGE_THRESHOLD_DEG = DIVIDER_SKIP_PX * 180 * SVG_VIEWBOX / (R * Math.PI * SVG_RENDER_PX);

function tileColor(type) {
  return type === 'win' ? '#d4d4d4' : '#1e1e1e';
}

function formatTileCount(n) {
  var SCIENTIFIC_NOTATION_THRESHOLD = 1e14;
  if (n >= SCIENTIFIC_NOTATION_THRESHOLD) return n.toExponential(2);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Wheel — the spinning SVG wheel and its container.
// Props:
//   tiles         current tile array
//   boons         current boon array (for layout)
//   flippedTiles  array of tile IDs currently animating a win-overtake flip
//   gl            growth level (tile counter shown at gl ≥ 3)
//   wdeg          current rotation in degrees
//   anim          whether the CSS spin transition is active
//   phase         current game phase (controls tabIndex)
//   onWheelClick  click handler for the container
//   onWheelKeyDown keyDown handler for the container
export function Wheel({ tiles, boons, flippedTiles, gl, wdeg, anim, phase, onWheelClick, onWheelKeyDown }) {
  var dl = buildLayout(tiles, boons, false);
  var da = calcAngles(dl);

  var flippedMap = {};
  flippedTiles.forEach(function(id) { flippedMap[id] = true; });

  var isVirt = isVirtWheel(tiles);
  var totalTileCount = isVirt ? virtTotalCount(tiles) : tiles.length;

  var probWinFrac = null;
  if (gl >= PROB_DISPLAY_THRESHOLD) {
    var totalSz = dl.reduce(function(s, t) { return s + t.sz; }, 0);
    var winSz = dl.reduce(function(s, t) { return s + (t.type === 'win' ? t.sz : 0); }, 0);
    probWinFrac = totalSz > 0 ? winSz / totalSz : 0.5;
  }

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
  return (
    <div
      className="wheel-wrap"
      onClick={onWheelClick}
      onKeyDown={onWheelKeyDown}
      role="button"
      aria-label="Spin wheel"
      tabIndex={phase === 'idle' ? 0 : -1}
    >
      {/* Right-side pointer */}
      <div className="wheel-pointer" />

      <svg width={370} height={370} viewBox="0 0 420 420" style={{
        transform: 'rotate(' + wdeg + 'deg)',
        transition: anim ? 'transform 3.4s cubic-bezier(0.14, 0.58, 0.08, 1.0)' : 'none',
      }}>
        <circle cx={CX} cy={CY} r={R + 5} fill="none" stroke="#2a2a2a" strokeWidth={2} />
        {probWinFrac !== null ? (
          /* Probabilistic two-sector wheel (gl >= PROB_DISPLAY_THRESHOLD) */
          (function() {
            var winDeg  = probWinFrac * 360;
            var loseDeg = 360 - winDeg;
            return (
              <>
                {winDeg  > 0.01 && <path d={slicePath(0, winDeg)}         fill="#d4d4d4" stroke="#0f0f0f" strokeWidth={1.5} />}
                {loseDeg > 0.01 && <path d={slicePath(winDeg, 360)}        fill="#1e1e1e" stroke="#0f0f0f" strokeWidth={1.5} />}
              </>
            );
          })()
        ) : renderGroups.map(function(group, gi) {
          // Any tile in this group undergoing the flip animation? → render individually.
          var hasFlipped = group.items.some(function(idx) { return flippedMap[dl[idx].id] && dl[idx].type === 'win'; });
          if (hasFlipped) {
            return group.items.map(function(idx) {
              var t = dl[idx], a = da[idx];
              if (flippedMap[t.id] && t.type === 'win') {
                return (
                  <g key={t.id}>
                    <path d={slicePath(a.start, a.end)} fill="#1e1e1e" stroke="#0f0f0f" strokeWidth={1.5} />
                    <path d={slicePath(a.start, a.end)} fill="#d4d4d4" stroke="#0f0f0f" strokeWidth={1.5} style={{ animation: 'edgeOvertake .55s ease both' }} />
                  </g>
                );
              }
              return <path key={t.id} d={slicePath(a.start, a.end)} fill={tileColor(t.type)} stroke="#0f0f0f" strokeWidth={1.5} />;
            });
          }
          // Render entire merged group as a single path — no internal dividers.
          return (
            <path key={'g' + gi} d={slicePath(group.startAngle, group.endAngle)} fill={tileColor(group.type)} stroke="#0f0f0f" strokeWidth={1.5} />
          );
        })}
        <circle cx={CX} cy={CY} r={17} fill="#0f0f0f" stroke="#333" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={5.5} fill="#3a3a3a" />
      </svg>

      {/* Tile counter — static overlay (does not rotate with wheel), shown after 3rd growth */}
      {gl >= 3 && (
        <div className="tile-counter">
          {formatTileCount(totalTileCount)}
        </div>
      )}
    </div>
  );
}
