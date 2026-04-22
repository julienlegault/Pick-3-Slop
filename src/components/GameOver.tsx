
import BoonTag from './BoonTag';
import type { Boon } from '../types';

interface GameOverProps {
  sc: number;
  shownBoons: Boon[];
  onRestart: () => void;
}

export default function GameOver({ sc, shownBoons, onRestart }: GameOverProps) {
  return (
    <div style={{
      textAlign: 'center',
      background: '#111', border: '1px solid #2a2a2a',
      borderRadius: '6px', padding: '28px 30px',
      maxWidth: '500px', width: '100%',
      animation: 'fu .4s ease',
      boxShadow: '0 8px 48px rgba(0,0,0,.9)',
    }}>
      <div style={{
        fontSize: 'clamp(1.35rem, 4.3vw, 2.1rem)', fontWeight: 700,
        color: '#CC1010', letterSpacing: '.22em',
        textShadow: '0 0 22px rgba(200,16,16,.5)',
        marginBottom: '6px',
      }}>
        ELIMINATED
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '.9rem', color: '#333', letterSpacing: '.35em', marginBottom: '20px' }}>
        {sc} SPINS SURVIVED
      </div>
      {shownBoons.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '.52rem', letterSpacing: '.38em', color: '#222', marginBottom: '8px' }}>
            FINAL BOON STACK
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {shownBoons.map(function(b, i) {
              return <BoonTag key={'go_' + (b.iid || b.id) + '_' + i} b={b} large={true} />;
            })}
          </div>
        </div>
      )}
      <button
        className="again-btn"
        onClick={function(e) { e.stopPropagation(); onRestart(); }}
        style={{
          padding: '10px 36px', background: 'transparent',
          border: '2px solid #D4AF37', color: '#D4AF37',
          fontSize: '.8rem', fontFamily: "'Cinzel', serif",
          letterSpacing: '.32em', cursor: 'pointer',
          transition: 'background .15s',
        }}
      >
        PLAY AGAIN
      </button>
    </div>
  );
}
