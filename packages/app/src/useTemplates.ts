import { useCallback, useState } from "react";

const STORAGE_KEY = "mqpad-templates";

export type Template = {
  id: string;
  name: string;
  content: string;
};

function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is Template =>
        typeof t === "object" &&
        t !== null &&
        typeof t.id === "string" &&
        typeof t.name === "string" &&
        typeof t.content === "string",
    );
  } catch {
    return [];
  }
}

function saveTemplates(templates: Template[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

function makeId(): string {
  return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Reusable note templates (name + Markdown body), persisted in localStorage - inserted via "New File from Template..." or the `/` slash menu. */
export function useTemplates(): {
  templates: Template[];
  addTemplate: (name: string, content: string) => void;
  removeTemplate: (id: string) => void;
} {
  const [templates, setTemplates] = useState<Template[]>(loadTemplates);

  const addTemplate = useCallback((name: string, content: string) => {
    setTemplates((prev) => {
      const next = [...prev, { id: makeId(), name, content }];
      saveTemplates(next);
      return next;
    });
  }, []);

  const removeTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveTemplates(next);
      return next;
    });
  }, []);

  return { templates, addTemplate, removeTemplate };
}
