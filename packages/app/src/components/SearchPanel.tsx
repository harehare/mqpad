import { useMemo, useState } from "react";
import { VscSearch, VscClose } from "react-icons/vsc";
import "./SearchPanel.css";

export type SearchPanelProps = {
  contentByPath: Record<string, string>;
  onNavigate: (path: string, query: string) => void;
};

type Snippet = { before: string; match: string; after: string };
type SearchResult = { path: string; count: number; snippets: Snippet[] };

const MAX_RESULTS = 100;
const MAX_SNIPPETS_PER_FILE = 3;
const SNIPPET_RADIUS = 40;

function basenameWithoutExt(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.mdx?$/i, "");
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ");
}

function buildSnippet(content: string, index: number, queryLength: number): Snippet {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(content.length, index + queryLength + SNIPPET_RADIUS);
  return {
    before: (start > 0 ? "…" : "") + collapseWhitespace(content.slice(start, index)),
    match: content.slice(index, index + queryLength),
    after: collapseWhitespace(content.slice(index + queryLength, end)) + (end < content.length ? "…" : ""),
  };
}

function searchVault(query: string, contentByPath: Record<string, string>): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];
  for (const [path, content] of Object.entries(contentByPath)) {
    const lower = content.toLowerCase();
    const snippets: Snippet[] = [];
    let count = 0;
    let index = lower.indexOf(q);
    while (index !== -1) {
      count += 1;
      if (snippets.length < MAX_SNIPPETS_PER_FILE) snippets.push(buildSnippet(content, index, q.length));
      index = lower.indexOf(q, index + q.length);
    }
    if (count > 0) results.push({ path, count, snippets });
  }
  return results.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)).slice(0, MAX_RESULTS);
}

/** Sidebar panel that searches note bodies (not just file names) across the whole vault, ranked by match count with highlighted snippets. */
export function SearchPanel({ contentByPath, onNavigate }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchVault(query, contentByPath), [query, contentByPath]);

  return (
    <div className="search-panel-container">
      <div className="search-panel-header">
        <span className="search-panel-title">SEARCH</span>
      </div>
      <div className="search-panel-input-row">
        <VscSearch size={14} className="search-panel-search-icon" />
        <input
          className="search-panel-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all notes..."
          autoFocus
        />
        {query && (
          <button
            type="button"
            className="search-panel-search-clear"
            onClick={() => setQuery("")}
            title="Clear search"
            aria-label="Clear search"
          >
            <VscClose size={13} />
          </button>
        )}
      </div>
      <div className="search-panel-results">
        {!query ? (
          <div className="search-panel-empty">Type to search across every note's content.</div>
        ) : results.length === 0 ? (
          <div className="search-panel-empty">No matches</div>
        ) : (
          results.map((result) => (
            <div key={result.path} className="search-panel-result">
              <button
                type="button"
                className="search-panel-result-header"
                onClick={() => onNavigate(result.path, query)}
              >
                <span className="search-panel-result-title">{basenameWithoutExt(result.path)}</span>
                <span className="search-panel-result-count">{result.count}</span>
              </button>
              <span className="search-panel-result-path">{dirname(result.path)}</span>
              {result.snippets.map((snippet, i) => (
                <button
                  type="button"
                  key={i}
                  className="search-panel-snippet"
                  onClick={() => onNavigate(result.path, query)}
                >
                  {snippet.before}
                  <mark className="search-panel-snippet-match">{snippet.match}</mark>
                  {snippet.after}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
