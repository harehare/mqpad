import { useEffect, useMemo, useRef, useState } from "react";
import "./CommandPalette.css";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  onRun: () => void;
};

type CommandPaletteProps = {
  commands: Command[];
  onClose: () => void;
};

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.onRun();
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
          placeholder="Type a command..."
        />
        <div className="mqpad-palette-list">
          {filtered.length === 0 ? (
            <div className="mqpad-palette-empty">No matching commands</div>
          ) : (
            filtered.map((command, index) => (
              <button
                type="button"
                key={command.id}
                className={`mqpad-palette-item ${index === activeIndex ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => run(command)}
              >
                <span className="mqpad-palette-item-label">{command.label}</span>
                {command.hint && <span className="mqpad-palette-item-hint">{command.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
