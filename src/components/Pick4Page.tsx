import { useState } from 'react';

interface Pick4PageProps {
  restart: () => void;
}

export function Pick4Page({ restart }: Pick4PageProps) {
  const [drawState, setDrawState] = useState<'idle' | 'drawing' | 'revealed'>('idle');
  const [result, setResult] = useState<'win' | 'lose' | null>(null);

  function handleDraw() {
    if (drawState !== 'idle') return;
    var outcome: 'win' | 'lose' = Math.random() < 0.5 ? 'win' : 'lose';
    setResult(outcome);
    setDrawState('drawing');
    // fly animation: 0.55s, flip animation: 0.4s delayed by 0.5s → total ~0.95s
    setTimeout(function() { setDrawState('revealed'); }, 950);
  }

  return (
    <div className="pick4-root">
      <h1 className="pick4-title">
        PICK&nbsp;
        <span className="pick4-three">3</span>
        <span className="pick4-four">4</span>
        &nbsp;SLOP
      </h1>

      <div className="pick4-arena">
        {/* Deck of stacked face-down cards */}
        <div className="pick4-deck">
          <div className="pick4-deck-card pick4-deck-card--back" />
          <div className="pick4-deck-card pick4-deck-card--mid"  />
          <div className="pick4-deck-card pick4-deck-card--top"  />
        </div>

        {/* Empty slot / drawn card */}
        <div className="pick4-slot">
          {drawState === 'idle' && <div className="pick4-slot-empty" />}

          {drawState !== 'idle' && (
            <div className={'pick4-card-wrapper' + (drawState === 'drawing' ? ' pick4-card-flying' : '')}>
              <div className={'pick4-card-inner'
                + (drawState === 'drawing'  ? ' pick4-card-flipping' : '')
                + (drawState === 'revealed' ? ' pick4-card-flipped'  : '')}>
                <div className="pick4-card-face pick4-card-back" />
                <div className={'pick4-card-face pick4-card-front'
                  + (result === 'win' ? ' pick4-card-win' : ' pick4-card-lose')}>
                  {result === 'win' ? 'WIN' : 'LOSE'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {drawState === 'idle' && (
        <button className="pick4-draw-btn" onClick={handleDraw}>DRAW</button>
      )}

      {drawState === 'revealed' && (
        <button className="pick4-play-again-btn" onClick={restart}>PLAY AGAIN</button>
      )}
    </div>
  );
}
