const MQ_PRIMER = `mq is a jq-like query language for querying and transforming Markdown. A query is a pipeline of selectors and functions separated by "|".

Selectors match nodes by kind: .h1/.h2/.h3 (headings by level), .h (any heading), .[] (list items), .code (code blocks), .link, .table.
Functions transform or filter the piped-in value, e.g.:
  select(condition) - keep only matching nodes
  test(to_text(), "pattern") - regex test against a node's text
  upcase() / downcase() - change case
  to_text() - get a node's plain text

Examples:
  .h1                              -> all level-1 headings
  .h | select(test(to_text(), "TODO"))   -> headings whose text contains "TODO"
  .[] | select(test(to_text(), "^\\[x\\]"))   -> completed task list items
  .code | select(test(., "js"))    -> JS code blocks

Output only the mq query itself - no explanation, no markdown code fence, no surrounding text.`;

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…(truncated)` : text;
}

/** Builds the prompt for turning a natural-language instruction into an mq query, grounded in a sample of the content it'll run against. */
export function buildQueryPrompt(
  instruction: string,
  sampleContent: string,
  scope: "document" | "vault",
): { system: string; user: string } {
  const system = `You write mq queries for mqpad, a Markdown editor with a built-in mq query engine.\n\n${MQ_PRIMER}`;
  const scopeNote =
    scope === "vault"
      ? "This query will run once per note across the whole vault and the results will be combined - write it as if it processes a single note's Markdown."
      : "This query will run against the current note's Markdown.";
  const user = `${scopeNote}\n\nSample Markdown content:\n\`\`\`\n${truncate(sampleContent, 4000)}\n\`\`\`\n\nInstruction: ${instruction}`;
  return { system, user };
}
