import { getSchema, type Editor as TiptapEditor } from "@tiptap/core";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AiProvider } from "../ai/AiContext";
import { Image } from "./extensions/Image";
import { MqCodeBlock } from "./extensions/MqCodeBlock";
import { WikiLink } from "./extensions/WikiLink";
import { MathBlock } from "./extensions/MathBlock";
import { buildMarkdownParser, buildMarkdownSerializer } from "./markdown";
import { EditorToolbar } from "./EditorToolbar";
import { installMockLanguageModel, uninstallMockLanguageModel } from "../testUtils/mockLanguageModel";

const extensions = [
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
];
const schema = getSchema(extensions);

function Harness({ onReady }: { onReady: (editor: TiptapEditor) => void }) {
  const editor = useEditor({
    extensions,
    content: buildMarkdownParser(schema).parse("Hello world.").toJSON(),
    onCreate: ({ editor: ed }) => onReady(ed),
  });
  if (!editor) return null;
  return (
    <>
      <EditorToolbar editor={editor} serializer={buildMarkdownSerializer()} />
      <EditorContent editor={editor} />
    </>
  );
}

async function renderHarness(): Promise<{ editor: TiptapEditor; container: HTMLDivElement }> {
  let editor: TiptapEditor | null = null;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <AiProvider>
        <Harness onReady={(ed) => (editor = ed)} />
      </AiProvider>,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return { editor: editor!, container };
}

const findByTitle = (container: HTMLDivElement, titleSubstring: string) =>
  Array.from(container.querySelectorAll(".mqpad-toolbar-btn")).find((b) =>
    b.getAttribute("title")?.includes(titleSubstring),
  ) as HTMLButtonElement;

const findByText = (container: HTMLDivElement, selector: string, text: string) =>
  Array.from(container.querySelectorAll(selector)).find((b) => b.textContent === text) as HTMLButtonElement;

describe("EditorToolbar Ask AI on selection", () => {
  afterEach(() => {
    uninstallMockLanguageModel();
  });

  it("shows a diff preview for the AI's suggestion and applies it to the doc only on accept", async () => {
    const { promptMock } = installMockLanguageModel({ response: "Hi world." });
    const { editor, container } = await renderHarness();

    // Select the whole "Hello world." text.
    await act(async () => {
      editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
    });

    const aiButton = findByTitle(container, "Ask AI about the selected text");
    expect(aiButton).toBeTruthy();
    expect(aiButton.disabled).toBe(false);

    await act(async () => {
      aiButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const fixGrammarPreset = findByText(container, ".mqpad-ai-selection-presets button", "Fix grammar");
    expect(fixGrammarPreset).toBeTruthy();

    await act(async () => {
      fixGrammarPreset.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(promptMock).toHaveBeenCalledTimes(1);
    // Diff preview shown, nothing applied to the doc yet.
    expect(container.querySelector(".mqpad-ai-diff")).toBeTruthy();
    expect(editor.getText()).toBe("Hello world.");

    const acceptButton = findByText(container, ".mqpad-ai-diff-actions button", "Accept");
    await act(async () => {
      acceptButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(editor.getText()).toBe("Hi world.");
    expect(container.querySelector(".mqpad-ai-diff")).toBeNull();
  });

  it("leaves the document untouched when the suggestion is rejected", async () => {
    installMockLanguageModel({ response: "Hi world." });
    const { editor, container } = await renderHarness();

    await act(async () => {
      editor.commands.setTextSelection({ from: 1, to: 6 });
    });

    const aiButton = findByTitle(container, "Ask AI about the selected text");
    await act(async () => {
      aiButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const fixGrammarPreset = findByText(container, ".mqpad-ai-selection-presets button", "Fix grammar");
    await act(async () => {
      fixGrammarPreset.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const rejectButton = findByText(container, ".mqpad-ai-diff-actions button", "Reject");
    await act(async () => {
      rejectButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(editor.getText()).toBe("Hello world.");
    expect(container.querySelector(".mqpad-ai-diff")).toBeNull();
  });

  it("disables the button until text is selected, and reports why when Chrome's AI isn't available", async () => {
    installMockLanguageModel({ availability: "unavailable" });
    const { container } = await renderHarness();

    const aiButton = findByTitle(container, "Requires Chrome's built-in AI");
    expect(aiButton).toBeTruthy();
    expect(aiButton.disabled).toBe(true);
  });

  it("shows download progress on first use when the model isn't downloaded yet", async () => {
    installMockLanguageModel({ availability: "downloadable", response: "Hi world.", downloadProgress: [0.5, 1] });
    const { editor, container } = await renderHarness();

    await act(async () => {
      editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
    });

    const aiButton = findByTitle(container, "first use downloads Chrome's on-device AI model");
    expect(aiButton).toBeTruthy();
    expect(aiButton.disabled).toBe(false);

    await act(async () => {
      aiButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const fixGrammarPreset = findByText(container, ".mqpad-ai-selection-presets button", "Fix grammar");
    await act(async () => {
      fixGrammarPreset.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(container.querySelector(".mqpad-ai-diff")).toBeTruthy();
    expect(editor.getText()).toBe("Hello world.");
  });
});
