import type { EditorStats } from "../editor/Editor";
import "./StatusBar.css";

export type StatusBarProps = {
  activePath: string | null;
  isDirty: boolean;
  stats: EditorStats | null;
  vaultRootLabel: string;
  themeLabel: string;
};

export function StatusBar({ activePath, isDirty, stats, vaultRootLabel, themeLabel }: StatusBarProps) {
  return (
    <footer className="mqpad-statusbar">
      <div className="mqpad-statusbar-side">
        {activePath ? (
          <>
            <span className="mqpad-statusbar-item mqpad-statusbar-path">{activePath}</span>
            <span className={`mqpad-statusbar-item ${isDirty ? "mqpad-statusbar-dirty" : ""}`}>
              {isDirty ? "Unsaved changes" : "Saved"}
            </span>
          </>
        ) : (
          <span className="mqpad-statusbar-item">{vaultRootLabel}</span>
        )}
      </div>
      <div className="mqpad-statusbar-side mqpad-statusbar-side-right">
        {stats && (
          <>
            <span className="mqpad-statusbar-item">
              Ln {stats.line}/{stats.lineCount}, Col {stats.col}
            </span>
            <span className="mqpad-statusbar-item">{stats.words} words</span>
            <span className="mqpad-statusbar-item">{stats.characters} chars</span>
          </>
        )}
        <span className="mqpad-statusbar-item">{themeLabel}</span>
      </div>
    </footer>
  );
}
