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

// Set by the extension host's "Open With > mqpad" custom editor (see
// MqpadPreviewEditorProvider in extension.ts) to open straight into the file
// the user picked, rather than the vault root. Absent for the normal
// "mqpad: Open" panel.
const initialPath = (window as typeof window & { __mqpadInitialPath?: string }).__mqpadInitialPath;

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
    />
  </StrictMode>,
);
