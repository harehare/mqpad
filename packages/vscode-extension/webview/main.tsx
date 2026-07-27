import { App, BridgeFileSystem, serializeMqRunner } from "mqpad-app";
import { run } from "mq-web";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const vscodeApi = acquireVsCodeApi();
const fs = new BridgeFileSystem(vscodeApi);

const mqRunner = serializeMqRunner((query, content) => run(query, content, { inputFormat: "markdown" }));

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
    />
  </StrictMode>,
);
