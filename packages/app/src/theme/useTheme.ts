import { useCallback, useLayoutEffect, useState } from "react";
import { DEFAULT_THEME, themes, type ThemeName } from "./themes";

const STORAGE_KEY = "mqpad-theme";

function isThemeName(value: string | null): value is ThemeName {
  return value !== null && value in themes;
}

function applyTheme(name: ThemeName): void {
  const tokens = themes[name];
  const root = document.documentElement.style;
  root.setProperty("--mqpad-bg", tokens.bg);
  root.setProperty("--mqpad-surface", tokens.surface);
  root.setProperty("--mqpad-surface-raised", tokens.surfaceRaised);
  root.setProperty("--mqpad-surface-sunken", tokens.surfaceSunken);
  root.setProperty("--mqpad-tree-bg", tokens.treeBg);
  root.setProperty("--mqpad-tree-title", tokens.treeTitle);
  root.setProperty("--mqpad-tree-item-hover", tokens.treeItemHover);
  root.setProperty("--mqpad-tree-item-selected", tokens.treeItemSelected);
  root.setProperty("--mqpad-border", tokens.border);
  root.setProperty("--mqpad-text", tokens.text);
  root.setProperty("--mqpad-text-muted", tokens.textMuted);
  root.setProperty("--mqpad-accent", tokens.accent);
  root.setProperty("--mqpad-accent-soft", tokens.accentSoft);
  root.setProperty("--mqpad-accent-contrast", tokens.accentContrast);
  root.setProperty("--mqpad-context-menu-bg", tokens.contextMenuBg);
  root.setProperty("--mqpad-context-menu-hover-bg", tokens.contextMenuHoverBg);
  root.setProperty("--mqpad-error", tokens.error);

  // Consumed by Shiki's css-variables theme (see highlight/highlighter.ts) -
  // lets syntax highlighting track the active theme without re-tokenizing.
  root.setProperty("--shiki-foreground", tokens.text);
  root.setProperty("--shiki-background", tokens.surfaceSunken);
  root.setProperty("--shiki-token-keyword", tokens.synKeyword);
  root.setProperty("--shiki-token-string", tokens.synString);
  root.setProperty("--shiki-token-string-expression", tokens.synString);
  root.setProperty("--shiki-token-comment", tokens.synComment);
  root.setProperty("--shiki-token-function", tokens.synFunction);
  root.setProperty("--shiki-token-parameter", tokens.text);
  root.setProperty("--shiki-token-constant", tokens.synConstant);
  root.setProperty("--shiki-token-punctuation", tokens.synPunctuation);
  root.setProperty("--shiki-token-link", tokens.synKeyword);
}

export function useTheme(): [ThemeName, (name: ThemeName) => void] {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeName(stored) ? stored : DEFAULT_THEME;
  });

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((name: ThemeName) => {
    localStorage.setItem(STORAGE_KEY, name);
    setThemeState(name);
  }, []);

  return [theme, setTheme];
}
