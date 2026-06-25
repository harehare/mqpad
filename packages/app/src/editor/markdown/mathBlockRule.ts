import MarkdownIt from "markdown-it";

/**
 * Recognizes a `$$` ... `$$` block (delimiters alone on their own line, or a
 * single `$$ ... $$` line) as a "math_block" token, the KaTeX analog of how
 * mqFenceRule retags ```mq fences - kept block-level (not stacked on the
 * `fence` rule) since `$$` isn't a code fence marker MarkdownIt recognizes.
 */
export function mathBlockRule(md: MarkdownIt): void {
  md.block.ruler.before(
    "fence",
    "math_block",
    (state, startLine, endLine, silent) => {
      const start = state.bMarks[startLine]! + state.tShift[startLine]!;
      const max = state.eMarks[startLine]!;
      const line = state.src.slice(start, max);
      const trimmed = line.trim();

      if (!trimmed.startsWith("$$")) return false;

      // Single-line form: `$$ ... $$`.
      if (trimmed.length > 2 && trimmed.endsWith("$$")) {
        if (silent) return true;
        const content = trimmed.slice(2, -2);
        state.line = startLine + 1;
        const token = state.push("math_block", "", 0);
        token.content = content;
        token.map = [startLine, state.line];
        return true;
      }

      if (trimmed !== "$$") return false;

      let nextLine = startLine;
      let found = false;
      let content = "";
      while (nextLine + 1 < endLine) {
        nextLine++;
        const lineStart = state.bMarks[nextLine]! + state.tShift[nextLine]!;
        const lineMax = state.eMarks[nextLine]!;
        const candidate = state.src.slice(lineStart, lineMax);
        if (candidate.trim() === "$$") {
          found = true;
          break;
        }
        content += `${candidate}\n`;
      }
      if (!found) return false;
      if (silent) return true;

      state.line = nextLine + 1;
      const token = state.push("math_block", "", 0);
      token.content = content;
      token.map = [startLine, state.line];
      return true;
    },
    { alt: [] },
  );
}
