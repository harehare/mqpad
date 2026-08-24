import type { Editor as TiptapEditor } from "@tiptap/react";
import type { MarkdownSerializer } from "prosemirror-markdown";
import { useEffect, useState } from "react";
import { LuX, LuTrash2 } from "react-icons/lu";
import { useMqRunner } from "../mq/MqRunnerContext";
import { useVaultIndex } from "../mq/VaultIndexContext";
import { runVaultQueryStructured, type VaultQueryResult } from "../mq/runVaultQuery";
import { resultsToCsv, resultsToJson } from "../mq/exportQueryResults";
import type { SavedQuery } from "../useSavedQueries";
import { serializeToMarkdown } from "./markdown";

export type QueryConsoleProps = {
  editor: TiptapEditor;
  serializer: MarkdownSerializer;
  onClose: () => void;
  savedQueries: SavedQuery[];
  onAddSavedQuery: (name: string, query: string, scope: "document" | "vault") => void;
  onRemoveSavedQuery: (id: string) => void;
};

function formatVaultResults(results: VaultQueryResult[]): string {
  return results.map((r) => `**[[${r.title}]]**\n\n${r.output}`).join("\n\n---\n\n");
}

function download(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * An ad hoc `mq` console: runs a query against the document's current full
 * markdown and shows the result, live as you type (debounced) - same input
 * an `mq` code block would use, but without inserting anything into the
 * note. For exploring a query before committing it to a block, or just
 * reading data out without leaving a trace. Also loads/saves named queries
 * and, for vault-scope queries, exports the structured results as CSV/JSON.
 */
export function QueryConsole({
  editor,
  serializer,
  onClose,
  savedQueries,
  onAddSavedQuery,
  onRemoveSavedQuery,
}: QueryConsoleProps) {
  const runner = useMqRunner();
  const vaultFiles = useVaultIndex();
  const [query, setQuery] = useState("");
  const [vaultScope, setVaultScope] = useState(false);
  const [result, setResult] = useState("");
  const [structuredResults, setStructuredResults] = useState<VaultQueryResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saveNameOpen, setSaveNameOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    if (!query.trim()) {
      setResult("");
      setStructuredResults([]);
      setError(null);
      setRunning(false);
      return;
    }
    setRunning(true);
    const timer = setTimeout(() => {
      const run = vaultScope
        ? runVaultQueryStructured(runner, query, vaultFiles).then((results) => {
            setStructuredResults(results);
            return formatVaultResults(results);
          })
        : runner.run(query, serializeToMarkdown(serializer, editor.state.doc));
      run
        .then((output) => {
          setError(null);
          setResult(output);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setRunning(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, vaultScope, editor, serializer, runner, vaultFiles]);

  const handleLoadSaved = (id: string) => {
    const saved = savedQueries.find((q) => q.id === id);
    if (!saved) return;
    setQuery(saved.query);
    setVaultScope(saved.scope === "vault");
  };

  const handleConfirmSave = () => {
    if (!saveName.trim() || !query.trim()) return;
    onAddSavedQuery(saveName.trim(), query, vaultScope ? "vault" : "document");
    setSaveName("");
    setSaveNameOpen(false);
  };

  return (
    <div className="mqpad-query-console">
      <div className="mqpad-query-console-header">
        <span className="mqpad-query-console-title">
          Query the whole {vaultScope ? "vault" : "document"}
        </span>
        <label className="mqpad-query-console-vault-toggle">
          <input type="checkbox" checked={vaultScope} onChange={(e) => setVaultScope(e.target.checked)} />
          Whole vault
        </label>
        <button type="button" className="mqpad-query-console-close" onClick={onClose} title="Close">
          <LuX size={14} />
        </button>
      </div>
      <div className="mqpad-query-console-saved-row">
        <select
          className="mqpad-query-console-saved-select"
          value=""
          onChange={(e) => {
            if (e.target.value) handleLoadSaved(e.target.value);
          }}
        >
          <option value="">Load saved query...</option>
          {savedQueries.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name} ({q.scope})
            </option>
          ))}
        </select>
        {saveNameOpen ? (
          <>
            <input
              autoFocus
              className="mqpad-query-console-save-name"
              placeholder="Query name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmSave();
                if (e.key === "Escape") setSaveNameOpen(false);
              }}
            />
            <button type="button" onClick={handleConfirmSave} disabled={!saveName.trim()}>
              Save
            </button>
          </>
        ) : (
          <button type="button" disabled={!query.trim()} onClick={() => setSaveNameOpen(true)}>
            Save Query
          </button>
        )}
      </div>
      {savedQueries.length > 0 && (
        <div className="mqpad-query-console-saved-list">
          {savedQueries.map((q) => (
            <div key={q.id} className="mqpad-query-console-saved-item">
              <span>{q.name}</span>
              <button
                type="button"
                onClick={() => onRemoveSavedQuery(q.id)}
                title="Delete"
                aria-label={`Delete ${q.name}`}
              >
                <LuTrash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <textarea
        autoFocus
        className="mqpad-query-console-input"
        placeholder=".h1 | upcase()"
        spellCheck={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        rows={2}
      />
      <div className="mqpad-query-console-result">
        {running ? (
          <span className="mqpad-query-console-status">Running...</span>
        ) : error ? (
          <span className="mqpad-query-console-error">{error}</span>
        ) : result ? (
          <pre>{result}</pre>
        ) : (
          <span className="mqpad-query-console-status">
            {query.trim()
              ? "(no output)"
              : `Type a query to run it against the whole ${vaultScope ? "vault" : "document"}`}
          </span>
        )}
      </div>
      {vaultScope && structuredResults.length > 0 && (
        <div className="mqpad-query-console-export-row">
          <button type="button" onClick={() => download("query-results.csv", resultsToCsv(structuredResults), "text/csv")}>
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => download("query-results.json", resultsToJson(structuredResults), "application/json")}
          >
            Export JSON
          </button>
        </div>
      )}
    </div>
  );
}
