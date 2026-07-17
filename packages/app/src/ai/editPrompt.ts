/** Builds the prompt for editing a selected fragment of a note (fix/rewrite/summarize/translate/...). */
export function buildEditPrompt(instruction: string, selectedMarkdown: string): { system: string; user: string } {
  const system =
    "You edit fragments of Markdown notes for mqpad, a Markdown editor. " +
    "Apply the user's instruction to the given fragment and return only the revised Markdown - " +
    "no explanation, no commentary, no surrounding code fence, no restating the instruction.";
  const user = `Instruction: ${instruction}\n\nFragment:\n\`\`\`\n${selectedMarkdown}\n\`\`\``;
  return { system, user };
}
