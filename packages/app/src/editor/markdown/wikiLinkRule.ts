import MarkdownIt from "markdown-it";

/**
 * Recognizes Obsidian-style `[[Title]]` / `[[Title|Alias]]` wikilinks as a
 * single inline token, so the markdown parser can turn them into wikiLink
 * nodes instead of plain text.
 */
export function wikiLinkRule(md: MarkdownIt): void {
  md.inline.ruler.before(
    "link",
    "wikilink",
    (state, silent): boolean => {
      const src = state.src;
      const start = state.pos;
      if (src.charCodeAt(start) !== 0x5b || src.charCodeAt(start + 1) !== 0x5b) {
        return false;
      }

      const end = src.indexOf("]]", start + 2);
      if (end === -1) return false;

      const inner = src.slice(start + 2, end);
      if (!inner || inner.includes("\n")) return false;

      const [titleRaw, ...aliasParts] = inner.split("|");
      const title = (titleRaw ?? "").trim();
      if (!title) return false;
      const alias = aliasParts.length > 0 ? aliasParts.join("|").trim() : null;

      if (!silent) {
        const token = state.push("wikilink", "", 0);
        token.meta = { title, alias };
        token.content = inner;
      }

      state.pos = end + 2;
      return true;
    },
  );
}
