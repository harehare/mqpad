import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useCallback, useEffect, useRef, useState } from "react";

export function MathBlockView({ node, updateAttributes }: NodeViewProps) {
  const source = node.attrs.source as string;
  // Same convention as the mq block: a brand new block starts in edit mode.
  const [editing, setEditing] = useState(() => source === "");
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) return;
    if (!source.trim()) {
      setHtml("");
      setError(null);
      return;
    }
    try {
      setHtml(katex.renderToString(source, { throwOnError: true, displayMode: true }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [editing, source]);

  useEffect(() => {
    if (!editing) return;
    const raf = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [editing]);

  const stopEditing = useCallback(() => setEditing(false), []);

  if (!editing) {
    return (
      <NodeViewWrapper className="mqpad-math-block" data-drag-handle>
        <button
          type="button"
          className="mqpad-math-block-preview"
          onClick={() => setEditing(true)}
          title="Click to edit the equation"
        >
          {error ? (
            <span className="mqpad-math-block-error">{error}</span>
          ) : html ? (
            // KaTeX's own renderToString output, not user-controlled HTML.
            <span dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <span className="mqpad-mq-block-status">Click to write a $$...$$ equation</span>
          )}
        </button>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="mqpad-math-block mqpad-mq-block-editing" data-drag-handle>
      <div className="mqpad-math-block-toolbar">
        <span className="mqpad-math-block-tag">math</span>
        <span className="mqpad-math-block-hint">editing - click away to render</span>
      </div>
      <textarea
        ref={textareaRef}
        className="mqpad-math-block-source"
        value={source}
        spellCheck={false}
        placeholder="x^2 + y^2 = z^2"
        onChange={(e) => updateAttributes({ source: e.target.value })}
        onBlur={stopEditing}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            stopEditing();
          }
        }}
        rows={Math.max(2, source.split("\n").length)}
      />
      {error && <div className="mqpad-math-block-error">{error}</div>}
    </NodeViewWrapper>
  );
}
