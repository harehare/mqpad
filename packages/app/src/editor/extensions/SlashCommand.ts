import { Extension } from "@tiptap/core";
import type { Editor, Range } from "@tiptap/core";
import Suggestion, { type SuggestionOptions, type SuggestionProps } from "@tiptap/suggestion";

export type SlashItem = {
  id: string;
  label: string;
  hint?: string;
  run: (editor: Editor, range: Range) => void;
};

const ITEMS: SlashItem[] = [
  {
    id: "h1",
    label: "Heading 1",
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Heading 2",
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Heading 3",
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    id: "bullet-list",
    label: "Bullet List",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "ordered-list",
    label: "Numbered List",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "task-list",
    label: "Task List",
    hint: "- [ ]",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: "table",
    label: "Table",
    hint: "3x3",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "blockquote",
    label: "Blockquote",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: "code-block",
    label: "Code Block",
    hint: "```",
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: "mermaid",
    label: "Mermaid Diagram",
    hint: "```mermaid",
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "codeBlock",
          attrs: { language: "mermaid" },
          content: [{ type: "text", text: "graph TD\n  A --> B" }],
        })
        .run(),
  },
  {
    id: "math",
    label: "Math Block",
    hint: "$$...$$",
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertContent({ type: "mathBlock", attrs: { source: "" } }).run(),
  },
  {
    id: "mq",
    label: "mq Query Block",
    hint: "```mq",
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "mqCodeBlock", attrs: { query: "", result: "" } })
        .run(),
  },
  {
    id: "hr",
    label: "Horizontal Rule",
    hint: "---",
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

function renderMenu() {
  let items: SlashItem[] = [];
  let selectedIndex = 0;
  let select: ((item: SlashItem) => void) | null = null;
  let unmount: (() => void) | null = null;

  const el = document.createElement("div");
  el.className = "mqpad-slash-menu";

  function paint() {
    el.innerHTML = "";
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mqpad-slash-menu-empty";
      empty.textContent = "No matching commands";
      el.appendChild(empty);
      return;
    }
    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mqpad-slash-menu-item${index === selectedIndex ? " active" : ""}`;

      const label = document.createElement("span");
      label.className = "mqpad-slash-menu-item-label";
      label.textContent = item.label;
      button.appendChild(label);

      if (item.hint) {
        const hint = document.createElement("span");
        hint.className = "mqpad-slash-menu-item-hint";
        hint.textContent = item.hint;
        button.appendChild(hint);
      }

      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        select?.(item);
      });
      el.appendChild(button);
    });
  }

  return {
    onStart: (props: SuggestionProps<SlashItem, SlashItem>) => {
      items = props.items;
      selectedIndex = 0;
      select = props.command;
      paint();
      unmount = props.mount(el);
    },
    onUpdate: (props: SuggestionProps<SlashItem, SlashItem>) => {
      items = props.items;
      selectedIndex = 0;
      select = props.command;
      paint();
    },
    onKeyDown: ({ event }: { event: KeyboardEvent }): boolean => {
      if (items.length === 0) return false;
      if (event.key === "ArrowDown") {
        selectedIndex = (selectedIndex + 1) % items.length;
        paint();
        return true;
      }
      if (event.key === "ArrowUp") {
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        paint();
        return true;
      }
      if (event.key === "Enter") {
        const item = items[selectedIndex];
        if (item) select?.(item);
        return true;
      }
      return false;
    },
    onExit: () => {
      unmount?.();
    },
  };
}

/** Typing `/` opens a filterable menu to insert headings, lists, code/mermaid/math/mq blocks, etc. */
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    const options: Omit<SuggestionOptions<SlashItem, SlashItem>, "editor"> = {
      char: "/",
      startOfLine: false,
      items: ({ query }) => ITEMS.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
      command: ({ editor, range, props }) => props.run(editor, range),
      render: renderMenu,
    };

    return [
      Suggestion({
        editor: this.editor,
        ...options,
      }),
    ];
  },
});
