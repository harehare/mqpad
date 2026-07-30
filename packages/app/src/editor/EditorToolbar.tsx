import { type Editor as TiptapEditor, useEditorState } from "@tiptap/react";
import { Slice } from "@tiptap/pm/model";
import type { MarkdownSerializer } from "prosemirror-markdown";
import { useEffect, useState } from "react";
import {
  LuBold,
  LuCheck,
  LuCode,
  LuColumns3,
  LuCopy,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuItalic,
  LuLink,
  LuList,
  LuListOrdered,
  LuListTodo,
  LuRedo2,
  LuRows3,
  LuSearch,
  LuSeparatorHorizontal,
  LuSparkles,
  LuStrikethrough,
  LuTable,
  LuTableColumnsSplit,
  LuTableOfContents,
  LuTableProperties,
  LuTableRowsSplit,
  LuTerminal,
  LuTextQuote,
  LuTrash2,
  LuUnderline,
  LuUndo2,
} from "react-icons/lu";
import { useAi } from "../ai/AiContext";
import { aiAvailabilityTooltip } from "../ai/availabilityMessage";
import { buildEditPrompt } from "../ai/editPrompt";
import { buildMarkdownParser, buildMarkdownSerializer, serializeToMarkdown } from "./markdown";
import { AiSelectionPopover } from "./AiSelectionPopover";
import { FindReplacePanel } from "./FindReplacePanel";
import { computeOutline } from "./computeOutline";
import { Outline } from "./Outline";
import { QueryConsole } from "./QueryConsole";

export type EditorToolbarProps = {
  editor: TiptapEditor;
  serializer: MarkdownSerializer;
};

type SelectionRange = { from: number; to: number };

export function EditorToolbar({ editor, serializer }: EditorToolbarProps) {
  const ai = useAi();
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiRange, setAiRange] = useState<SelectionRange | null>(null);
  const [aiOriginalText, setAiOriginalText] = useState("");
  const [copied, setCopied] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      canUndo: ed.can().undo(),
      canRedo: ed.can().redo(),
      bold: ed.isActive("bold"),
      italic: ed.isActive("italic"),
      underline: ed.isActive("underline"),
      strike: ed.isActive("strike"),
      h1: ed.isActive("heading", { level: 1 }),
      h2: ed.isActive("heading", { level: 2 }),
      h3: ed.isActive("heading", { level: 3 }),
      bulletList: ed.isActive("bulletList"),
      orderedList: ed.isActive("orderedList"),
      taskList: ed.isActive("taskList"),
      blockquote: ed.isActive("blockquote"),
      codeBlock: ed.isActive("codeBlock"),
      link: ed.isActive("link"),
      inTable: ed.isActive("table"),
      hasSelection: !ed.state.selection.empty,
      outline: computeOutline(ed.state.doc),
    }),
  });

  // Cmd/Ctrl+F while the editor has focus opens the find bar instead of the
  // browser's own find-in-page (which can't see into a contentEditable's
  // reflowing text anyway).
  useEffect(() => {
    const dom = editor.view.dom;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen((open) => !open);
      }
    };
    dom.addEventListener("keydown", handleKeyDown);
    return () => dom.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  const openLinkPopover = () => {
    setLinkValue((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkPopoverOpen(true);
    setConsoleOpen(false);
    setAiOpen(false);
  };

  // Captures the selected range's markdown up front, so the AI edit is
  // grounded in exactly what was selected even if focus later moves into the
  // popover's own input.
  const openAiPopover = () => {
    const { from, to } = editor.state.selection;
    if (from === to) return;
    setAiRange({ from, to });
    setAiOriginalText(serializeToMarkdown(serializer, editor.state.doc.cut(from, to)));
    setAiOpen(true);
    setLinkPopoverOpen(false);
    setConsoleOpen(false);
  };

  const handleAiGenerate = (instruction: string, onDownloadProgress?: (fraction: number) => void) =>
    ai.complete(buildEditPrompt(instruction, aiOriginalText), onDownloadProgress);

  // Parses the AI's suggested Markdown the same way a Markdown paste is
  // parsed (see clipboardTextParser.ts) and replaces the originally selected
  // range with it - the range is re-clamped to the current doc size in case
  // it changed size elsewhere (e.g. a live mq block) while the popover was
  // open. When the suggestion is a single textblock (the common case: a
  // rewritten/translated/fixed run of inline text), its inline content is
  // spliced in directly instead of the wrapping paragraph node, so it merges
  // seamlessly with whatever text surrounds the selection rather than
  // splitting the paragraph around a new block. A multi-block suggestion
  // (e.g. turning the selection into a list) still inserts as real blocks.
  const handleAiAccept = (suggested: string) => {
    if (!aiRange) return;
    const parsedDoc = buildMarkdownParser(editor.schema).parse(suggested);
    const singleTextblock = parsedDoc.childCount === 1 && parsedDoc.firstChild?.isTextblock;
    const slice = new Slice(singleTextblock ? parsedDoc.firstChild!.content : parsedDoc.content, 0, 0);
    const docSize = editor.state.doc.content.size;
    const to = Math.min(aiRange.to, docSize);
    const from = Math.min(aiRange.from, to);
    editor.view.dispatch(editor.state.tr.replaceRange(from, to, slice).scrollIntoView());
    setAiOpen(false);
    setAiRange(null);
  };

  const applyLink = () => {
    const href = linkValue.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) {
      chain.setLink({ href }).run();
    } else {
      chain.unsetLink().run();
    }
    setLinkPopoverOpen(false);
  };

  // Copies the document as plain Markdown with each mq block replaced by its
  // already-evaluated result, instead of the live ```mq query fence - for
  // pasting a finished snapshot somewhere outside mqpad.
  const handleCopyAsMarkdown = async () => {
    const copySerializer = buildMarkdownSerializer({ mqCodeBlock: "result" });
    const markdown = serializeToMarkdown(copySerializer, editor.state.doc);
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="mqpad-toolbar">
      <div className="mqpad-toolbar-row">
        <button
          type="button"
          className="mqpad-toolbar-btn"
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          <LuUndo2 size={16} />
        </button>
        <button
          type="button"
          className="mqpad-toolbar-btn"
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          <LuRedo2 size={16} />
        </button>

        <div className="mqpad-toolbar-divider" />

        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.bold ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <LuBold size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.italic ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <LuItalic size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.underline ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <LuUnderline size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.strike ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <LuStrikethrough size={16} />
        </button>

        <div className="mqpad-toolbar-divider" />

        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.h1 ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          <LuHeading1 size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.h2 ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <LuHeading2 size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.h3 ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <LuHeading3 size={16} />
        </button>

        <div className="mqpad-toolbar-divider" />

        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.bulletList ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <LuList size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.orderedList ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <LuListOrdered size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.taskList ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Task list"
        >
          <LuListTodo size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.blockquote ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          <LuTextQuote size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.codeBlock ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code block"
        >
          <LuCode size={16} />
        </button>
        <button
          type="button"
          className="mqpad-toolbar-btn"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule"
        >
          <LuSeparatorHorizontal size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.inTable ? "active" : ""}`}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Insert table"
        >
          <LuTable size={16} />
        </button>

        <div className="mqpad-toolbar-divider" />

        <button
          type="button"
          className={`mqpad-toolbar-btn ${state.link ? "active" : ""}`}
          onClick={openLinkPopover}
          title="Link"
        >
          <LuLink size={16} />
        </button>

        <div className="mqpad-toolbar-spacer" />

        <button
          type="button"
          className="mqpad-toolbar-btn"
          onClick={handleCopyAsMarkdown}
          title="Copy as Markdown (mq blocks become their evaluated result)"
        >
          {copied ? <LuCheck size={16} /> : <LuCopy size={16} />}
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${outlineOpen ? "active" : ""}`}
          onClick={() => setOutlineOpen((open) => !open)}
          title="Outline"
        >
          <LuTableOfContents size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${findOpen ? "active" : ""}`}
          onClick={() => setFindOpen((open) => !open)}
          title="Find and replace (Cmd/Ctrl+F)"
        >
          <LuSearch size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${consoleOpen ? "active" : ""}`}
          onClick={() => {
            setConsoleOpen((open) => !open);
            setLinkPopoverOpen(false);
            setAiOpen(false);
          }}
          title="Run an mq query against the whole document"
        >
          <LuTerminal size={16} />
        </button>
        <button
          type="button"
          className={`mqpad-toolbar-btn ${aiOpen ? "active" : ""}`}
          disabled={!state.hasSelection || !ai.configured}
          onClick={() => (aiOpen ? setAiOpen(false) : openAiPopover())}
          title={
            ai.availability === "unavailable"
              ? aiAvailabilityTooltip(ai.availability, "Ask AI")
              : !state.hasSelection
                ? "Select text to ask AI about it"
                : aiAvailabilityTooltip(ai.availability, "Ask AI about the selected text")
          }
        >
          <LuSparkles size={16} />
        </button>
      </div>

      {state.inTable && (
        <div className="mqpad-toolbar-row mqpad-toolbar-row-table">
          <button
            type="button"
            className="mqpad-toolbar-btn"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add row after"
          >
            <LuRows3 size={16} />
          </button>
          <button
            type="button"
            className="mqpad-toolbar-btn"
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete row"
          >
            <LuTableRowsSplit size={16} />
          </button>
          <div className="mqpad-toolbar-divider" />
          <button
            type="button"
            className="mqpad-toolbar-btn"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add column after"
          >
            <LuColumns3 size={16} />
          </button>
          <button
            type="button"
            className="mqpad-toolbar-btn"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete column"
          >
            <LuTableColumnsSplit size={16} />
          </button>
          <div className="mqpad-toolbar-divider" />
          <button
            type="button"
            className="mqpad-toolbar-btn"
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            title="Toggle header row"
          >
            <LuTableProperties size={16} />
          </button>
          <button
            type="button"
            className="mqpad-toolbar-btn"
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete table"
          >
            <LuTrash2 size={16} />
          </button>
        </div>
      )}

      {linkPopoverOpen && (
        <div className="mqpad-toolbar-popover">
          <input
            autoFocus
            type="text"
            className="mqpad-toolbar-popover-input"
            placeholder="https://example.com"
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                setLinkPopoverOpen(false);
              }
            }}
          />
          <button type="button" className="mqpad-toolbar-popover-apply" onClick={applyLink}>
            Apply
          </button>
        </div>
      )}

      {outlineOpen && (
        <Outline
          items={state.outline}
          onNavigate={(pos: number) => {
            editor.chain().focus(pos).scrollIntoView().run();
          }}
          onClose={() => setOutlineOpen(false)}
        />
      )}
      {findOpen && <FindReplacePanel editor={editor} onClose={() => setFindOpen(false)} />}
      {consoleOpen && (
        <QueryConsole editor={editor} serializer={serializer} onClose={() => setConsoleOpen(false)} />
      )}
      {aiOpen && aiRange && (
        <AiSelectionPopover
          originalText={aiOriginalText}
          onGenerate={handleAiGenerate}
          onAccept={handleAiAccept}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  );
}
