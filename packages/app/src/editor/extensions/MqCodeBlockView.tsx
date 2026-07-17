import { DOMSerializer } from "@tiptap/pm/model";
import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LuSparkles } from "react-icons/lu";
import { useAi } from "../../ai/AiContext";
import { aiAvailabilityTooltip } from "../../ai/availabilityMessage";
import { buildQueryPrompt } from "../../ai/mqPrompt";
import { highlightToHtml } from "../../highlight/highlighter";
import { useMqRunner } from "../../mq/MqRunnerContext";
import { useVaultIndex } from "../../mq/VaultIndexContext";
import { runVaultQuery } from "../../mq/runVaultQuery";
import { buildMarkdownParser } from "../markdown";
import type { MqCodeBlockOptions } from "./MqCodeBlock";

/** Strips a stray ```mq fence or surrounding whitespace an AI-generated query sometimes wraps its answer in, despite being asked not to. */
function cleanGeneratedQuery(text: string): string {
  return text
    .trim()
    .replace(/^```(?:mq)?\n?/, "")
    .replace(/```$/, "")
    .trim();
}

type MqBlockScope = "document" | "vault";

/**
 * Renders a query's markdown result the same way the document itself would
 * render it (headings, lists, tables, links, ...) rather than as raw
 * markdown text - parsed with the live editor schema so custom syntax (wiki
 * links, math, nested mq blocks) round-trips the same way it does in the
 * main document.
 */
function renderResultHtml(schema: NodeViewProps["editor"]["schema"], result: string): string {
  if (!result.trim()) return "";
  const doc = buildMarkdownParser(schema).parse(result);
  if (!doc) return "";
  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(doc.content);
  const container = document.createElement("div");
  container.appendChild(fragment);
  return container.innerHTML;
}

export function MqCodeBlockView({ node, updateAttributes, editor, extension }: NodeViewProps) {
  const runner = useMqRunner();
  const vaultFiles = useVaultIndex();
  const ai = useAi();
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDownloadProgress, setAiDownloadProgress] = useState<number | null>(null);
  const query = node.attrs.query as string;
  const result = node.attrs.result as string;
  const scope = (node.attrs.scope as MqBlockScope | undefined) ?? "document";
  // A brand new block (no query yet) starts in edit mode so you can type the
  // query right away; one loaded from a file starts showing its evaluated
  // result instead.
  const [editing, setEditing] = useState(() => query === "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Highlighted overlay rendered behind the (text-transparent) query
  // textarea, so the query reads like real `mq` syntax while typing it.
  const highlightRef = useRef<HTMLDivElement>(null);
  const [highlightedQueryHtml, setHighlightedQueryHtml] = useState("");
  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    void highlightToHtml(query, "mq").then((html) => {
      if (!cancelled) setHighlightedQueryHtml(html);
    });
    return () => {
      cancelled = true;
    };
  }, [editing, query]);
  const syncHighlightScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (!highlightRef.current) return;
    highlightRef.current.scrollTop = e.currentTarget.scrollTop;
    highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }, []);

  // Lets `run` always compare against the latest result without needing it
  // in its own dependency list (which would otherwise change identity on
  // every evaluation and re-trigger the live-update effect below).
  const resultRef = useRef(result);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  // Set right before `run` writes its own result back, so the live-update
  // effect can recognize and skip the single change that causes - rather
  // than treating its own write as new input and re-running again.
  const selfTriggered = useRef(false);

  const run = useCallback(
    async (currentQuery: string) => {
      if (!currentQuery.trim()) return;
      setRunning(true);
      setError(null);
      try {
        const output =
          scope === "vault"
            ? await runVaultQuery(runner, currentQuery, vaultFiles)
            : await runner.run(
                currentQuery,
                (extension.options as MqCodeBlockOptions).serializeDocument(editor),
              );
        // Skip the write entirely when nothing changed, so a stable query
        // doesn't keep producing no-op transactions once the live-update
        // effect below reacts to its own previous write.
        if (output !== resultRef.current) {
          selfTriggered.current = true;
          updateAttributes({ result: output });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setRunning(false);
      }
    },
    [runner, editor, extension, updateAttributes, scope, vaultFiles],
  );

  // Evaluate once on load if the block was opened with a query but no cached
  // result yet (e.g. a file opened for the first time this session). This
  // intentionally only looks at the values present at mount time - if it
  // reacted to the live `query`/`result`, it would also fire mid-typing the
  // moment a brand new, empty block got its first character.
  const initialQuery = useRef(query);
  const initialResult = useRef(result);
  useEffect(() => {
    if (initialQuery.current && !initialResult.current) {
      void run(initialQuery.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tracks the `vaultFiles` array a vault-scope block last ran against, so
  // the effect below can tell "the vault index actually changed" apart from
  // "we merely re-entered !editing with the same vault contents" (e.g. right
  // after blur, which already triggers its own direct run via stopEditing)
  // - without this, every blur would schedule a redundant second run.
  const lastVaultFilesRef = useRef(vaultFiles);

  // While showing the result (not editing the query), keep it live. Document
  // scope re-runs against the document's current markdown whenever the
  // document changes elsewhere, debounced so a burst of keystrokes only
  // triggers one evaluation - only attached while `!editing`, so typing into
  // this block's own query textarea (which itself updates a node attribute
  // and so would otherwise be seen as a document change) can't trigger a run
  // before blur. Vault scope has no single document to listen to; instead it
  // re-runs whenever the vault index itself changes (another note saved).
  useEffect(() => {
    if (editing || !query.trim()) return;

    if (scope === "vault") {
      if (lastVaultFilesRef.current === vaultFiles) return;
      lastVaultFilesRef.current = vaultFiles;
      const timer = setTimeout(() => void run(query), 400);
      return () => clearTimeout(timer);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleUpdate = () => {
      if (selfTriggered.current) {
        selfTriggered.current = false;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(query), 400);
    };
    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      if (timer) clearTimeout(timer);
    };
  }, [editing, query, editor, run, scope, vaultFiles]);

  // The editor itself also tries to claim focus when a file opens (see
  // Editor.tsx). Grabbing focus here via requestAnimationFrame instead of the
  // `autoFocus` attribute means we always win that race, since it runs after
  // any synchronous focus call made while this node view is mounting.
  useEffect(() => {
    if (!editing) return;
    const raf = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [editing]);

  const stopEditing = useCallback(() => {
    setEditing(false);
    void run(query);
  }, [query, run]);

  // Drafts a query from a natural-language instruction and drops it straight
  // into the (still editable, not-yet-run) query box - the AI never writes
  // to the document itself, it only proposes text the user reviews the same
  // way they'd review anything they typed by hand.
  const handleAskAi = useCallback(async () => {
    if (!aiInstruction.trim()) return;
    setAiGenerating(true);
    setAiError(null);
    setAiDownloadProgress(null);
    try {
      const sampleContent =
        scope === "vault"
          ? vaultFiles.map((file) => file.content).join("\n\n---\n\n")
          : (extension.options as MqCodeBlockOptions).serializeDocument(editor);
      const generated = await ai.complete(buildQueryPrompt(aiInstruction, sampleContent, scope), setAiDownloadProgress);
      updateAttributes({ query: cleanGeneratedQuery(generated) });
      setAiPromptOpen(false);
      setAiInstruction("");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiGenerating(false);
      setAiDownloadProgress(null);
    }
  }, [aiInstruction, ai, scope, vaultFiles, extension, editor, updateAttributes]);

  // Render the result through the same markdown -> doc -> DOM pipeline the
  // document itself uses, so e.g. a query that produces a table or a list
  // shows as a table or a list instead of literal markdown source.
  const resultHtml = useMemo(() => {
    if (!result) return "";
    try {
      return renderResultHtml(editor.schema, result);
    } catch {
      return "";
    }
  }, [editor.schema, result]);

  // The rendered result can contain real links; clicking one should follow
  // it instead of switching the block into edit mode.
  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a")) return;
    setEditing(true);
  }, []);

  if (!editing) {
    return (
      <NodeViewWrapper className="mqpad-mq-block" data-drag-handle>
        <div
          className="mqpad-mq-block-preview"
          role="button"
          tabIndex={0}
          contentEditable={false}
          onClick={handlePreviewClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setEditing(true);
            }
          }}
          title="Click to edit the query"
        >
          <span className="mqpad-mq-block-tag">mq</span>
          {scope === "vault" && <span className="mqpad-mq-block-scope">vault</span>}
          {running ? (
            <span className="mqpad-mq-block-status">Evaluating...</span>
          ) : error ? (
            <span className="mqpad-mq-block-error">{error}</span>
          ) : result ? (
            <div
              className="mqpad-mq-block-result"
              // Result HTML comes from parsing the query's own markdown
              // output with the editor's schema (see renderResultHtml
              // above), not from arbitrary external input.
              dangerouslySetInnerHTML={{ __html: resultHtml }}
            />
          ) : query.trim() ? (
            // A query exists and ran cleanly but matched/produced nothing -
            // distinct from never having a query at all, so it doesn't read
            // as "this hasn't been evaluated yet".
            <span className="mqpad-mq-block-status">(no output)</span>
          ) : (
            <span className="mqpad-mq-block-status">Click to write a query</span>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="mqpad-mq-block mqpad-mq-block-editing" data-drag-handle>
      <div className="mqpad-mq-block-toolbar">
        <span className="mqpad-mq-block-tag">mq</span>
        <div className="mqpad-mq-block-scope-toggle" role="group" aria-label="Query scope">
          <button
            type="button"
            className={scope === "document" ? "active" : ""}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => updateAttributes({ scope: "document" })}
            title="Run against the open document"
          >
            Doc
          </button>
          <button
            type="button"
            className={scope === "vault" ? "active" : ""}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => updateAttributes({ scope: "vault" })}
            title="Run against every note in the vault"
          >
            Vault
          </button>
        </div>
        <button
          type="button"
          className="mqpad-mq-block-ai-btn"
          disabled={!ai.configured}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setAiPromptOpen((open) => !open)}
          title={aiAvailabilityTooltip(ai.availability, "Ask AI to draft a query")}
        >
          <LuSparkles size={13} />
        </button>
        <span className="mqpad-mq-block-hint">editing - click away to run</span>
      </div>
      {aiPromptOpen && (
        <div className="mqpad-mq-block-ai-popover">
          <input
            autoFocus
            type="text"
            placeholder="e.g. list headings that mention TODO"
            value={aiInstruction}
            disabled={aiGenerating}
            onChange={(e) => setAiInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAskAi();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setAiPromptOpen(false);
              }
            }}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void handleAskAi()}
            disabled={aiGenerating || !aiInstruction.trim()}
          >
            {aiGenerating
              ? aiDownloadProgress !== null
                ? `Downloading model… ${Math.round(aiDownloadProgress * 100)}%`
                : "Generating…"
              : "Generate"}
          </button>
          {aiError && <span className="mqpad-mq-block-error">{aiError}</span>}
        </div>
      )}
      <div className="mqpad-mq-block-query-wrap">
        <div
          ref={highlightRef}
          className="mqpad-mq-block-query-highlight"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlightedQueryHtml }}
        />
        <textarea
          ref={textareaRef}
          className="mqpad-mq-block-query"
          value={query}
          spellCheck={false}
          placeholder=".h1 | upcase()"
          onChange={(e) => updateAttributes({ query: e.target.value })}
          onBlur={(e) => {
            // Focus moving to something still inside this block (the scope
            // toggle, the "Ask AI" button/popover) isn't "leaving" it - only
            // a blur that hands focus elsewhere should stop editing.
            const next = e.relatedTarget as Node | null;
            if (next && e.currentTarget.closest(".mqpad-mq-block-editing")?.contains(next)) return;
            stopEditing();
          }}
          onScroll={syncHighlightScroll}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              stopEditing();
            }
          }}
          rows={Math.max(2, query.split("\n").length)}
        />
      </div>
      {error && <div className="mqpad-mq-block-error">{error}</div>}
    </NodeViewWrapper>
  );
}
