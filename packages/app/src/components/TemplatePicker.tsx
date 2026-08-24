import { useEffect, useMemo, useRef, useState } from "react";
import { fuzzyScore } from "../fuzzyMatch";
import type { Template } from "../useTemplates";
import "./CommandPalette.css";

type TemplatePickerProps = {
  templates: Template[];
  onSelect: (template: Template) => void;
  onClose: () => void;
};

/** Command-palette-styled picker for "New File from Template...", fuzzy-filtered by template name. */
export function TemplatePicker({ templates, onSelect, onClose }: TemplatePickerProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return templates;
    return templates
      .map((t) => ({ t, score: fuzzyScore(query, t.name) }))
      .filter((entry): entry is { t: Template; score: number } => entry.score !== null)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.t);
  }, [templates, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const run = (template: Template | undefined) => {
    if (!template) return;
    onClose();
    onSelect(template);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(filtered[activeIndex]);
    }
  };

  return (
    <div className="mqpad-palette-overlay" onClick={onClose}>
      <div className="mqpad-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="mqpad-palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New file from template..."
        />
        <div className="mqpad-palette-list">
          {filtered.length === 0 ? (
            <div className="mqpad-palette-empty">No templates yet — add one from "Manage Templates".</div>
          ) : (
            filtered.map((t, index) => (
              <button
                type="button"
                key={t.id}
                className={`mqpad-palette-item ${index === activeIndex ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => run(t)}
              >
                <span className="mqpad-palette-item-label">{t.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
