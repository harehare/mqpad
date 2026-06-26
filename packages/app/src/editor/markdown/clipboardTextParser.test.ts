import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { describe, expect, it } from "vitest";
import { Image } from "../extensions/Image";
import { MathBlock } from "../extensions/MathBlock";
import { MqCodeBlock } from "../extensions/MqCodeBlock";
import { WikiLink } from "../extensions/WikiLink";
import { clipboardTextParser, handleMarkdownPaste } from "./clipboardTextParser";

const schema = getSchema([
  StarterKit,
  Image,
  WikiLink,
  MqCodeBlock,
  MathBlock,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: true }),
]);

// `clipboardTextParser` only reads `view.state.schema` and ignores `$context`.
const view = { state: { schema } } as unknown as EditorView;

function parse(text: string, plain = false) {
  return clipboardTextParser(text, undefined as never, plain, view);
}

describe("clipboardTextParser", () => {
  it("turns a pasted heading into a heading node", () => {
    const slice = parse("# Title");
    expect(slice?.content.firstChild?.type.name).toBe("heading");
    expect(slice?.content.firstChild?.textContent).toBe("Title");
  });

  it("turns a pasted bullet list into a bulletList node", () => {
    const slice = parse("- one\n- two");
    expect(slice?.content.firstChild?.type.name).toBe("bulletList");
  });

  it("turns pasted bold/italic text into marked inline content", () => {
    const slice = parse("Hello **bold** world");
    const paragraph = slice?.content.firstChild;
    expect(paragraph?.type.name).toBe("paragraph");
    const bold = paragraph?.child(1);
    expect(bold?.marks.map((m) => m.type.name)).toContain("bold");
  });

  it("falls back to the default paste behavior for plain sentences", () => {
    expect(parse("Just a normal sentence, nothing special here.")).toBeUndefined();
  });

  it("falls back to the default paste behavior when pasting without formatting", () => {
    expect(parse("# Title", true)).toBeUndefined();
  });
});

function fakeClipboardEvent(plainText: string, html: string): ClipboardEvent {
  return {
    clipboardData: {
      getData: (type: string) => (type === "text/html" ? html : plainText),
    },
  } as unknown as ClipboardEvent;
}

describe("handleMarkdownPaste", () => {
  function pasteView() {
    let state = EditorState.create({ schema });
    const dispatch = (tr: Transaction) => {
      state = state.apply(tr);
    };
    return {
      get state() {
        return state;
      },
      dispatch,
    } as unknown as EditorView;
  }

  it("re-parses markdown pasted alongside a bare <pre> wrapper (e.g. VS Code, Terminal)", () => {
    const view = pasteView();
    const handled = handleMarkdownPaste(view, fakeClipboardEvent("# Title", "<pre>&num; Title</pre>"));
    expect(handled).toBe(true);
    expect(view.state.doc.firstChild?.type.name).toBe("heading");
  });

  it("leaves genuinely rich HTML (real <h1>/<strong> tags) to the default paste path", () => {
    const view = pasteView();
    const handled = handleMarkdownPaste(view, fakeClipboardEvent("# Title", "<h1>Title</h1>"));
    expect(handled).toBe(false);
  });

  it("leaves non-markdown plain text to the default paste path", () => {
    const view = pasteView();
    const handled = handleMarkdownPaste(
      view,
      fakeClipboardEvent("Just a normal sentence.", "<pre>Just a normal sentence.</pre>"),
    );
    expect(handled).toBe(false);
  });

  it("does nothing without clipboard data", () => {
    const view = pasteView();
    expect(handleMarkdownPaste(view, { clipboardData: null } as unknown as ClipboardEvent)).toBe(false);
  });
});
