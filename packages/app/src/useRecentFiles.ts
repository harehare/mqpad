import { useCallback, useState } from "react";

const STORAGE_KEY = "mqpad-recent-files";
const MAX_RECENT = 20;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function saveRecent(paths: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

/** Most-recently-opened note paths (most recent first), persisted in localStorage, surfaced at the top of Quick Open. */
export function useRecentFiles(): [string[], (path: string) => void] {
  const [recent, setRecent] = useState<string[]>(loadRecent);

  const recordOpen = useCallback((path: string) => {
    setRecent((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, MAX_RECENT);
      saveRecent(next);
      return next;
    });
  }, []);

  return [recent, recordOpen];
}
