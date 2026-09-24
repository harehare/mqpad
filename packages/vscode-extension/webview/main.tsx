import { App, BridgeFileSystem, serializeMqRunner } from "mqpad-app";
import { run } from "mq-web";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const vscodeApi = acquireVsCodeApi();
const fs = new BridgeFileSystem(vscodeApi);

/**
 * Chunked to avoid blowing the call stack on `String.fromCharCode(...bytes)`
 * for a multi-MB PDF - btoa itself only accepts a binary string, not bytes.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Note export (Markdown/HTML/PDF): the webview has no filesystem access
 * outside the vault, so the extension host shows a native save dialog and
 * writes the file (see `handleSaveAs` in extension.ts). Fire-and-forget,
 * matching `mqpad-open-settings`.
 */
async function saveFileExternally(filename: string, blob: Blob): Promise<void> {
  const content = await blobToBase64(blob);
  vscodeApi.postMessage({ source: "mqpad-save-as", filename, content, encoding: "base64" });
}

const MQ_QUERY_TIMEOUT_MS = 60_000;

const mqRunner = serializeMqRunner((query, content) =>
  run(query, content, { inputFormat: "markdown", timeoutMs: MQ_QUERY_TIMEOUT_MS }),
);

function openVaultPathSettings(): void {
  vscodeApi.postMessage({ source: "mqpad-open-settings" });
}

/**
 * Dropping a file from VS Code's own Explorer (or an open editor tab) onto
 * this panel sets `text/uri-list` on the drag, same as dropping onto any
 * other web content - so this needs no special VS Code API, just the
 * standard HTML5 DnD events. The webview has no filesystem access itself, so
 * it just forwards the raw URIs to the extension host (see
 * `openDroppedPaths` in extension.ts), which resolves and opens them via the
 * same command as the Explorer's "Open in mqpad" entry.
 */
function handleDragOver(e: DragEvent): void {
  if (e.dataTransfer?.types.includes("text/uri-list")) e.preventDefault();
}

function handleDrop(e: DragEvent): void {
  const uriList = e.dataTransfer?.getData("text/uri-list");
  if (!uriList) return;
  e.preventDefault();
  const uris = uriList
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (uris.length > 0) vscodeApi.postMessage({ source: "mqpad-open-external-path", uris });
}

window.addEventListener("dragover", handleDragOver);
window.addEventListener("drop", handleDrop);

// Set by the extension host's "Open With > mqpad" custom editor (see
// MqpadPreviewEditorProvider in extension.ts) to open straight into the file
// the user picked, rather than the vault root. Absent for the normal
// "mqpad: Open" panel.
const initialPath = (window as typeof window & { __mqpadInitialPath?: string }).__mqpadInitialPath;

// Set by the extension host from the `mqpad.showFileTree` setting (see
// buildWebviewHtml in extension.ts). Defaults to false: VS Code's own
// Explorer already shows the file tree, so mqpad's starts collapsed here.
const showFileTree = (window as typeof window & { __mqpadShowFileTree?: boolean }).__mqpadShowFileTree ?? false;

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");

createRoot(rootEl).render(
  <StrictMode>
    <App
      fs={fs}
      mqRunner={mqRunner}
      vaultRootLabel="Vault path (mqpad.vaultPath setting)"
      vaultRoot=""
      vaultRootEditable={false}
      onVaultRootChange={openVaultPathSettings}
      initialPath={initialPath}
      quickOpenHotkeyEnabled={false}
      defaultSidebarVisible={showFileTree}
      saveFileExternally={saveFileExternally}
      showBrand={false}
    />
  </StrictMode>,
);
