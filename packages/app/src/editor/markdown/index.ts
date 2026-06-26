import type { Node as ProseMirrorNode, Schema } from "@tiptap/pm/model";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import {
  MarkdownParser,
  MarkdownSerializer,
  type MarkdownSerializerState,
} from "prosemirror-markdown";
import { mathBlockRule } from "./mathBlockRule";
import { mqFenceRule } from "./mqFenceRule";
import { tableCellRule } from "./tableCellRule";
import { taskListRule } from "./taskListRule";
import { underlineRule } from "./underlineRule";
import { wikiLinkRule } from "./wikiLinkRule";

export function createMarkdownIt(): MarkdownIt {
  // "default" (not "commonmark") preset, so built-in extras we rely on -
  // strikethrough and GFM tables in particular - stay enabled.
  const md = new MarkdownIt("default", { html: false });
  wikiLinkRule(md);
  mqFenceRule(md);
  mathBlockRule(md);
  underlineRule(md);
  tableCellRule(md);
  taskListRule(md);
  return md;
}

type CellAlign = "left" | "right" | "center" | null;

function tableCellAlign(tok: Token): CellAlign {
  const style = tok.attrGet("style");
  const match = style ? /text-align:\s*(left|right|center)/.exec(style) : null;
  return (match?.[1] as CellAlign) ?? null;
}

/**
 * Builds a MarkdownParser bound to the live Tiptap schema. Node/mark names
 * below match Tiptap's StarterKit naming (camelCase), which differs from
 * prosemirror-markdown's own defaultMarkdownParser (snake_case, basic
 * schema) - so this is hand-written rather than reusing those defaults.
 */
export function buildMarkdownParser(schema: Schema): MarkdownParser {
  return new MarkdownParser(schema, createMarkdownIt(), {
    blockquote: { block: "blockquote" },
    paragraph: { block: "paragraph" },
    list_item: { block: "listItem" },
    bullet_list: { block: "bulletList" },
    ordered_list: {
      block: "orderedList",
      getAttrs: (tok) => ({ start: +(tok.attrGet("start") ?? 1) || 1 }),
    },
    heading: {
      block: "heading",
      getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
    },
    code_block: { block: "codeBlock", noCloseToken: true },
    fence: {
      block: "codeBlock",
      getAttrs: (tok) => ({ language: tok.info || null }),
      noCloseToken: true,
    },
    // "node" (not "block") form: the query/result live in attrs, not as
    // text-content children, so the parser shouldn't try to insert the
    // fence's raw content as a text node.
    mq_fence: {
      node: "mqCodeBlock",
      getAttrs: (tok) => ({
        query: tok.content.replace(/\n$/, ""),
        result: (tok.meta?.result ?? "").replace(/\n$/, ""),
      }),
    },
    math_block: {
      node: "mathBlock",
      getAttrs: (tok) => ({ source: tok.content.replace(/\n$/, "") }),
    },
    wikilink: {
      node: "wikiLink",
      getAttrs: (tok) => ({
        title: tok.meta.title as string,
        alias: (tok.meta.alias as string | null) ?? null,
      }),
    },
    hr: { node: "horizontalRule" },
    hardbreak: { node: "hardBreak" },

    table: { block: "table" },
    thead: { ignore: true },
    tbody: { ignore: true },
    tr: { block: "tableRow" },
    th: { block: "tableHeader", getAttrs: (tok) => ({ align: tableCellAlign(tok) }) },
    td: { block: "tableCell", getAttrs: (tok) => ({ align: tableCellAlign(tok) }) },

    task_list: { block: "taskList" },
    task_item: {
      block: "taskItem",
      getAttrs: (tok) => ({ checked: tok.meta?.checked === true }),
    },

    image: {
      node: "image",
      getAttrs: (tok) => ({
        src: tok.attrGet("src"),
        alt: tok.children?.[0]?.content ?? null,
        title: tok.attrGet("title") ?? null,
      }),
    },

    em: { mark: "italic" },
    strong: { mark: "bold" },
    s: { mark: "strike" },
    link: {
      mark: "link",
      getAttrs: (tok) => ({
        href: tok.attrGet("href"),
        title: tok.attrGet("title") ?? null,
      }),
    },
    code_inline: { mark: "code", noCloseToken: true },
    u: { mark: "underline" },
  });
}

function quote(title: string): string {
  if (!title.includes('"')) return `"${title}"`;
  if (!title.includes("'")) return `'${title}'`;
  return `(${title})`;
}

function tableAlignMarker(align: CellAlign): string {
  if (align === "center") return ":---:";
  if (align === "right") return "---:";
  if (align === "left") return ":---";
  return "---";
}

/**
 * `out` (the serializer's output buffer) is `@internal` in
 * prosemirror-markdown's published types but very much present at runtime -
 * this narrows the unsafe cast to one place.
 */
function outBuffer(state: MarkdownSerializerState): { out: string } {
  return state as unknown as { out: string };
}

/**
 * Renders a cell's content to plain text for a pipe-table row. Writes
 * through the serializer's own inline rendering (so marks/escaping match the
 * rest of the doc) into a scratch slice of the output buffer, then pulls
 * that slice back out instead of leaving it in place - GFM table cells can't
 * contain raw newlines or unescaped `|`.
 */
function tableCellText(state: MarkdownSerializerState, cell: ProseMirrorNode): string {
  const buffer = outBuffer(state);
  const start = buffer.out.length;
  cell.forEach((child) => {
    if (child.type.inlineContent) state.renderInline(child, false);
    else state.renderContent(child);
  });
  const rendered = buffer.out.slice(start);
  buffer.out = buffer.out.slice(0, start);
  return rendered.replace(/\r?\n+/g, " ").trim().replace(/\|/g, "\\|");
}

function writeFence(
  state: MarkdownSerializerState,
  info: string,
  content: string,
): void {
  state.write("```" + info + "\n");
  state.text(content, false);
  state.ensureNewLine();
  state.write("```");
}

export type MarkdownSerializerOptions = {
  /**
   * How an `mqCodeBlock` node serializes: "live" (default) keeps the
   * round-trippable ```mq query fence (+ ```mq-result fence) used when
   * saving to disk. "result" substitutes the block's evaluated result
   * markdown in its place - for copying the document out of mqpad as a
   * finished, plain-Markdown snapshot rather than a live query block.
   */
  mqCodeBlock?: "live" | "result";
};

export function buildMarkdownSerializer(options: MarkdownSerializerOptions = {}): MarkdownSerializer {
  const mqCodeBlockMode = options.mqCodeBlock ?? "live";
  return new MarkdownSerializer(
    {
      blockquote(state, node) {
        state.wrapBlock("> ", null, node, () => state.renderContent(node));
      },
      paragraph(state, node) {
        state.renderInline(node);
        state.closeBlock(node);
      },
      heading(state, node) {
        state.write(state.repeat("#", node.attrs.level) + " ");
        state.renderInline(node);
        state.closeBlock(node);
      },
      horizontalRule(state, node) {
        state.write("---");
        state.closeBlock(node);
      },
      bulletList(state, node) {
        state.renderList(node, "  ", () => (node.attrs.bullet || "-") + " ");
      },
      orderedList(state, node) {
        const start = node.attrs.start || 1;
        const maxW = String(start + node.childCount - 1).length;
        const space = state.repeat(" ", maxW + 2);
        state.renderList(node, space, (i) => {
          const nStr = String(start + i);
          return state.repeat(" ", maxW - nStr.length) + nStr + ". ";
        });
      },
      taskList(state, node) {
        state.renderList(node, "  ", (i) => `- [${node.child(i).attrs.checked ? "x" : " "}] `);
      },
      taskItem(state, node) {
        state.renderContent(node);
      },
      table(state, node) {
        const rows: ProseMirrorNode[] = [];
        node.forEach((row) => rows.push(row));
        if (rows.length === 0) {
          state.closeBlock(node);
          return;
        }

        const aligns: CellAlign[] = [];
        rows[0]!.forEach((cell) => aligns.push((cell.attrs.align as CellAlign) ?? null));

        const buffer = outBuffer(state);
        rows.forEach((row, rowIndex) => {
          const cells: string[] = [];
          row.forEach((cell) => cells.push(tableCellText(state, cell) || " "));
          state.write(`| ${cells.join(" | ")} |`);
          if (rowIndex === 0) {
            buffer.out += "\n";
            state.write(`| ${aligns.map(tableAlignMarker).join(" | ")} |`);
          }
          if (rowIndex < rows.length - 1) buffer.out += "\n";
        });
        state.closeBlock(node);
      },
      listItem(state, node) {
        state.renderContent(node);
      },
      codeBlock(state, node) {
        writeFence(state, node.attrs.language || "", node.textContent);
        state.closeBlock(node);
      },
      mqCodeBlock(state, node) {
        if (mqCodeBlockMode === "result") {
          // No result yet (the block was never run) - there's nothing to
          // substitute, so the block contributes nothing to the copy.
          if (node.attrs.result) {
            // A just-evaluated result (this session, not yet reloaded from
            // disk) can carry mq-web's own trailing newline; saved/reparsed
            // ones never do (the mq_fence parser strips it on load). Strip
            // it here too, so copy behaves the same either way.
            state.text(node.attrs.result.replace(/\n$/, ""), false);
            state.closeBlock(node);
          }
          return;
        }
        writeFence(state, "mq", node.attrs.query || "");
        state.closeBlock(node);
        if (node.attrs.result) {
          writeFence(state, "mq-result", node.attrs.result);
          state.closeBlock(node);
        }
      },
      mathBlock(state, node) {
        state.write("$$\n");
        state.text(node.attrs.source || "", false);
        state.ensureNewLine();
        state.write("$$");
        state.closeBlock(node);
      },
      image(state, node) {
        const { src, alt, title } = node.attrs as {
          src: string;
          alt: string | null;
          title: string | null;
        };
        const altText = alt ? state.esc(alt) : "";
        const titleText = title ? ` ${quote(title)}` : "";
        state.write(`![${altText}](${state.esc(src)}${titleText})`);
      },
      wikiLink(state, node) {
        const { title, alias } = node.attrs as {
          title: string;
          alias: string | null;
        };
        state.write(alias ? `[[${title}|${alias}]]` : `[[${title}]]`);
      },
      hardBreak(state, node, parent, index) {
        const after = parent.maybeChild(index + 1);
        state.write(after && after.type === node.type ? "\\\n" : "\n");
      },
      text(state, node) {
        state.text(node.text ?? "", true);
      },
    },
    {
      italic: { open: "*", close: "*", mixable: true, expelEnclosingWhitespace: true },
      bold: { open: "**", close: "**", mixable: true, expelEnclosingWhitespace: true },
      strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
      underline: { open: "<u>", close: "</u>", mixable: true },
      code: { open: "`", close: "`", escape: false },
      link: {
        open: "[",
        close(state, mark) {
          const href = mark.attrs.href as string;
          const title = mark.attrs.title as string | null;
          return `](${state.esc(href)}${title ? ` ${quote(title)}` : ""})`;
        },
      },
    },
    {},
  );
}

/** Serializes a doc to markdown, rendering lists without blank lines between items. */
export function serializeToMarkdown(serializer: MarkdownSerializer, doc: ProseMirrorNode): string {
  return serializer.serialize(doc, { tightLists: true });
}
