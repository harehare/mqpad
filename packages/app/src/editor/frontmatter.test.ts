import { describe, expect, it } from "vitest";
import { dataToRows, parseFrontmatter, rowsToData, stringifyFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("returns no frontmatter for a plain document", () => {
    expect(parseFrontmatter("# Title\n\nbody")).toEqual({ data: null, body: "# Title\n\nbody" });
  });

  it("extracts a leading YAML block and the remaining body", () => {
    const markdown = "---\ntitle: Hello\ntags:\n  - a\n  - b\n---\n# Title\n\nbody\n";
    expect(parseFrontmatter(markdown)).toEqual({
      data: { title: "Hello", tags: ["a", "b"] },
      body: "# Title\n\nbody\n",
    });
  });

  it("treats an unparsable YAML block as no frontmatter, leaving the document untouched", () => {
    const markdown = "---\n: not valid yaml :::\n---\nbody";
    expect(parseFrontmatter(markdown)).toEqual({ data: null, body: markdown });
  });

  it("treats a non-mapping YAML block (e.g. a scalar or list) as no frontmatter", () => {
    const markdown = "---\n- a\n- b\n---\nbody";
    expect(parseFrontmatter(markdown)).toEqual({ data: null, body: markdown });
  });

  it("ignores a horizontal rule that isn't at the very start of the document", () => {
    const markdown = "intro\n\n---\ntitle: Hello\n---\nbody";
    expect(parseFrontmatter(markdown)).toEqual({ data: null, body: markdown });
  });
});

describe("stringifyFrontmatter", () => {
  it("returns the body unchanged when there's no frontmatter data", () => {
    expect(stringifyFrontmatter(null, "body")).toBe("body");
    expect(stringifyFrontmatter({}, "body")).toBe("body");
  });

  it("re-serializes frontmatter data ahead of the body", () => {
    expect(stringifyFrontmatter({ title: "Hello", tags: ["a", "b"] }, "body\n")).toBe(
      "---\ntitle: Hello\ntags:\n  - a\n  - b\n---\nbody\n",
    );
  });

  it("round-trips through parseFrontmatter", () => {
    const markdown = "---\ntitle: Hello\ndraft: true\ncount: 3\n---\n# Body\n";
    const { data, body } = parseFrontmatter(markdown);
    expect(stringifyFrontmatter(data, body)).toBe(markdown);
  });
});

describe("dataToRows / rowsToData", () => {
  it("infers a row type per value and gives every row a unique id", () => {
    const rows = dataToRows({ title: "Hello", count: 3, draft: true, tags: ["a", "b"] });
    expect(rows).toMatchObject([
      { key: "title", type: "string", value: "Hello" },
      { key: "count", type: "number", value: 3 },
      { key: "draft", type: "boolean", value: true },
      { key: "tags", type: "array", value: ["a", "b"] },
    ]);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it("keeps a nested object as an unsupported, pass-through value", () => {
    const rows = dataToRows({ nested: { a: 1 } });
    expect(rows).toEqual([{ id: rows[0]!.id, key: "nested", type: "unsupported", value: { a: 1 } }]);
  });

  it("drops rows with a blank key and filters out empty array items", () => {
    const rows = dataToRows({ title: "Hello", tags: ["a", ""] });
    rows.push({ id: "extra", key: "  ", type: "string", value: "ignored" });
    expect(rowsToData(rows)).toEqual({ title: "Hello", tags: ["a"] });
  });

  it("returns null when there are no fields left", () => {
    expect(rowsToData([])).toBeNull();
  });
});
