import { describe, expect, it } from "vitest";
import { formatMermaidError, renderMermaid } from "./mermaid";

describe("renderMermaid", () => {
  it("does not leak mermaid's error diagram into the document on invalid syntax", async () => {
    await expect(renderMermaid("test-block", "graph TD\n A --> B --> \n not valid $$$")).rejects.toThrow();
    expect(document.body.innerHTML).toBe("");
  });
});

describe("formatMermaidError", () => {
  it("drops the column-pointer line but keeps the rest of the message", () => {
    const raw = [
      "Parse error on line 3:",
      "...-> B -->   totally not valid $$$",
      "----------------------^",
      "Expecting 'SEMI', 'NEWLINE', got 'NODE_STRING'",
    ].join("\n");

    expect(formatMermaidError(raw)).toBe(
      ["Parse error on line 3:", "...-> B -->   totally not valid $$$", "Expecting 'SEMI', 'NEWLINE', got 'NODE_STRING'"].join(
        "\n",
      ),
    );
  });

  it("leaves messages without a pointer line unchanged", () => {
    expect(formatMermaidError("No diagram type detected")).toBe("No diagram type detected");
  });
});
