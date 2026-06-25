import { useCallback, useState } from "react";

const STORAGE_KEY = "mqpad-pinned-notes";

function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function savePinned(paths: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

/** Pinned note paths (file tree), persisted in localStorage and surfaced first within each folder. */
export function usePinnedNotes(): [string[], (path: string) => void] {
  const [pinned, setPinned] = useState<string[]>(loadPinned);

  const togglePin = useCallback((path: string) => {
    setPinned((prev) => {
      const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
      savePinned(next);
      return next;
    });
  }, []);

  return [pinned, togglePin];
}
