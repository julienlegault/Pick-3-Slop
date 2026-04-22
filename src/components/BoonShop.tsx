
import { RC } from '../constants';
import type { Boon } from '../types';

interface BoonShopProps {
  choices: Boon[];
  shopRerolls: number;
  onPick: (b: Boon) => void;
  onReroll: () => void;
}

export default function BoonShop({ choices, shopRerolls, onPick, onReroll }: BoonShopProps) {
  return (
    <div style={{
      width: '100%', maxWidth: '700px',
      background: '#111', border: '1px solid #2a2a2a',
      borderRadius: '6px', padding: '18px 16px',
      animation: 'fu .3s ease',
      boxShadow: '0 8px 48px rgba(0,0,0,.9)',
    }}>
      <div style={{ textAlign: 'center', fontSize: '.6rem', letterSpacing: '.36em', color: '#383838', marginBottom: '12px' }}>
        CHOOSE A BOON
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        <button
          onClick={function(e) { e.stopPropagation(); onReroll(); }}
          disabled={shopRerolls <= 0}
          style={{
            padding: '7px 14px',
            background: 'transparent',
            border: '1px solid ' + (shopRerolls > 0 ? '#D4AF37' : '#444'),
            color: shopRerolls > 0 ? '#D4AF37' : '#555',
            letterSpacing: '.18em',
            fontSize: '.56rem',
            cursor: shopRerolls > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          REROLL SHOP ({shopRerolls})
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {choices.map(function(b) {
          return (
            <div
              key={b.iid}
              className="boon-card"
              onClick={function(e) { e.stopPropagation(); onPick(b); }}
              style={{
                border: '2px solid ' + RC[b.rarity],
                borderRadius: '4px', padding: '11px',
                width: '158px', cursor: 'pointer',
                background: RC[b.rarity] + '12',
                boxShadow: '0 0 10px ' + RC[b.rarity] + '28',
              }}
              onMouseEnter={function(e) { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 24px ' + RC[b.rarity] + '58'; }}
              onMouseLeave={function(e) { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 10px ' + RC[b.rarity] + '28'; }}
            >
              <div style={{ fontSize: '.52rem', color: RC[b.rarity], letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: '5px' }}>
                {b.rarity}
              </div>
              <div style={{ fontSize: '.78rem', color: '#e0e0e0', marginBottom: '7px', fontWeight: '600', lineHeight: 1.2 }}>
                {b.name}
              </div>
              <div style={{ fontSize: '.62rem', color: '#666', lineHeight: '1.45', fontFamily: 'Georgia, serif' }}>
                {b.desc}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
