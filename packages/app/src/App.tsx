import { useCallback, useEffect, useRef, useState } from "react";
import { VscGear } from "react-icons/vsc";
import { LuCode, LuFocus, LuPanelLeft } from "react-icons/lu";
import type { FileSystem, FileNode } from "./fs/types";
import { MqRunnerProvider, type MqRunner } from "./mq/MqRunnerContext";
import { MqpadEditor, type EditorStats } from "./editor/Editor";
import { SourceView } from "./editor/SourceView";
import { FileTree } from "./components/FileTree";
import { Logo } from "./components/Logo";
import { TabBar, type Tab } from "./components/TabBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette, type Command } from "./components/CommandPalette";
import { WelcomeDialog } from "./components/WelcomeDialog";
import { FileChangedBanner } from "./components/FileChangedBanner";
import { THEME_LABELS, type ThemeName } from "./theme/themes";
import { useTheme } from "./theme/useTheme";
import { usePreferences } from "./theme/usePreferences";
import { usePinnedNotes } from "./usePinnedNotes";
import { useFirstRun } from "./useFirstRun";
import "./theme.css";
import "./App.css";

function isShortcut(e: KeyboardEvent, key: string, shift = false): boolean {
  return (e.metaKey || e.ctrlKey) && e.shiftKey === shift && e.key.toLowerCase() === key;
}

export type AppProps = {
  fs: FileSystem;
  mqRunner: MqRunner;
  vaultRootLabel: string;
  vaultRoot: string;
  vaultRootEditable?: boolean;
  onVaultRootChange: (root: string) => void;
  /** Opens this path on mount, and again whenever the caller changes it (e.g. on browser back/forward). */
  initialPath?: string;
  /** Called whenever the open file changes, so a host (e.g. the web app) can reflect it in the URL. */
  onActivePathChange?: (path: string | null) => void;
};

type OpenFile = {
  content: string;
  savedContent: string;
};

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

function basenameWithoutExt(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return name.replace(/\.md$/, "");
}

const AUTOSAVE_DEBOUNCE_MS = 400;

export function App({
  fs,
  mqRunner,
  vaultRootLabel,
  vaultRoot,
  vaultRootEditable = true,
  onVaultRootChange,
  initialPath,
  onActivePathChange,
}: AppProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<Record<string, OpenFile>>({});
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const [preferences, setPreferences] = usePreferences();
  const [pinnedPaths, togglePin] = usePinnedNotes();
  const [fsReady, setFsReady] = useState(false);
  const [stats, setStats] = useState<EditorStats | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [welcomeSeen, markWelcomeSeen] = useFirstRun();
  const [welcomeOpen, setWelcomeOpen] = useState(!welcomeSeen);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const watchers = useRef<Record<string, () => void>>({});
  const openFilesRef = useRef<Record<string, OpenFile>>({});
  // Paths whose disk content has diverged from a tab with unsaved edits -
  // surfaced as a banner once that tab is active, until the user resolves it.
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  // Path that was just silently re-synced from disk (no local edits were at
  // risk) - shown as a transient, dismissible notice rather than a conflict.
  const [reloadedPath, setReloadedPath] = useState<string | null>(null);

  useEffect(() => {
    openFilesRef.current = openFiles;
  }, [openFiles]);

  const refreshFiles = useCallback(async () => {
    setFiles(await fs.listFiles("/"));
  }, [fs]);

  const handleExternalChange = useCallback(
    async (path: string) => {
      const diskContent = await fs.readFile(path).catch(() => null);
      if (diskContent === null) return;
      const file = openFilesRef.current[path];
      // Already matches what we have (e.g. our own writeFile echoing back through the watcher) - nothing to do.
      if (!file || diskContent === file.savedContent) return;
      if (file.content === file.savedContent) {
        setOpenFiles((prev) => ({ ...prev, [path]: { content: diskContent, savedContent: diskContent } }));
        setReloadedPath(path);
      } else {
        setConflicts((prev) => ({ ...prev, [path]: diskContent }));
      }
    },
    [fs],
  );

  useEffect(() => {
    if (!reloadedPath) return;
    const timer = setTimeout(() => setReloadedPath(null), 4000);
    return () => clearTimeout(timer);
  }, [reloadedPath]);

  useEffect(() => {
    fs.initialize()
      .then(refreshFiles)
      .then(() => setFsReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fs]);

  const openFile = useCallback(
    async (path: string) => {
      if (!openFiles[path]) {
        const content = await fs.readFile(path).catch(() => "");
        setOpenFiles((prev) => ({ ...prev, [path]: { content, savedContent: content } }));
        setTabOrder((prev) => (prev.includes(path) ? prev : [...prev, path]));
        if (fs.watch && !watchers.current[path]) {
          watchers.current[path] = fs.watch(path, () => handleExternalChange(path));
        }
      }
      setActivePath(path);
    },
    [fs, openFiles, handleExternalChange],
  );

  // Re-runs whenever the host changes `initialPath` (e.g. the web app
  // reacting to a browser back/forward navigation), not just on mount. Waits
  // for `fsReady` so the very first run doesn't race fs.initialize() and
  // silently "open" the file as empty content.
  useEffect(() => {
    if (fsReady && initialPath) void openFile(initialPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPath, fsReady]);

  // Skips reporting the initial `null` while an `initialPath`-driven open is
  // still pending (e.g. right after a page reload) - otherwise a host that
  // mirrors this into a URL would briefly see "no file open" and clobber the
  // very state it's trying to restore. A *later* transition back to null
  // (e.g. the user closes the last tab) still reports, since `hasOpened`
  // will be true by then.
  const hasOpened = useRef(false);
  useEffect(() => {
    if (activePath === null && !hasOpened.current) return;
    hasOpened.current = true;
    onActivePathChange?.(activePath);
  }, [activePath, onActivePathChange]);

  const closeTab = useCallback(
    (path: string) => {
      watchers.current[path]?.();
      delete watchers.current[path];
      setTabOrder((prev) => prev.filter((p) => p !== path));
      setOpenFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      setConflicts((prev) => {
        if (!(path in prev)) return prev;
        const next = { ...prev };
        delete next[path];
        return next;
      });
      setActivePath((current) => {
        if (current !== path) return current;
        const remaining = tabOrder.filter((p) => p !== path);
        return remaining[remaining.length - 1] ?? null;
      });
    },
    [tabOrder],
  );

  const scheduleSave = useCallback(
    (path: string, content: string) => {
      const timers = saveTimers.current;
      if (timers[path]) clearTimeout(timers[path]);
      timers[path] = setTimeout(() => {
        fs.writeFile(path, content).then(() => {
          setOpenFiles((prev) =>
            prev[path] ? { ...prev, [path]: { ...prev[path], savedContent: content } } : prev,
          );
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [fs],
  );

  const handleEditorChange = useCallback(
    (markdown: string) => {
      if (!activePath) return;
      setOpenFiles((prev) => ({
        ...prev,
        [activePath]: { content: markdown, savedContent: prev[activePath]?.savedContent ?? "" },
      }));
      scheduleSave(activePath, markdown);
    },
    [activePath, scheduleSave],
  );

  const resolveWikiLinkTarget = useCallback(
    (title: string) => `${activePath ? dirname(activePath) : ""}/${title}.md`,
    [activePath],
  );

  const ensureWikiLinkFileExists = useCallback(
    (path: string) => {
      fs.fileExists(path).then((exists) => {
        if (!exists) {
          fs.writeFile(path, `# ${basenameWithoutExt(path)}\n`).then(refreshFiles);
        }
      });
    },
    [fs, refreshFiles],
  );

  const handleCreateFile = useCallback(
    (parentPath: string | undefined, fileName: string) => {
      const name = fileName.includes(".") ? fileName : `${fileName}.md`;
      const path = `${parentPath ?? ""}/${name}`;
      fs.writeFile(path, "").then(refreshFiles).then(() => openFile(path));
    },
    [fs, refreshFiles, openFile],
  );

  const handleCreateFolder = useCallback(
    (parentPath: string | undefined, folderName: string) => {
      fs.createDirectory(`${parentPath ?? ""}/${folderName}`).then(refreshFiles);
    },
    [fs, refreshFiles],
  );

  const handleDeleteFile = useCallback(
    async (path: string) => {
      if (await fs.isDirectoryPath(path)) {
        await fs.deleteDirectory(path);
      } else {
        await fs.deleteFile(path);
        closeTab(path);
      }
      refreshFiles();
    },
    [fs, refreshFiles, closeTab],
  );

  const handleRenameFile = useCallback(
    async (oldPath: string, newName: string) => {
      const newPath = `${dirname(oldPath)}/${newName}`;
      await fs.renameFile(oldPath, newPath);
      refreshFiles();
    },
    [fs, refreshFiles],
  );

  const handleMoveFile = useCallback(
    async (sourcePath: string, targetDirPath: string) => {
      const base = sourcePath.slice(sourcePath.lastIndexOf("/") + 1);
      const targetDir = targetDirPath === "/" || targetDirPath === "" ? "" : targetDirPath;
      await fs.renameFile(sourcePath, `${targetDir}/${base}`);
      refreshFiles();
    },
    [fs, refreshFiles],
  );

  // Disposes every active watcher on unmount; per-tab disposal happens in closeTab.
  useEffect(() => {
    return () => {
      for (const unwatch of Object.values(watchers.current)) unwatch();
    };
  }, []);

  const resolveConflict = useCallback((path: string, useDiskContent: boolean) => {
    if (useDiskContent) {
      setOpenFiles((prev) => {
        const diskContent = conflicts[path];
        return diskContent === undefined
          ? prev
          : { ...prev, [path]: { content: diskContent, savedContent: diskContent } };
      });
    }
    setConflicts((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflicts]);

  const tabs: Tab[] = tabOrder.map((path) => ({
    id: path,
    filePath: path,
    isDirty: openFiles[path]?.content !== openFiles[path]?.savedContent,
  }));

  const activeContent = activePath ? openFiles[activePath]?.content ?? "" : "";
  const activeIsDirty = activePath ? openFiles[activePath]?.content !== openFiles[activePath]?.savedContent : false;
  const activeConflict = activePath ? conflicts[activePath] : undefined;

  // The editor remounts (key={activePath}) on file switch, so drop the
  // previous file's stats rather than showing them briefly against the new one.
  useEffect(() => {
    setStats(null);
  }, [activePath]);

  // Global shortcuts: Cmd/Ctrl+Shift+M toggles raw markdown source mode,
  // Cmd/Ctrl+Shift+Enter toggles distraction-free focus mode, Cmd/Ctrl+K
  // opens the command palette.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isShortcut(e, "m", true)) {
        e.preventDefault();
        setSourceMode((v) => !v);
      } else if (isShortcut(e, "enter", true)) {
        e.preventDefault();
        setFocusMode((v) => !v);
      } else if (isShortcut(e, "b")) {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      } else if (isShortcut(e, "k")) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paletteOpen]);

  const commands: Command[] = [
    {
      id: "new-file",
      label: "New File",
      onRun: () => handleCreateFile(activePath ? dirname(activePath) : undefined, "Untitled.md"),
    },
    {
      id: "new-folder",
      label: "New Folder",
      onRun: () => handleCreateFolder(activePath ? dirname(activePath) : undefined, "New Folder"),
    },
    {
      id: "toggle-source-mode",
      label: sourceMode ? "Switch to WYSIWYG Mode" : "Switch to Markdown Source Mode",
      hint: "Cmd+Shift+M",
      onRun: () => setSourceMode((v) => !v),
    },
    {
      id: "toggle-focus-mode",
      label: focusMode ? "Exit Focus Mode" : "Enter Focus Mode",
      hint: "Cmd+Shift+Enter",
      onRun: () => setFocusMode((v) => !v),
    },
    {
      id: "toggle-file-tree",
      label: sidebarVisible ? "Hide File Tree" : "Show File Tree",
      hint: "Cmd+B",
      onRun: () => setSidebarVisible((v) => !v),
    },
    { id: "open-settings", label: "Open Settings", onRun: () => setSettingsOpen(true) },
    { id: "show-welcome", label: "Show Welcome Tutorial", onRun: () => setWelcomeOpen(true) },
    ...Object.entries(THEME_LABELS).map(([name, label]) => ({
      id: `theme-${name}`,
      label: `Theme: ${label}`,
      onRun: () => setTheme(name as ThemeName),
    })),
  ];

  return (
    <MqRunnerProvider value={mqRunner}>
      <div className={`mqpad-app ${focusMode ? "mqpad-focus-mode" : ""}`}>
        <div className="mqpad-titlebar">
          <div className="mqpad-titlebar-brand">
            <Logo size={18} />
            <span className="mqpad-titlebar-title">mqpad</span>
          </div>
          <div className="mqpad-titlebar-actions">
            <button
              className={`mqpad-titlebar-settings ${sidebarVisible ? "active" : ""}`}
              onClick={() => setSidebarVisible((v) => !v)}
              title="Toggle File Tree (Cmd+B)"
            >
              <LuPanelLeft size={16} />
            </button>
            <button
              className={`mqpad-titlebar-settings ${sourceMode ? "active" : ""}`}
              onClick={() => setSourceMode((v) => !v)}
              title="Toggle Markdown Source Mode (Cmd+Shift+M)"
            >
              <LuCode size={16} />
            </button>
            <button
              className={`mqpad-titlebar-settings ${focusMode ? "active" : ""}`}
              onClick={() => setFocusMode((v) => !v)}
              title="Toggle Focus Mode (Cmd+Shift+Enter)"
            >
              <LuFocus size={16} />
            </button>
            <button className="mqpad-titlebar-settings" onClick={() => setSettingsOpen(true)} title="Settings">
              <VscGear size={16} />
            </button>
          </div>
        </div>
        <div className="mqpad-body">
          <div className={`mqpad-sidebar ${sidebarVisible ? "" : "mqpad-sidebar-hidden"}`}>
            <FileTree
              files={files}
              onFileSelect={openFile}
              onRefresh={refreshFiles}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onDeleteFile={handleDeleteFile}
              onRenameFile={handleRenameFile}
              onMoveFile={handleMoveFile}
              selectedFile={activePath}
              pinnedPaths={pinnedPaths}
              onTogglePin={togglePin}
            />
          </div>
          <div className="mqpad-main">
            <TabBar tabs={tabs} activeTabId={activePath} onTabClick={openFile} onTabClose={closeTab} />
            {activePath && activeConflict !== undefined && (
              <FileChangedBanner
                message="This file changed on disk outside mqpad."
                actions={[
                  { label: "Reload from disk", onClick: () => resolveConflict(activePath, true) },
                  { label: "Keep my edits", onClick: () => resolveConflict(activePath, false) },
                ]}
              />
            )}
            {activePath && activeConflict === undefined && reloadedPath === activePath && (
              <FileChangedBanner
                message="Reloaded — this file was updated outside mqpad."
                onDismiss={() => setReloadedPath(null)}
              />
            )}
            <div className="mqpad-editor-area">
              {activePath ? (
                sourceMode ? (
                  <SourceView
                    markdown={activeContent}
                    onChange={handleEditorChange}
                    direction={preferences.direction}
                  />
                ) : (
                  <MqpadEditor
                    key={activePath}
                    markdown={activeContent}
                    onChange={handleEditorChange}
                    onNavigate={openFile}
                    resolveWikiLinkTarget={resolveWikiLinkTarget}
                    ensureWikiLinkFileExists={ensureWikiLinkFileExists}
                    onStatsChange={setStats}
                    direction={preferences.direction}
                  />
                )
              ) : (
                <div className="mqpad-empty-state">
                  <Logo size={36} />
                  <p>Select or create a file to start editing.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <StatusBar
          activePath={activePath}
          isDirty={activeIsDirty}
          stats={activePath ? stats : null}
          vaultRootLabel={vaultRootLabel}
          themeLabel={THEME_LABELS[theme]}
        />
      </div>
      {settingsOpen && (
        <SettingsDialog
          vaultRootLabel={vaultRootLabel}
          vaultRoot={vaultRoot}
          vaultRootEditable={vaultRootEditable}
          theme={theme}
          onThemeChange={setTheme}
          preferences={preferences}
          onPreferencesChange={setPreferences}
          onSave={onVaultRootChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      {welcomeOpen && (
        <WelcomeDialog
          onClose={() => {
            setWelcomeOpen(false);
            markWelcomeSeen();
          }}
        />
      )}
    </MqRunnerProvider>
  );
}
