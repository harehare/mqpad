import { useCallback, useLayoutEffect, useState } from "react";

export type FontChoice = "serif" | "sans" | "mono";
export type PageWidth = "narrow" | "medium" | "wide" | "full";
export type TextDirection = "ltr" | "rtl";

export type Preferences = {
  font: FontChoice;
  pageWidth: PageWidth;
  direction: TextDirection;
};

const STORAGE_KEY = "mqpad-preferences";

const DEFAULT_PREFERENCES: Preferences = {
  font: "serif",
  pageWidth: "medium",
  direction: "ltr",
};

export const FONT_LABELS: Record<FontChoice, string> = {
  serif: "Serif",
  sans: "Sans-serif",
  mono: "Monospace",
};

export const PAGE_WIDTH_LABELS: Record<PageWidth, string> = {
  narrow: "Narrow",
  medium: "Medium",
  wide: "Wide",
  full: "Full width",
};

const FONT_STACKS: Record<FontChoice, string> = {
  serif: '"Iowan Old Style", "Palatino Linotype", "Georgia", serif',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "SF Mono", Consolas, monospace',
};

const PAGE_WIDTHS: Record<PageWidth, string> = {
  narrow: "640px",
  medium: "780px",
  wide: "980px",
  full: "100%",
};

function isPreferences(value: unknown): value is Partial<Preferences> {
  return typeof value === "object" && value !== null;
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return isPreferences(parsed) ? { ...DEFAULT_PREFERENCES, ...parsed } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function applyPreferences(prefs: Preferences): void {
  const root = document.documentElement.style;
  root.setProperty("--mqpad-prose-font", FONT_STACKS[prefs.font]);
  root.setProperty("--mqpad-page-width", PAGE_WIDTHS[prefs.pageWidth]);
}

export function usePreferences(): [Preferences, (next: Partial<Preferences>) => void] {
  const [preferences, setPreferencesState] = useState<Preferences>(loadPreferences);

  useLayoutEffect(() => {
    applyPreferences(preferences);
  }, [preferences]);

  const setPreferences = useCallback((next: Partial<Preferences>) => {
    setPreferencesState((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  return [preferences, setPreferences];
}
