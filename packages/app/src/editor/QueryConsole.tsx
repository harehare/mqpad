import type { Editor as TiptapEditor } from "@tiptap/react";
import type { MarkdownSerializer } from "prosemirror-markdown";
import { useEffect, useState } from "react";
import { LuX } from "react-icons/lu";
import { useMqRunner } from "../mq/MqRunnerContext";
import { useVaultIndex } from "../mq/VaultIndexContext";
import { runVaultQuery } from "../mq/runVaultQuery";
import { serializeToMarkdown } from "./markdown";

export type QueryConsoleProps = {
  editor: TiptapEditor;
  serializer: MarkdownSerializer;
  onClose: () => void;
};

/**
 * An ad hoc `mq` console: runs a query against the document's current full
 * markdown and shows the result, live as you type (debounced) - same input
 * an `mq` code block would use, but without inserting anything into the
 * note. For exploring a query before committing it to a block, or just
 * reading data out without leaving a trace.
 */
export function QueryConsole({ editor, serializer, onClose }: QueryConsoleProps) {
  const runner = useMqRunner();
  const vaultFiles = useVaultIndex();
  const [query, setQuery] = useState("");
  const [vaultScope, setVaultScope] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResult("");
      setError(null);
      setRunning(false);
      return;
    }
    setRunning(true);
    const timer = setTimeout(() => {
      const run = vaultScope
        ? runVaultQuery(runner, query, vaultFiles)
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
    </div>
  );
}
