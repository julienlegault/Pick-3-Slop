import { useState } from 'react';
import { RC } from '../constants';
import type { Boon } from '../types';

interface BoonTagProps {
  b: Boon;
  large?: boolean;
  shaking?: boolean;
  draggable?: boolean;
  dropTarget?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export default function BoonTag(props: BoonTagProps) {
  var b = props.b;
  var large = props.large;
  var shaking = props.shaking;
  var draggable = props.draggable;
  var [pinned, setPinned] = useState(false);
  var c = RC[b.rarity];
  var sz = large
    ? { padding: '4px 11px', fontSize: '.7rem' }
    : { padding: '3px 8px',  fontSize: '.62rem' };
  var cls = 'boon-tag' + (pinned ? ' pinned' : '') + (shaking ? ' shaking' : '');

  return (
    <span
      className={cls}
      draggable={!!draggable}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      onDragEnd={props.onDragEnd}
      onClick={function(e) { e.stopPropagation(); setPinned(function(p) { return !p; }); }}
      style={Object.assign({}, sz, {
        border: '1px solid ' + c,
        borderRadius: '2px',
        color: c,
        background: pinned ? c + '28' : c + '14',
        cursor: draggable ? 'grab' : 'pointer',
        transition: 'background .12s',
        fontFamily: "'Cinzel', serif",
        outline: props.dropTarget ? ('1px dashed ' + c) : 'none',
      })}
    >
      {b.name}{(b.charges || 0) > 0 ? ' (' + b.charges + ')' : ''}
      <span
        className="boon-tip"
        style={{ border: '1px solid ' + c, boxShadow: '0 4px 24px rgba(0,0,0,.8), 0 0 12px ' + c + '30' }}
      >
        <span style={{ display:'block', fontSize:'.58rem', color:c, letterSpacing:'.3em', textTransform:'uppercase', marginBottom:'5px', fontFamily:"'Cinzel',serif" }}>
          {b.rarity}
        </span>
        <span style={{ display:'block', fontSize:'.82rem', color:'#e0e0e0', fontFamily:"'Cinzel',serif", fontWeight:600, marginBottom:'6px', lineHeight:1.25 }}>
          {b.name}
        </span>
        <span style={{ display:'block', fontSize:'.7rem', color:'#888', lineHeight:1.5, fontFamily:'Georgia,serif' }}>
          {b.desc}
        </span>
        <span className="tip-arrow" style={{ borderTop: '7px solid ' + c }} />
      </span>
    </span>
  );
}
