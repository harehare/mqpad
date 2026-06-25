import { InputRule, Node, PasteRule, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// A factory, not a shared instance - a `g`-flag regex carries `lastIndex`
// state, and this pattern is independently consumed by Tiptap's PasteRule
// internals and by the appendTransaction scan below; sharing one object
// would let either consumer's mid-scan position corrupt the other's.
function wikilinkPattern(): RegExp {
  return /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g;
}

export type WikiLinkOptions = {
  onNavigate?: (path: string) => void;
  resolveTarget: (title: string) => string;
  ensureFileExists: (path: string) => void;
};

/**
 * Obsidian-style `[[Title]]` / `[[Title|Alias]]` link. Typing the closing
 * `]]` immediately creates the target file (if it doesn't exist yet) and
 * turns the text into a clickable, non-editable node.
 */
export const WikiLink = Node.create<WikiLinkOptions>({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      onNavigate: undefined,
      resolveTarget: (title: string) => `/${title}.md`,
      ensureFileExists: () => {},
    };
  },

  addAttributes() {
    return {
      title: { default: "" },
      alias: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-wiki-link]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const title = node.attrs.title as string;
    const alias = node.attrs.alias as string | null;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-wiki-link": title,
        class: "mqpad-wikilink",
      }),
      alias ?? title,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const title = node.attrs.title as string;
      const alias = node.attrs.alias as string | null;

      const span = document.createElement("span");
      span.className = "mqpad-wikilink";
      span.textContent = alias ?? title;
      span.title = this.options.resolveTarget(title);
      span.addEventListener("click", (event) => {
        event.preventDefault();
        this.options.onNavigate?.(this.options.resolveTarget(title));
      });

      return { dom: span };
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]$/,
        handler: ({ state, range, match }) => {
          const title = (match[1] ?? "").trim();
          const alias = match[2]?.trim() || null;
          if (!title) return;

          const node = this.type.create({ title, alias });
          state.tr.replaceRangeWith(range.from, range.to, node);
          this.options.ensureFileExists(this.options.resolveTarget(title));
        },
      }),
    ];
  },

  // Input rules only fire on live, character-by-character typing - text
  // arriving in one shot (a real clipboard paste) skips them entirely, so
  // `[[Title]]` typed that way would otherwise stay as literal text. This
  // mirrors the input rule above for that case.
  addPasteRules() {
    return [
      new PasteRule({
        find: wikilinkPattern(),
        handler: ({ state, range, match }) => {
          const title = (match[1] ?? "").trim();
          const alias = match[2]?.trim() || null;
          if (!title) return;

          const node = this.type.create({ title, alias });
          state.tr.replaceRangeWith(range.from, range.to, node);
          this.options.ensureFileExists(this.options.resolveTarget(title));
        },
      }),
    ];
  },

  // Safety net for everything input/paste rules still miss: IME composition
  // commits in particular. Many CJK input methods route *all* typing -
  // including plain ASCII, even with the IME's own "alphanumeric" sub-mode
  // selected - through a composition session that lands in the document as
  // one bulk insert via `compositionend`, not the individual keystrokes
  // input rules watch for. appendTransaction sees the resulting document
  // either way, regardless of how the text arrived.
  addProseMirrorPlugins() {
    const wikiLinkType = this.type;
    const { ensureFileExists, resolveTarget } = this.options;

    return [
      new Plugin({
        key: new PluginKey("wikiLinkAutoConvert"),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          const matches: { from: number; to: number; title: string; alias: string | null }[] = [];
          newState.doc.descendants((node, pos) => {
            if (!node.isText) return;
            // Skip text inside code-like blocks (fenced code, the mq query
            // editor) - input rules already get this for free via
            // ProseMirror's own "don't auto-format inside code" check;
            // this scan needs the same guard spelled out explicitly.
            const parent = newState.doc.resolve(pos).parent;
            if (parent.type.spec.code) return;

            const text = node.text ?? "";
            const pattern = wikilinkPattern();
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(text))) {
              const title = (match[1] ?? "").trim();
              if (!title) continue;
              matches.push({
                from: pos + match.index,
                to: pos + match.index + match[0].length,
                title,
                alias: match[2]?.trim() || null,
              });
            }
          });
          if (matches.length === 0) return null;

          const tr = newState.tr;
          // Replace from the end backwards so earlier matches' positions
          // stay valid as later ones are replaced (atom nodes change the
          // document's length at the replaced spot).
          for (const m of [...matches].reverse()) {
            tr.replaceRangeWith(m.from, m.to, wikiLinkType.create({ title: m.title, alias: m.alias }));
            ensureFileExists(resolveTarget(m.title));
          }
          return tr;
        },
      }),
    ];
  },
});
