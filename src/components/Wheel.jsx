import { CX, CY, R, slicePath } from '../logic.js';

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
//   wdeg          current rotation in degrees
//   anim          whether the CSS spin transition is active
//   probWinFrac   null or a 0–1 fraction used for the two-sector probabilistic display (gl ≥ PROB_DISPLAY_THRESHOLD)
//   renderGroups  pre-computed merged tile groups (empty when probWinFrac is active)
//   dl            display layout (tile descriptors with type/id/sz)
//   da            display angles (start/end degrees per tile)
//   flippedMap    { [tileId]: true } for tiles currently animating a win-overtake flip
//   gl            growth level (tile counter shown at gl ≥ 3)
//   totalTileCount total tile count to display in the counter
//   phase         current game phase (controls tabIndex)
//   onWheelClick  click handler for the container
//   onWheelKeyDown keyDown handler for the container
export function Wheel({ wdeg, anim, probWinFrac, renderGroups, dl, da, flippedMap, gl, totalTileCount, phase, onWheelClick, onWheelKeyDown }) {
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
