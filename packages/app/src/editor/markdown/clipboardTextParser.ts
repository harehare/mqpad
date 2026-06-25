import type { ResolvedPos } from "@tiptap/pm/model";
import { Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { buildMarkdownParser } from "./index";

/**
 * Matches the markdown syntax we actually parse (headings, lists,
 * blockquotes, fences, tables, wikilinks, and the common inline marks) -
 * deliberately narrow so an ordinary sentence containing a lone "*" or "#"
 * isn't misread as markdown and pasted as literal block content.
 */
const MARKDOWN_PATTERN =
  /^ {0,3}(#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s|```|~~~|\$\$|\|.+\|)|\*\*[^\n]+\*\*|__[^\n]+__|`[^`\n]+`|~~[^\n]+~~|\[.+?\]\(.+?\)|\[\[.+?\]\]/m;

/**
 * Tags that only show up in *genuinely* rich HTML (a rendered markdown
 * preview, a word processor, a browser selection) - as opposed to the bare
 * `<pre>`/`<span>` wrapper most code editors and terminals (VS Code, Sublime,
 * Terminal.app, iTerm) put around a plain-text copy of the same markdown
 * source. Used to decide whether an HTML clipboard payload is worth
 * preserving over re-parsing the plain-text markdown ourselves.
 */
const RICH_HTML_PATTERN = /<(h[1-6]|strong|b|em|i|u|ul|ol|table|a|img|blockquote)[\s>]/i;

/**
 * A ProseMirror `clipboardTextParser`: reparses plain-text pastes that look
 * like markdown into real nodes/marks instead of inserting the raw syntax as
 * text. `undefined` falls back to ProseMirror's default per-line-paragraph
 * behavior - cast to satisfy `EditorProps["clipboardTextParser"]`, whose
 * declared `Slice` return type doesn't admit that, even though
 * `view.someProp` (its only caller) treats falsy results as "no opinion".
 */
export function clipboardTextParser(text: string, _$context: ResolvedPos, plain: boolean, view: EditorView): Slice | undefined {
  if (plain || !MARKDOWN_PATTERN.test(text)) return undefined;
  const doc = buildMarkdownParser(view.state.schema).parse(text.replace(/\r\n?/g, "\n"));
  if (doc.content.size === 0) return undefined;
  return new Slice(doc.content, 0, 0);
}

/**
 * A ProseMirror `handlePaste`: takes over from ProseMirror's normal
 * HTML-clipboard path when the paste carries an HTML payload alongside
 * markdown-looking plain text. Without this, `clipboardTextParser` above
 * never even runs - ProseMirror only consults it when there's no HTML on the
 * clipboard at all (see `parseFromClipboard`'s `asText` check). Most code
 * editors and terminals *do* attach an HTML payload to a plain-text copy
 * (typically a bare `<pre>`/`<span>` wrapper for syntax-highlighting colors),
 * and StarterKit's CodeBlock has a blanket `parseHTML: () => [{ tag: "pre" }]`
 * rule that swallows that whole `<pre>` into one giant code block - which is
 * the "pasting markdown turns everything into a block" symptom this fixes.
 * Genuinely rich HTML (a rendered preview, Word, Google Docs) still wins, so
 * real formatting fidelity from those sources isn't lost.
 */
export function handleMarkdownPaste(view: EditorView, event: ClipboardEvent): boolean {
  const data = event.clipboardData;
  if (!data) return false;
  const text = data.getData("text/plain");
  if (!text || !MARKDOWN_PATTERN.test(text)) return false;
  const html = data.getData("text/html");
  if (html && RICH_HTML_PATTERN.test(html)) return false;
  const doc = buildMarkdownParser(view.state.schema).parse(text.replace(/\r\n?/g, "\n"));
  if (doc.content.size === 0) return false;
  view.dispatch(view.state.tr.replaceSelection(new Slice(doc.content, 0, 0)).scrollIntoView());
  return true;
}
