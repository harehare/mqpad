import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { renderMermaid } from "../../highlight/mermaid";

const RENDER_DEBOUNCE_MS = 300;

/**
 * Default codeBlock rendering (plain `pre>code`, same as StarterKit's
 * built-in toDOM) plus a live-rendered diagram underneath for ```mermaid
 * fences specifically. Using one NodeView for every code block - rather than
 * conditionally attaching it - keeps the editable text node identical to the
 * non-mermaid case (CodeBlockHighlight's decorations target it the same
 * way), and only the extra preview below is mermaid-specific.
 */
export function CodeBlockView({ node }: NodeViewProps) {
  const language = node.attrs.language as string | null;
  const isMermaid = language === "mermaid";
  const source = node.textContent;
  const idRef = useRef(`mqpad-mermaid-${Math.random().toString(36).slice(2)}`);

  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isMermaid) return;
    if (!source.trim()) {
      setSvg("");
      setError(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      renderMermaid(idRef.current, source)
        .then((result) => {
          if (!cancelled) setSvg(result);
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });
    }, RENDER_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isMermaid, source]);

  return (
    <NodeViewWrapper>
      <pre>
        <NodeViewContent<"code"> as="code" />
      </pre>
      {isMermaid && (
        <div className="mqpad-mermaid-block" contentEditable={false}>
          {error ? (
            <div className="mqpad-mermaid-block-error">{error}</div>
          ) : svg ? (
            // mermaid.render output is generated SVG markup, not user-controlled HTML.
            <div className="mqpad-mermaid-block-preview" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="mqpad-mermaid-block-hint">Rendering diagram...</div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
