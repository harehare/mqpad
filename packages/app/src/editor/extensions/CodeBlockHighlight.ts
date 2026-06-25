import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { tokenizeSync, whenHighlighterReady } from "../../highlight/highlighter";

function createLineNumberGutter(lineCount: number): HTMLElement {
  const gutter = document.createElement("div");
  gutter.className = "mqpad-code-linenumbers";
  gutter.contentEditable = "false";
  for (let i = 1; i <= lineCount; i++) {
    const line = document.createElement("div");
    line.textContent = String(i);
    gutter.appendChild(line);
  }
  return gutter;
}

/**
 * Syntax-highlights `codeBlock` nodes (plain ```lang fences from StarterKit)
 * via decorations, so the underlying text/cursor behavior stays exactly
 * ProseMirror's normal text editing - only the rendered color changes.
 *
 * Token colors are CSS variables (see highlight/highlighter.ts), so this
 * plugin never needs to recompute on a theme switch, only on doc changes.
 */
export const CodeBlockHighlight = Extension.create({
  name: "codeBlockHighlight",

  addProseMirrorPlugins() {
    const editor = this.editor;
    let ready = false;
    void whenHighlighterReady().then(() => {
      ready = true;
      if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr);
    });

    return [
      new Plugin({
        key: new PluginKey("codeBlockHighlight"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "codeBlock") return;
              const start = pos + 1;

              const lineCount = node.textContent.split("\n").length;
              decorations.push(
                Decoration.widget(start, () => createLineNumberGutter(lineCount), {
                  key: `linenumbers-${lineCount}`,
                  side: -1,
                  ignoreSelection: true,
                }),
              );

              if (!ready) return;
              const lines = tokenizeSync(node.textContent, node.attrs.language as string | null);
              if (!lines) return;
              for (const line of lines) {
                for (const token of line) {
                  if (!token.color) continue;
                  const from = start + token.offset;
                  const to = from + token.content.length;
                  decorations.push(
                    Decoration.inline(from, to, {
                      style: `color:${token.color};${token.fontStyle === 1 ? "font-style:italic;" : ""}${
                        token.fontStyle === 2 ? "font-weight:bold;" : ""
                      }`,
                    }),
                  );
                }
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
