import type MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

const CHECKBOX_RE = /^\[([ xX])\]\s+/;

type ListItemSpan = { openIndex: number; closeIndex: number };

type ListFrame = {
  openIndex: number;
  isBullet: boolean;
  items: ListItemSpan[];
};

function findMatchingClose(tokens: Token[], openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < tokens.length; i++) {
    const type = tokens[i]!.type;
    if (type === "list_item_open") depth++;
    else if (type === "list_item_close") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Recognizes GFM task list items (`- [ ] foo` / `- [x] foo`) on top of
 * MarkdownIt's regular bullet-list tokens. A bullet list is promoted to a
 * "task_list" - and each of its direct items to a "task_item" - only when at
 * least one direct item has a checkbox prefix (a mixed list keeps any
 * checkbox-less items as unchecked task items rather than splitting the
 * list, since the tiptap schema can't mix listItem/taskItem children).
 *
 * Item open/close indices are resolved as each `list_item_open` is reached
 * (forward scan over still-pristine token types), so the later renaming pass
 * at the matching list close can address them directly without re-deriving
 * positions from types that may have already been rewritten by then.
 */
export function taskListRule(md: MarkdownIt): void {
  md.core.ruler.before("inline", "task_list", (state) => {
    const tokens = state.tokens;
    const stack: ListFrame[] = [];
    const checked = new Map<number, boolean>();

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]!;

      if (tok.type === "bullet_list_open" || tok.type === "ordered_list_open") {
        stack.push({ openIndex: i, isBullet: tok.type === "bullet_list_open", items: [] });
        continue;
      }

      if (tok.type === "bullet_list_close" || tok.type === "ordered_list_close") {
        const frame = stack.pop();
        if (frame?.isBullet && frame.items.some((item) => checked.has(item.openIndex))) {
          tokens[frame.openIndex]!.type = "task_list_open";
          tokens[frame.openIndex]!.tag = "ul";
          tok.type = "task_list_close";
          tok.tag = "ul";
          for (const item of frame.items) {
            tokens[item.openIndex]!.type = "task_item_open";
            tokens[item.openIndex]!.tag = "li";
            tokens[item.openIndex]!.meta = { checked: checked.get(item.openIndex) === true };
            tokens[item.closeIndex]!.type = "task_item_close";
            tokens[item.closeIndex]!.tag = "li";
          }
        }
        continue;
      }

      if (tok.type === "list_item_open") {
        const top = stack[stack.length - 1];
        const closeIndex = findMatchingClose(tokens, i);
        top?.items.push({ openIndex: i, closeIndex });

        if (top?.isBullet) {
          const para = tokens[i + 1];
          const inline = tokens[i + 2];
          const closeParagraph = tokens[i + 3];
          if (para?.type === "paragraph_open" && inline?.type === "inline" && closeParagraph?.type === "paragraph_close") {
            const match = CHECKBOX_RE.exec(inline.content);
            if (match) {
              inline.content = inline.content.slice(match[0].length);
              checked.set(i, match[1]!.toLowerCase() === "x");
            }
          }
        }
      }
    }
  });
}
