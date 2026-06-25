import { App, OPFSFileSystem, SingleFileFileSystem, serializeMqRunner } from "mqpad-app";
import { run } from "mq-web";
import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./main.css";

const VAULT_ROOT_KEY = "mqpad-vault-root";

function getVaultRoot(): string {
  return localStorage.getItem(VAULT_ROOT_KEY) || "mqpad";
}

function setVaultRoot(root: string): void {
  localStorage.setItem(VAULT_ROOT_KEY, root || "mqpad");
  location.reload();
}

function pathFromHash(): string | undefined {
  const hash = decodeURI(location.hash.slice(1));
  return hash || undefined;
}

const vaultRoot = getVaultRoot();
const fs = new OPFSFileSystem(vaultRoot);

const mqRunner = serializeMqRunner((query, content) => run(query, content, { inputFormat: "markdown" }));

/**
 * "Preview mode": a `.md` file dropped onto the page opens directly via the
 * File System Access API, edited and saved in place - no OPFS vault folder
 * needed. `SingleFileFileSystem` presents that one file as a one-entry
 * vault so the normal App/FileTree UI can host it unchanged.
 */
function PreviewApp({ handle, onExit }: { handle: FileSystemFileHandle; onExit: () => void }) {
  const previewFs = useMemo(() => new SingleFileFileSystem(handle), [handle]);
  return (
    <div className="mqpad-preview-mode">
      <button type="button" className="mqpad-preview-exit" onClick={onExit} title="Back to vault">
        ← Back to vault
      </button>
      <App
        fs={previewFs}
        mqRunner={mqRunner}
        vaultRootLabel="Opened directly (no vault)"
        vaultRoot={handle.name}
        vaultRootEditable={false}
        onVaultRootChange={onExit}
        initialPath={`/${handle.name}`}
      />
    </div>
  );
}

function WebApp() {
  // Keeps the open file reflected in the URL (so reload/back/forward and
  // sharing a link land on the same note), without needing server-side
  // routes - a hash fragment works for any static host.
  const [path, setPath] = useState<string | undefined>(pathFromHash);
  const [previewHandle, setPreviewHandle] = useState<FileSystemFileHandle | null>(null);

  useEffect(() => {
    const onHashChange = () => setPath(pathFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Dropping a real OS file (not the file tree's own internal drag-to-move,
  // which only carries a "text/plain" path) onto the page opens it directly
  // via the File System Access API, bypassing the vault entirely.
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const handleDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      const item = e.dataTransfer.items[0];
      if (!item?.getAsFileSystemHandle) return;
      void item.getAsFileSystemHandle().then((handle) => {
        if (handle?.kind === "file" && handle.name.endsWith(".md")) {
          setPreviewHandle(handle as FileSystemFileHandle);
        }
      });
    };
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  const handleActivePathChange = useCallback((next: string | null) => {
    // Track the active path locally too, not just in the URL - otherwise
    // opening a new file via the UI (which doesn't touch `path`) leaves it
    // stale, and navigating back to a hash that happens to match that stale
    // value is a same-value setState that React skips, so the editor never
    // actually switches back.
    setPath(next ?? undefined);
    if (decodeURI(location.hash.slice(1)) === (next ?? "")) return;
    const nextHash = next ? encodeURI(next) : "";
    if (nextHash) {
      history.pushState(null, "", `#${nextHash}`);
    } else {
      history.pushState(null, "", location.pathname + location.search);
    }
  }, []);

  if (previewHandle) {
    return <PreviewApp handle={previewHandle} onExit={() => setPreviewHandle(null)} />;
  }

  return (
    <App
      fs={fs}
      mqRunner={mqRunner}
      vaultRootLabel="OPFS folder name"
      vaultRoot={vaultRoot}
      onVaultRootChange={setVaultRoot}
      initialPath={path}
      onActivePathChange={handleActivePathChange}
    />
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");

createRoot(rootEl).render(
  <StrictMode>
    <WebApp />
  </StrictMode>,
);
