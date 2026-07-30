import type { HeadingItem } from "./computeOutline";
import "./Outline.css";

export type OutlineProps = {
  items: HeadingItem[];
  onNavigate: (pos: number) => void;
  onClose: () => void;
};

/** Jump list for the current document's headings, in document order and indented by level - opened from the toolbar's table-of-contents button. */
export function Outline({ items, onNavigate, onClose }: OutlineProps) {
  return (
    <div className="mqpad-outline">
      <div className="mqpad-outline-header">
        <span>Outline{items.length > 0 ? ` (${items.length})` : ""}</span>
        <button type="button" className="mqpad-outline-close" onClick={onClose} aria-label="Close outline">
          ×
        </button>
      </div>
      <div className="mqpad-outline-body">
        {items.length === 0 ? (
          <div className="mqpad-outline-empty">No headings in this document</div>
        ) : (
          items.map((item, index) => (
            <button
              type="button"
              key={index}
              className="mqpad-outline-item"
              style={{ paddingLeft: `${8 + (item.level - 1) * 14}px` }}
              onClick={() => onNavigate(item.pos)}
            >
              {item.text || "Untitled heading"}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
