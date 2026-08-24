import type { Editor as TiptapEditor } from "@tiptap/react";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function exportAsMarkdown(content: string): Blob {
  return new Blob([content], { type: "text/markdown;charset=utf-8" });
}

export function exportAsHtml(editor: TiptapEditor, title: string): Blob {
  const body = editor.getHTML();
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 780px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
  pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; }
  code { font-family: ui-monospace, monospace; }
  blockquote { border-left: 3px solid #ccc; margin: 0; padding-left: 16px; color: #555; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; }
  img { max-width: 100%; }
</style>
</head>
<body>
${body}
</body>
</html>
`;
  return new Blob([html], { type: "text/html;charset=utf-8" });
}

export async function exportAsPdf(container: HTMLElement): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  return new Promise((resolve, reject) => {
    doc
      .html(container, {
        x: 24,
        y: 24,
        width: 547,
        windowWidth: container.scrollWidth || 800,
        autoPaging: "text",
        callback: (result) => resolve(result.output("blob")),
      })
      .catch(reject);
  });
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
