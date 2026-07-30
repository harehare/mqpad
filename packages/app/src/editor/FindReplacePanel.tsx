import { useEffect, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { LuCaseSensitive, LuChevronDown, LuChevronUp, LuX } from "react-icons/lu";
import { findMatches, findReplacePluginKey, type FindMatch } from "./extensions/FindAndReplace";
import "./FindReplacePanel.css";

export type FindReplacePanelProps = {
  editor: TiptapEditor;
  onClose: () => void;
};

/** Cmd/Ctrl+F find/replace bar for the WYSIWYG editor - matches are highlighted via FindAndReplace's decoration plugin, navigation moves the real selection so Enter/replace act on the current match. */
export function FindReplacePanel({ editor, onClose }: FindReplacePanelProps) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matches, setMatches] = useState<FindMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Clear decorations left behind when the panel closes.
  useEffect(() => {
    return () => {
      if (editor.isDestroyed) return;
      editor.view.dispatch(editor.state.tr.setMeta(findReplacePluginKey, { matches: [], activeIndex: -1 }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  function gotoMatch(nextMatches: FindMatch[], index: number) {
    let tr = editor.state.tr.setMeta(findReplacePluginKey, { matches: nextMatches, activeIndex: index });
    const match = nextMatches[index];
    if (match) {
      tr = tr.setSelection(TextSelection.create(tr.doc, match.from, match.to)).scrollIntoView();
    }
    editor.view.dispatch(tr);
  }

  function runSearch(nextQuery: string, nextCaseSensitive: boolean, keepIndex = 0) {
    const found = findMatches(editor.state.doc, nextQuery, nextCaseSensitive);
    const nextActiveIndex = found.length === 0 ? -1 : Math.min(keepIndex, found.length - 1);
    setMatches(found);
    setActiveIndex(nextActiveIndex);
    gotoMatch(found, nextActiveIndex);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    runSearch(value, caseSensitive);
  }

  function toggleCaseSensitive() {
    const next = !caseSensitive;
    setCaseSensitive(next);
    runSearch(query, next);
  }

  function goNext() {
    if (matches.length === 0) return;
    const next = (activeIndex + 1) % matches.length;
    setActiveIndex(next);
    gotoMatch(matches, next);
  }

  function goPrev() {
    if (matches.length === 0) return;
    const next = (activeIndex - 1 + matches.length) % matches.length;
    setActiveIndex(next);
    gotoMatch(matches, next);
  }

  function replaceCurrent() {
    if (activeIndex < 0 || !matches[activeIndex]) return;
    const match = matches[activeIndex];
    editor.view.dispatch(editor.state.tr.insertText(replacement, match.from, match.to));
    runSearch(query, caseSensitive, activeIndex);
  }

  function replaceAll() {
    if (matches.length === 0) return;
    let tr = editor.state.tr;
    // Replace from the last match backwards so earlier matches' positions stay valid.
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      if (!match) continue;
      tr = tr.insertText(replacement, match.from, match.to);
    }
    editor.view.dispatch(tr);
    runSearch(query, caseSensitive, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) goPrev();
      else goNext();
    }
  }

  return (
    <div className="mqpad-find-replace" onKeyDown={handleKeyDown}>
      <div className="mqpad-find-replace-row">
        <input
          ref={inputRef}
          type="text"
          className="mqpad-find-replace-input"
          placeholder="Find"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
        />
        <span className="mqpad-find-replace-count">
          {matches.length > 0 ? `${activeIndex + 1}/${matches.length}` : query ? "0/0" : ""}
        </span>
        <button
          type="button"
          className={`mqpad-find-replace-icon-btn ${caseSensitive ? "active" : ""}`}
          aria-label="Match case"
          aria-pressed={caseSensitive}
          onClick={toggleCaseSensitive}
        >
          <LuCaseSensitive size={14} />
        </button>
        <button
          type="button"
          className="mqpad-find-replace-icon-btn"
          aria-label="Previous match"
          disabled={matches.length === 0}
          onClick={goPrev}
        >
          <LuChevronUp size={14} />
        </button>
        <button
          type="button"
          className="mqpad-find-replace-icon-btn"
          aria-label="Next match"
          disabled={matches.length === 0}
          onClick={goNext}
        >
          <LuChevronDown size={14} />
        </button>
        <button type="button" className="mqpad-find-replace-icon-btn" aria-label="Close find" onClick={onClose}>
          <LuX size={14} />
        </button>
      </div>
      <div className="mqpad-find-replace-row">
        <input
          type="text"
          className="mqpad-find-replace-input"
          placeholder="Replace"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        />
        <button type="button" disabled={activeIndex < 0} onClick={replaceCurrent}>
          Replace
        </button>
        <button type="button" disabled={matches.length === 0} onClick={replaceAll}>
          Replace All
        </button>
      </div>
    </div>
  );
}
