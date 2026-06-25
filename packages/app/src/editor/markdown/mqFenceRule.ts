import MarkdownIt from "markdown-it";

/**
 * Retags ```mq fences as a distinct "mq_fence" token (so the parser can route
 * them to the mqCodeBlock node instead of the generic codeBlock node), and
 * folds an immediately following ```mq-result fence into it as the node's
 * last-known result, so a previously evaluated block round-trips intact.
 */
export function mqFenceRule(md: MarkdownIt): void {
  md.core.ruler.push("mq_fence", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token || token.type !== "fence" || token.info.trim() !== "mq") continue;

      token.type = "mq_fence";

      const next = tokens[i + 1];
      if (next && next.type === "fence" && next.info.trim() === "mq-result") {
        token.meta = { result: next.content };
        tokens.splice(i + 1, 1);
      } else {
        token.meta = { result: "" };
      }
    }
    return true;
  });
}
