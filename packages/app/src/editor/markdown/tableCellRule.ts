import type MarkdownIt from "markdown-it";

/**
 * GFM table cells (`th`/`td`, from MarkdownIt's built-in table rule) carry
 * their text as a single bare `inline` token with no block wrapper, but the
 * tiptap schema's tableHeader/tableCell nodes require block content (so they
 * match regular paragraphs elsewhere in the doc). This wraps each cell's
 * inline token in a synthetic paragraph_open/paragraph_close pair that the
 * existing `paragraph` parser rule already knows how to turn into a node.
 */
export function tableCellRule(md: MarkdownIt): void {
  md.core.ruler.before("inline", "table_cell_paragraphs", (state) => {
    const tokens = state.tokens;
    const next: typeof tokens = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]!;
      next.push(tok);
      if ((tok.type === "th_open" || tok.type === "td_open") && tokens[i + 1]?.type === "inline") {
        next.push(new state.Token("paragraph_open", "p", 1));
        next.push(tokens[++i]!);
        next.push(new state.Token("paragraph_close", "p", -1));
      }
    }
    state.tokens = next;
  });
}
