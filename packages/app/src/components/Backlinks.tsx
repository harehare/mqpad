import { useState } from "react";
import { LuChevronDown, LuChevronRight, LuLink } from "react-icons/lu";
import "./Backlinks.css";

export type BacklinksProps = {
  paths: string[];
  onNavigate: (path: string) => void;
};

function basenameWithoutExt(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.mdx?$/i, "");
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

/** Collapsible "linked mentions" list - the notes whose `[[WikiLink]]`s resolve to the currently open file. */
export function Backlinks({ paths, onNavigate }: BacklinksProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="mqpad-backlinks">
      <button
        type="button"
        className="mqpad-backlinks-header"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
      >
        {collapsed ? <LuChevronRight /> : <LuChevronDown />}
        <LuLink size={12} />
        <span>
          Linked Mentions ({paths.length})
        </span>
      </button>
      {!collapsed && (
        <div className="mqpad-backlinks-body">
          {paths.map((path) => (
            <button type="button" key={path} className="mqpad-backlinks-item" onClick={() => onNavigate(path)}>
              <span className="mqpad-backlinks-item-title">{basenameWithoutExt(path)}</span>
              <span className="mqpad-backlinks-item-path">{dirname(path)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
