import { createCssVariablesTheme } from "shiki";
import { createHighlighterCore, type HighlighterGeneric } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import mqGrammar from "./mq.tmLanguage.json";

// Each language is a separate static import (rather than passing string ids
// to shiki's convenience `createHighlighter`) so bundlers only include the
// ones actually used - shiki's string-id loading path resolves through a
// dynamic import across its *entire* bundled-language registry, which made
// Vite emit a separate chunk for every language shiki ships (hundreds of
// files) instead of just these ~30. The JS regex engine (vs. the oniguruma
// wasm one) avoids shipping a ~600kb wasm binary for the same reason.
import bash from "@shikijs/langs/bash";
import c from "@shikijs/langs/c";
import cpp from "@shikijs/langs/cpp";
import csharp from "@shikijs/langs/csharp";
import css from "@shikijs/langs/css";
import diff from "@shikijs/langs/diff";
import dockerfile from "@shikijs/langs/dockerfile";
import go from "@shikijs/langs/go";
import graphql from "@shikijs/langs/graphql";
import html from "@shikijs/langs/html";
import java from "@shikijs/langs/java";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import jsx from "@shikijs/langs/jsx";
import kotlin from "@shikijs/langs/kotlin";
import lua from "@shikijs/langs/lua";
import markdown from "@shikijs/langs/markdown";
import php from "@shikijs/langs/php";
import python from "@shikijs/langs/python";
import ruby from "@shikijs/langs/ruby";
import rust from "@shikijs/langs/rust";
import scss from "@shikijs/langs/scss";
import shell from "@shikijs/langs/shell";
import sql from "@shikijs/langs/sql";
import swift from "@shikijs/langs/swift";
import toml from "@shikijs/langs/toml";
import tsx from "@shikijs/langs/tsx";
import typescript from "@shikijs/langs/typescript";
import xml from "@shikijs/langs/xml";
import yaml from "@shikijs/langs/yaml";

/**
 * Maps tokens to `--shiki-*` CSS variables instead of baking in literal
 * colors, so highlighting tracks whichever mqpad theme is active (each
 * theme sets these vars - see theme/themes.ts) without re-tokenizing on
 * theme switch.
 */
export const CSS_VARIABLES_THEME = createCssVariablesTheme({
  name: "css-variables",
  variablePrefix: "--shiki-",
  fontStyle: true,
});

const BUNDLED_LANGS = [
  javascript,
  jsx,
  typescript,
  tsx,
  json,
  python,
  rust,
  go,
  java,
  c,
  cpp,
  csharp,
  ruby,
  php,
  swift,
  kotlin,
  css,
  scss,
  html,
  xml,
  yaml,
  toml,
  bash,
  shell,
  sql,
  markdown,
  dockerfile,
  graphql,
  lua,
  diff,
];

export const SUPPORTED_LANGS = new Set<string>([
  ...BUNDLED_LANGS.map((mod) => mod[0]?.name).filter((name): name is string => Boolean(name)),
  "plaintext",
  "mq",
]);

// Lang ids are looked up dynamically at runtime (gated through
// SUPPORTED_LANGS, see below) rather than known statically, so the
// highlighter is widened to plain strings - the precise BundledLanguage
// union createHighlighter() infers is too narrow to assign a runtime string
// into.
type Highlighter = HighlighterGeneric<string, string>;

let highlighter: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

function loadHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = (
      createHighlighterCore({
        themes: [CSS_VARIABLES_THEME],
        langs: [...BUNDLED_LANGS, mqGrammar],
        engine: createJavaScriptRegexEngine(),
      }) as unknown as Promise<Highlighter>
    ).then((hl) => {
      highlighter = hl;
      return hl;
    });
  }
  return highlighterPromise;
}

/** Resolves once highlighting is available - callers can force a re-render afterwards to pick up real colors. */
export async function whenHighlighterReady(): Promise<void> {
  await loadHighlighter();
}

export type HighlightToken = {
  content: string;
  /** Character offset within the full `code` string passed in - spans newlines, not per-line. */
  offset: number;
  color?: string;
  fontStyle?: number;
};

/** Synchronous - only call once `whenHighlighterReady()` has resolved. Returns null for an unsupported language. */
export function tokenizeSync(code: string, lang: string | null | undefined): HighlightToken[][] | null {
  if (!highlighter) return null;
  const resolved = lang && SUPPORTED_LANGS.has(lang) ? lang : "plaintext";
  try {
    return highlighter.codeToTokensBase(code, { lang: resolved, theme: "css-variables" });
  } catch {
    return null;
  }
}

/** Async convenience for one-off renders (e.g. the mq query overlay) that don't need to wait on a shared readiness flag. */
export async function highlightToHtml(code: string, lang: string | null | undefined): Promise<string> {
  const hl = await loadHighlighter();
  const resolved = lang && SUPPORTED_LANGS.has(lang) ? lang : "plaintext";
  try {
    return hl.codeToHtml(code, { lang: resolved, theme: "css-variables" });
  } catch {
    return hl.codeToHtml(code, { lang: "plaintext", theme: "css-variables" });
  }
}
