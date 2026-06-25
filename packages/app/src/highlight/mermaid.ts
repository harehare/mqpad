import mermaid from "mermaid";

let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark" });
  initialized = true;
}

let renderCounter = 0;

/**
 * Renders mermaid diagram source to an SVG string. `idPrefix` should be
 * stable per block instance; this still suffixes a per-call counter since
 * mermaid.render mounts a temporary DOM node under `id` and two in-flight
 * calls for the same block (e.g. a debounced re-render racing a prior one)
 * would otherwise collide.
 */
export async function renderMermaid(idPrefix: string, source: string): Promise<string> {
  ensureInitialized();
  const { svg } = await mermaid.render(`${idPrefix}-${renderCounter++}`, source);
  return svg;
}
