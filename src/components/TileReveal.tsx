import { revealWedge } from '../logic';
import { RC } from '../logic';

// CrackTag — renders a boon label that visually cracks in half after a short delay.
// Uses two overlapping clipped spans (top/bottom halves) that animate apart.
function CrackTag({ name, color, background, delay }: { name: string; color: string; background: string; delay: number }) {
  var halfStyle = {
    border: '1px solid ' + color,
    color: color,
    background: background,
    padding: '3px 8px',
    fontSize: '.62rem',
    fontFamily: "'Cinzel', serif",
    borderRadius: '2px',
    whiteSpace: 'nowrap' as const,
    display: 'inline-block',
  };
  return (
    <span style={{ position: 'relative', display: 'inline-block', overflow: 'visible' }}>
      {/* top half */}
      <span style={{
        ...halfStyle,
        clipPath: 'inset(0 0 50% 0)',
        animationName: 'boonCrackTop',
        animationDuration: '0.42s',
        animationDelay: delay + 's',
        animationFillMode: 'forwards',
        animationTimingFunction: 'ease-in',
      }}>
        {name}
      </span>
      {/* bottom half — absolutely overlaid on the top half */}
      <span style={{
        ...halfStyle,
        position: 'absolute',
        top: 0,
        left: 0,
        clipPath: 'inset(50% 0 0 0)',
        animationName: 'boonCrackBottom',
        animationDuration: '0.42s',
        animationDelay: delay + 's',
        animationFillMode: 'forwards',
        animationTimingFunction: 'ease-in',
      }}>
        {name}
      </span>
    </span>
  );
}

// TileReveal — the reveal overlay card shown during the 'reveal' phase.
// Returns null when phase !== 'reveal' or rtile is absent.
export function TileReveal({ phase, rtile, revealDoom, revealFlip }) {
  if (phase !== 'reveal' || !rtile) return null;

  var textFill = rtile.isDoom
    ? (revealFlip
      ? (rtile.type === 'win' ? '#1a1a1a' : '#d0d0d0')
      : (revealDoom ? '#d0d0d0' : '#1a1a1a'))
    : (rtile.baseType === 'lose' && rtile.type === 'win')
      ? (revealFlip ? '#1a1a1a' : '#d0d0d0')
      : (rtile.type === 'win' ? '#1a1a1a' : '#d0d0d0');

  var textStyle = rtile.isDoom
    ? ((revealDoom || revealFlip) ? { animation: 'rescueTextFade .3s ease' } : null)
    : (rtile.baseType === 'lose' && rtile.type === 'win' && revealFlip) ? { animation: 'rescueTextFade .3s ease' } : null;

  var textLabel = rtile.isDoom
    ? (revealFlip ? (rtile.type === 'win' ? 'SAVED!' : 'x LOSE x') : (revealDoom ? 'DOOM' : '* WIN *'))
    : (rtile.baseType === 'lose' && rtile.type === 'win')
      ? (revealFlip ? 'SAVED!' : 'x LOSE x')
      : (rtile.type === 'win' ? '* WIN *' : 'x LOSE x');

  var showSavedBoon = revealFlip && rtile.savedByBoon && (
    (!rtile.isDoom && rtile.baseType === 'lose' && rtile.type === 'win') ||
    (rtile.isDoom && rtile.type === 'win')
  );

  return (
    <div className="reveal-overlay">
      <div className="reveal-card" style={{ position: 'relative' }}>
        <svg width={310} height={260} overflow="visible">
          <g>
            {rtile.isDoom ? (
              <>
                <path d={revealWedge(rtile.halfSpan)} fill="#d4d4d4" stroke="#888" strokeWidth={2} />
                {revealDoom && !revealFlip && (
                  <path d={revealWedge(rtile.halfSpan)} fill="#CC1010" stroke="#990000" strokeWidth={2}
                    style={{ animation: 'edgeOvertake .45s ease both' }} />
                )}
                {revealFlip && (
                  <path d={revealWedge(rtile.halfSpan)}
                    fill={rtile.type === 'win' ? '#D4AF37' : '#242424'}
                    stroke={rtile.type === 'win' ? '#b8962a' : '#555'}
                    strokeWidth={2} style={{ animation: 'edgeOvertake .45s ease both' }} />
                )}
              </>
            ) : (rtile.baseType === 'lose' && rtile.type === 'win') ? (
              <>
                <path d={revealWedge(rtile.halfSpan)} fill="#242424" stroke="#555" strokeWidth={2} />
                {revealFlip && (
                  <path d={revealWedge(rtile.halfSpan)} fill="#D4AF37" stroke="#b8962a" strokeWidth={2}
                    style={{ animation: 'edgeOvertake .45s ease both' }} />
                )}
              </>
            ) : (
              <path d={revealWedge(rtile.halfSpan)}
                fill={rtile.type === 'win' ? '#d4d4d4' : '#242424'}
                stroke={rtile.type === 'win' ? '#888' : '#555'}
                strokeWidth={2} />
            )}
            <text x={160} y={132}
              textAnchor="middle" dominantBaseline="middle"
              fontFamily="'Cinzel', serif" fontWeight="700"
              fontSize={20} letterSpacing="3"
              fill={textFill} style={textStyle}
            >
              {textLabel}
            </text>
          </g>
        </svg>
        {showSavedBoon && (function() {
          var sb = rtile.savedByBoon;
          var sc = RC[sb.rarity] || '#909090';
          var savedConsumed = !!rtile.savedBoonConsumed;
          // Crack animation delay from when tags mount (rescueTextFade is 0.3s; crack starts 0.2s after fade)
          var crackDelay = 0.5;
          return (
            <div style={{
              position: 'absolute',
              top: '72px',
              left: '210px',
              transform: 'rotate(45deg)',
              transformOrigin: '0 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              alignItems: 'flex-start',
              animation: 'rescueTextFade .3s ease',
              pointerEvents: 'none',
            }}>
              {savedConsumed ? (
                <CrackTag name={sb.name} color={sc} background="rgba(10,10,10,0.88)" delay={crackDelay} />
              ) : (
                <span style={{
                  border: '1px solid ' + sc,
                  color: sc,
                  background: 'rgba(10,10,10,0.88)',
                  padding: '3px 8px',
                  fontSize: '.62rem',
                  fontFamily: "'Cinzel', serif",
                  borderRadius: '2px',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                }}>
                  {sb.name}
                </span>
              )}
              {rtile.sacrificedBoon && (
                <CrackTag name={rtile.sacrificedBoon.name} color="#ff4444" background="rgba(10,10,10,0.88)" delay={crackDelay} />
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
