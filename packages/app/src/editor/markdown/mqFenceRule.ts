import MarkdownIt from "markdown-it";

/**
 * Retags ```mq / ```mq-vault fences as a distinct "mq_fence" token (so the
 * parser can route them to the mqCodeBlock node instead of the generic
 * codeBlock node), recording which scope produced them, and folds an
 * immediately following ```mq-result fence into it as the node's last-known
 * result, so a previously evaluated block round-trips intact. Both scopes
 * share the same ```mq-result fence name - the scope itself is enough to
 * know how to re-run it.
 */
export function mqFenceRule(md: MarkdownIt): void {
  md.core.ruler.push("mq_fence", (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token || token.type !== "fence") continue;
      const info = token.info.trim();
      if (info !== "mq" && info !== "mq-vault") continue;

      token.type = "mq_fence";
      const scope = info === "mq-vault" ? "vault" : "document";

      const next = tokens[i + 1];
      if (next && next.type === "fence" && next.info.trim() === "mq-result") {
        token.meta = { result: next.content, scope };
        tokens.splice(i + 1, 1);
      } else {
        token.meta = { result: "", scope };
      }
    }
    return true;
  });
}
