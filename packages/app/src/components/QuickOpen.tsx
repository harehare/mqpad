import { useEffect, useMemo, useRef, useState } from "react";
import { fuzzyScore } from "../fuzzyMatch";
import "./CommandPalette.css";

type QuickOpenProps = {
  paths: string[];
  onSelect: (path: string) => void;
  onClose: () => void;
};

const MAX_RESULTS = 50;

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

export function QuickOpen({ paths, onSelect, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return paths.slice(0, MAX_RESULTS);
    return paths
      .map((path) => ({ path, score: fuzzyScore(query, path) }))
      .filter((entry): entry is { path: string; score: number } => entry.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.path);
  }, [paths, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const run = (path: string | undefined) => {
    if (!path) return;
    onClose();
    onSelect(path);
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
          placeholder="Go to file..."
        />
        <div className="mqpad-palette-list">
          {filtered.length === 0 ? (
            <div className="mqpad-palette-empty">No matching files</div>
          ) : (
            filtered.map((path, index) => (
              <button
                type="button"
                key={path}
                className={`mqpad-palette-item ${index === activeIndex ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => run(path)}
              >
                <span className="mqpad-palette-item-label">{basename(path)}</span>
                <span className="mqpad-palette-item-hint">{dirname(path)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
