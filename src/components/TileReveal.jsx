import { revealWedge } from '../logic.js';

// TileReveal — the animated reveal card that slides in from the right after landing.
// Props: phase, rtile, revealFlip, revealDoom
export function TileReveal({ phase, rtile, revealFlip, revealDoom }) {
  if (phase !== 'reveal' || !rtile) return null;
  return (
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
  );
}
