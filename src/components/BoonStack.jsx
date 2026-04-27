import { BoonTag } from './BoonTag.jsx';

// BoonStack — the draggable boon list shown below the wheel during play.
// Props: displayBoonGroups, shakingGroupKey, dragOverIid,
//        startDragBoon, moveDragBoon, endDragBoon, cancelDragBoon
export function BoonStack({ displayBoonGroups, shakingGroupKey, dragOverIid, startDragBoon, moveDragBoon, endDragBoon, cancelDragBoon }) {
  if (displayBoonGroups.length === 0) return null;
  return (
    <div className="boon-stack">
      <div className="boon-stack-label">
        BOON STACK &mdash; DRAG TO REORDER | HOVER OR CLICK TO INSPECT
      </div>
      <div className="boon-stack-items">
        {displayBoonGroups.map(function(b) {
          return (
            <BoonTag
              key={b.iid}
              b={b}
              shaking={shakingGroupKey !== null && (b.group || b.id) === shakingGroupKey}
              draggable={true}
              dropTarget={dragOverIid === b.iid}
              onPointerDown={function(e) { e.stopPropagation(); startDragBoon(e, b.iid); }}
              onPointerMove={moveDragBoon}
              onPointerUp={function(e) { e.stopPropagation(); endDragBoon(e); }}
              onPointerCancel={function(e) { e.stopPropagation(); cancelDragBoon(e); }}
            />
          );
        })}
      </div>
    </div>
  );
}
