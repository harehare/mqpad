import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type FindMatch = { from: number; to: number };

export type FindDecorationMeta = { matches: FindMatch[]; activeIndex: number };

export const findReplacePluginKey = new PluginKey<DecorationSet>("mqpadFindReplace");

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches are found per text node rather than across the whole flattened
 * document, so a query can't span a block boundary - acceptable for a find
 * bar (most editors don't cross paragraphs either) and far simpler than
 * mapping flattened-string offsets back to document positions.
 */
export function findMatches(doc: PMNode, query: string, caseSensitive: boolean): FindMatch[] {
  if (!query) return [];
  const matches: FindMatch[] = [];
  const re = new RegExp(escapeRegExp(query), caseSensitive ? "g" : "gi");
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text))) {
      matches.push({ from: pos + m.index, to: pos + m.index + m[0].length });
      if (m[0].length === 0) re.lastIndex++;
    }
  });
  return matches;
}

/** ProseMirror plugin that renders the current match set as decorations - the search/replace/navigation logic itself lives in FindReplacePanel, which dispatches meta transactions here. */
export const FindAndReplace = Extension.create({
  name: "mqpadFindReplace",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: findReplacePluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(findReplacePluginKey) as FindDecorationMeta | undefined;
            if (!meta) return old.map(tr.mapping, tr.doc);
            const decorations = meta.matches.map((match, index) =>
              Decoration.inline(match.from, match.to, {
                class:
                  index === meta.activeIndex ? "mqpad-find-match mqpad-find-match-active" : "mqpad-find-match",
              }),
            );
            return DecorationSet.create(tr.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return findReplacePluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
