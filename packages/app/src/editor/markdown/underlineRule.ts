import MarkdownIt from "markdown-it";

/**
 * Recognizes `<u>`/`</u>` as a dedicated mark (not generic raw HTML - `html`
 * stays disabled on the MarkdownIt instance), so underline can round-trip
 * through markdown via that conventional passthrough tag, the same way
 * other editors represent underline since CommonMark has no native syntax
 * for it.
 */
export function underlineRule(md: MarkdownIt): void {
  md.inline.ruler.before("emphasis", "underline", (state, silent): boolean => {
    const src = state.src;
    const pos = state.pos;
    if (src.startsWith("<u>", pos)) {
      if (!silent) state.push("u_open", "u", 1);
      state.pos += 3;
      return true;
    }
    if (src.startsWith("</u>", pos)) {
      if (!silent) state.push("u_close", "u", -1);
      state.pos += 4;
      return true;
    }
    return false;
  });
}
