import { getSchema } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { type Editor as TiptapEditor, useEditor, EditorContent } from "@tiptap/react";
import type { EditorState } from "@tiptap/pm/state";
import type { EditorProps as PMEditorProps } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildMarkdownParser, buildMarkdownSerializer, serializeToMarkdown } from "./markdown";
import { clipboardTextParser, handleMarkdownPaste } from "./markdown/clipboardTextParser";
import { CodeBlockHighlight } from "./extensions/CodeBlockHighlight";
import { CodeBlockWithPreview } from "./extensions/CodeBlockWithPreview";
import { EditorToolbar } from "./EditorToolbar";
import { FrontmatterPanel } from "./FrontmatterPanel";
import { dataToRows, parseFrontmatter, rowsToData, stringifyFrontmatter, type FrontmatterRow } from "./frontmatter";
import { MathBlock } from "./extensions/MathBlock";
import { MqCodeBlock } from "./extensions/MqCodeBlock";
import { SlashCommand } from "./extensions/SlashCommand";
import { WikiLink, type WikiLinkOptions } from "./extensions/WikiLink";
import "./editor.css";

export type EditorStats = {
  words: number;
  characters: number;
  /** 1-based index of the cursor's block among the document's top-level blocks - the WYSIWYG analog of a line number. */
  line: number;
  lineCount: number;
  /** 1-based character offset within the cursor's current block. */
  col: number;
};

function computeStats(state: EditorState): EditorStats {
  const text = state.doc.textBetween(0, state.doc.content.size, "\n", "\n");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const pos = state.selection.$from.pos;
  let line = 1;
  let col = 1;
  let lineCount = 0;
  state.doc.forEach((node, nodeStart) => {
    lineCount++;
    if (pos >= nodeStart && pos <= nodeStart + node.nodeSize) {
      line = lineCount;
      col = pos - nodeStart;
    }
  });

  return { words, characters: text.length, line, lineCount: Math.max(lineCount, 1), col: Math.max(col, 1) };
}

export type EditorProps = {
  markdown: string;
  onChange: (markdown: string) => void;
  onNavigate: (path: string) => void;
  resolveWikiLinkTarget: (title: string) => string;
  ensureWikiLinkFileExists: (path: string) => void;
  onStatsChange?: (stats: EditorStats) => void;
  /** Text direction for the writing surface (Settings > Text Direction). Defaults to "ltr". */
  direction?: "ltr" | "rtl";
};

export function MqpadEditor({
  markdown,
  onChange,
  onNavigate,
  resolveWikiLinkTarget,
  ensureWikiLinkFileExists,
  onStatsChange,
  direction = "ltr",
}: EditorProps) {
  const serializer = useMemo(() => buildMarkdownSerializer(), []);
  const lastEmitted = useRef<string>(markdown);

  // Frontmatter lives outside the ProseMirror doc entirely - a leading `---`
  // block would otherwise parse as a horizontal rule plus a stray paragraph.
  // Split once per mount (remounted via `key={path}` on file switch, same as
  // initialContent below) and keep it as form rows rather than re-deriving
  // them from `markdown` on every render, so typing in the panel doesn't
  // fight with React over row identity/focus.
  const [frontmatterRows, setFrontmatterRows] = useState<FrontmatterRow[]>(
    () => dataToRows(parseFrontmatter(markdown).data),
  );

  const wikiLinkOptions: Partial<WikiLinkOptions> = {
    onNavigate,
    resolveTarget: resolveWikiLinkTarget,
    ensureFileExists: ensureWikiLinkFileExists,
  };

  // Extensions and the initial doc are built once per mount (the caller
  // remounts this component via `key={path}` on file switch), so the very
  // first render already shows the file's real content instead of a blank
  // doc that the sync effect below would otherwise skip re-loading.
  const extensions = useMemo(
    () => [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockWithPreview,
      CodeBlockHighlight,
      MathBlock,
      Table.configure({ resizable: true, renderWrapper: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      WikiLink.configure(wikiLinkOptions),
      MqCodeBlock.configure({
        serializeDocument: (ed: TiptapEditor) => serializeToMarkdown(serializer, ed.state.doc),
      }),
      SlashCommand,
      Placeholder.configure({
        placeholder: "Start writing... type [[Note]] to link, ```mq for a live query block, or / for commands.",
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const initialContent = useMemo(
    () => buildMarkdownParser(getSchema(extensions)).parse(parseFrontmatter(markdown).body).toJSON(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function emitChange(rows: FrontmatterRow[], body: string) {
    const next = stringifyFrontmatter(rowsToData(rows), body);
    lastEmitted.current = next;
    onChange(next);
  }

  const editor = useEditor({
    extensions,
    content: initialContent,
    editorProps: {
      attributes: { dir: direction },
      clipboardTextParser: clipboardTextParser as PMEditorProps["clipboardTextParser"],
      handlePaste: handleMarkdownPaste,
    },
    onUpdate: ({ editor: ed }) => {
      emitChange(frontmatterRows, serializeToMarkdown(serializer, ed.state.doc));
      onStatsChange?.(computeStats(ed.state));
    },
    onSelectionUpdate: ({ editor: ed }) => {
      onStatsChange?.(computeStats(ed.state));
    },
    onCreate: ({ editor: ed }) => {
      onStatsChange?.(computeStats(ed.state));
    },
  });

  function handleFrontmatterRowsChange(rows: FrontmatterRow[]) {
    setFrontmatterRows(rows);
    if (!editor) return;
    emitChange(rows, serializeToMarkdown(serializer, editor.state.doc));
  }

  // editorProps.attributes is only read at creation, so a direction change
  // while the same file stays open (no remount) needs to be applied to the
  // already-live contentEditable element directly.
  useEffect(() => {
    editor?.view.dom.setAttribute("dir", direction);
  }, [editor, direction]);

  useEffect(() => {
    if (!editor) return;
    if (markdown === lastEmitted.current) return;
    const { data, body } = parseFrontmatter(markdown);
    setFrontmatterRows(dataToRows(data));
    const parser = buildMarkdownParser(editor.schema);
    const doc = parser.parse(body);
    lastEmitted.current = markdown;
    editor.commands.setContent(doc.toJSON());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown, editor]);

  // Focus the editor so it's obvious where you can type - but only if
  // nothing inside it (e.g. a freshly-inserted mq block's own textarea) has
  // already claimed focus, otherwise this steals it right back.
  useEffect(() => {
    if (!editor) return;
    if (editor.view.dom.contains(document.activeElement)) return;
    editor.commands.focus("end");
  }, [editor]);

  return (
    <>
      <FrontmatterPanel rows={frontmatterRows} onChange={handleFrontmatterRowsChange} />
      {editor && <EditorToolbar editor={editor} serializer={serializer} />}
      <EditorContent editor={editor} />
    </>
  );
}
