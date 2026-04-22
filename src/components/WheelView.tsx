
import { CX, CY, R } from '../constants';
import { slicePath } from '../wheel';
import type { LayoutTile, AngleEntry } from '../types';

interface WheelViewProps {
  wdeg: number;
  anim: boolean;
  dl: LayoutTile[];
  da: AngleEntry[];
  flippedMap: Record<string | number, boolean>;
}

export default function WheelView({ wdeg, anim, dl, da, flippedMap }: WheelViewProps) {
  return (
    <div style={{ position: 'relative', width: 385, height: 370 }}>
      {/* Right-side pointer */}
      <div style={{
        position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
        width: 0, height: 0,
        borderTop: '8px solid transparent',
        borderBottom: '8px solid transparent',
        borderRight: '19px solid #666',
        zIndex: 10,
        filter: 'drop-shadow(-3px 0 5px rgba(150,150,150,.4))',
      }} />

      <svg width={370} height={370} viewBox="0 0 420 420" style={{
        transform: 'rotate(' + wdeg + 'deg)',
        transition: anim ? 'transform 3.4s cubic-bezier(0.14, 0.58, 0.08, 1.0)' : 'none',
      }}>
        <circle cx={CX} cy={CY} r={R + 5} fill="none" stroke="#2a2a2a" strokeWidth={2} />
        {dl.map(function(t, i) {
          return (
            <path
              key={t.id}
              d={slicePath(da[i].start, da[i].end)}
              fill={t.type === 'dead' ? '#3a2f45' : (t.type === 'win' ? '#d4d4d4' : '#1e1e1e')}
              stroke="#0f0f0f"
              strokeWidth={1.5}
              style={flippedMap[t.id] ? {
                animation: 'loseFlipToWin .55s ease',
                transformBox: 'fill-box' as any,
                transformOrigin: 'center',
              } : undefined}
            />
          );
        })}
        <circle cx={CX} cy={CY} r={17} fill="#0f0f0f" stroke="#333" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={5.5} fill="#3a3a3a" />
      </svg>
    </div>
  );
}
