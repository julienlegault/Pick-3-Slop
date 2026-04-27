import { useState, useRef, useEffect } from 'react';
import { RC } from '../logic.js';

// BoonTag — tooltip via CSS class toggle + hover, no portal
export function BoonTag(props) {
  var DRAG_THRESHOLD_DISTANCE_SQUARED = 25; // 5px distance threshold (5^2) before treating pointer interaction as a drag.
  var b = props.b;
  var large = props.large;
  var shaking = props.shaking;
  var draggable = props.draggable;
  var [pinned, setPinned] = useState(false);
  var startRef = useRef(null);
  var movedRef = useRef(false);
  var tagRef = useRef(null);

  useEffect(function() {
    if (!pinned) return;
    var el = tagRef.current;
    function handleOutsideClick(e) {
      if (el && el.contains(e.target)) return;
      setPinned(false);
    }
    document.addEventListener('click', handleOutsideClick, true);
    return function() { document.removeEventListener('click', handleOutsideClick, true); };
  }, [pinned]);

  var isDoom = b.isDoom;
  var c = isDoom ? '#CC1010' : RC[b.rarity];
  var cls = 'boon-tag boon-tag-base ' + (large ? 'boon-tag-large' : 'boon-tag-small') + (pinned ? ' pinned' : '') + (shaking ? ' shaking' : '') + (isDoom ? ' doom-boon-tag' : '');

  return (
    <span
      ref={tagRef}
      className={cls}
      data-boon-iid={b.iid}
      onPointerDown={function(e) {
        if (draggable) {
          startRef.current = { x: e.clientX, y: e.clientY };
          movedRef.current = false;
        }
        if (props.onPointerDown) props.onPointerDown(e);
      }}
      onPointerMove={function(e) {
        if (draggable && startRef.current) {
          var dx = e.clientX - startRef.current.x;
          var dy = e.clientY - startRef.current.y;
          if ((dx * dx + dy * dy) > DRAG_THRESHOLD_DISTANCE_SQUARED) movedRef.current = true;
        }
        if (props.onPointerMove) props.onPointerMove(e);
      }}
      onPointerUp={function(e) {
        startRef.current = null;
        if (props.onPointerUp) props.onPointerUp(e);
      }}
      onPointerCancel={function(e) {
        startRef.current = null;
        if (props.onPointerCancel) props.onPointerCancel(e);
      }}
      onClick={function(e) {
        e.stopPropagation();
        if (movedRef.current) {
          movedRef.current = false;
          return;
        }
        setPinned(function(p) { return !p; });
      }}
      style={{
        border: '1px solid ' + c,
        color: c,
        background: isDoom ? (pinned ? 'rgba(180,16,16,.22)' : 'rgba(180,16,16,.12)') : (pinned ? c + '28' : c + '14'),
        cursor: draggable ? 'grab' : 'pointer',
        outline: props.dropTarget ? ('1px dashed ' + c) : 'none',
      }}
    >
      {b.name}{b.charges > 0 ? ' (' + b.charges + ')' : ''}
      <span
        className="boon-tip"
        style={{ border: '1px solid ' + c, boxShadow: '0 4px 24px rgba(0,0,0,.8), 0 0 12px ' + c + '30' }}
      >
        <span className="boon-tip-rarity" style={{ color: c }}>
          {isDoom ? 'doom' : b.rarity}
        </span>
        <span className="boon-tip-name">
          {b.name}
        </span>
        <span className="boon-tip-desc">
          {b.desc}
        </span>
        <span className="tip-arrow" style={{ borderTop: '7px solid ' + c }} />
      </span>
    </span>
  );
}
