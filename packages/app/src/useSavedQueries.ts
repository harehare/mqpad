import { useCallback, useState } from "react";

const STORAGE_KEY = "mqpad-saved-queries";

export type SavedQuery = {
  id: string;
  name: string;
  query: string;
  scope: "document" | "vault";
};

function loadSavedQueries(): SavedQuery[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (q): q is SavedQuery =>
        typeof q === "object" &&
        q !== null &&
        typeof q.id === "string" &&
        typeof q.name === "string" &&
        typeof q.query === "string" &&
        (q.scope === "document" || q.scope === "vault"),
    );
  } catch {
    return [];
  }
}

function save(queries: SavedQuery[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
}

function makeId(): string {
  return `query-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Named, reusable `mq` queries (document or vault scope), persisted in localStorage - loadable from the query console or inserted via the `/` slash menu. */
export function useSavedQueries(): {
  savedQueries: SavedQuery[];
  addSavedQuery: (name: string, query: string, scope: "document" | "vault") => void;
  removeSavedQuery: (id: string) => void;
} {
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(loadSavedQueries);

  const addSavedQuery = useCallback((name: string, query: string, scope: "document" | "vault") => {
    setSavedQueries((prev) => {
      const next = [...prev, { id: makeId(), name, query, scope }];
      save(next);
      return next;
    });
  }, []);

  const removeSavedQuery = useCallback((id: string) => {
    setSavedQueries((prev) => {
      const next = prev.filter((q) => q.id !== id);
      save(next);
      return next;
    });
  }, []);

  return { savedQueries, addSavedQuery, removeSavedQuery };
}
