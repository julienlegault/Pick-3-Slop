
import { revealWedge } from '../wheel';
import type { RevealTile } from '../types';

interface TileRevealProps {
  rtile: RevealTile;
  revealFlip: boolean;
}

export default function TileReveal({ rtile, revealFlip }: TileRevealProps) {
  var isRescued = rtile.baseType === 'lose' && rtile.type === 'win';
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)',
    }}>
      <div style={{
        animation: 'tileReveal .54s cubic-bezier(0.22, 1, 0.36, 1) both',
        transformStyle: 'preserve-3d',
      }}>
        <svg width={310} height={260} overflow="visible">
          <g style={isRescued ? {
            animation: 'revealRescueFlip .45s ease',
            transformBox: 'fill-box' as any,
            transformOrigin: 'center',
          } : undefined}>
            <path
              d={revealWedge(rtile.halfSpan)}
              fill={(isRescued && !revealFlip) ? '#242424' : (rtile.type === 'win' ? '#d4d4d4' : '#242424')}
              stroke={(isRescued && !revealFlip) ? '#555' : (rtile.type === 'win' ? '#888' : '#555')}
              strokeWidth={2}
              style={isRescued ? {
                animation: 'loseFlipToWin .45s ease',
                transformBox: 'fill-box' as any,
                transformOrigin: 'center',
              } : undefined}
            />
            <text
              x={160} y={132}
              textAnchor="middle" dominantBaseline="middle"
              fontFamily="'Cinzel', serif" fontWeight="700"
              fontSize={20} letterSpacing="3"
              fill={(isRescued && !revealFlip) ? '#d0d0d0' : (rtile.type === 'win' ? '#1a1a1a' : '#d0d0d0')}
            >
              {(isRescued && !revealFlip) ? 'x LOSE x' : (rtile.type === 'win' ? '* WIN *' : 'x LOSE x')}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
