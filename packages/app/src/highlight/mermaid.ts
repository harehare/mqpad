import mermaid from "mermaid";

let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark" });
  initialized = true;
}

let renderCounter = 0;

export async function renderMermaid(idPrefix: string, source: string): Promise<string> {
  ensureInitialized();
  const container = document.createElement("div");
  container.style.cssText = "position:fixed; top:-10000px; left:-10000px; visibility:hidden;";
  document.body.appendChild(container);
  try {
    const { svg } = await mermaid.render(`${idPrefix}-${renderCounter++}`, source, container);
    return svg;
  } finally {
    container.remove();
  }
}

export function formatMermaidError(message: string): string {
  return message
    .split("\n")
    .filter((line) => !/^-+\^$/.test(line.trim()))
    .join("\n")
    .trim();
}
