import { describe, expect, it } from "vitest";
import { extractNoteMeta, noteMetaFromMarkdown } from "./tagIndex";

describe("extractNoteMeta", () => {
  it("returns empty tags/category when there is no frontmatter", () => {
    expect(extractNoteMeta(null)).toEqual({ tags: [], category: null });
  });

  it("reads a `tags` array as-is", () => {
    expect(extractNoteMeta({ tags: ["work", "idea"] })).toEqual({ tags: ["work", "idea"], category: null });
  });

  it("splits a comma-separated `tags` string", () => {
    expect(extractNoteMeta({ tags: "work, idea ,  " })).toEqual({ tags: ["work", "idea"], category: null });
  });

  it("falls back to a singular `tag` key", () => {
    expect(extractNoteMeta({ tag: "work" })).toEqual({ tags: ["work"], category: null });
  });

  it("reads a scalar `category`", () => {
    expect(extractNoteMeta({ category: "Projects" })).toEqual({ tags: [], category: "Projects" });
  });

  it("falls back to the first item of a `categories` array", () => {
    expect(extractNoteMeta({ categories: ["Projects", "Archive"] })).toEqual({ tags: [], category: "Projects" });
  });

  it("ignores non-string/number items and blank entries", () => {
    expect(extractNoteMeta({ tags: ["work", "", 3, { nested: true }] })).toEqual({
      tags: ["work", "3"],
      category: null,
    });
  });
});

describe("noteMetaFromMarkdown", () => {
  it("extracts tags and category from a document's leading frontmatter", () => {
    const markdown = "---\ntitle: Hello\ntags:\n  - a\n  - b\ncategory: Notes\n---\nbody\n";
    expect(noteMetaFromMarkdown(markdown)).toEqual({ tags: ["a", "b"], category: "Notes" });
  });

  it("returns empty meta for a document without frontmatter", () => {
    expect(noteMetaFromMarkdown("# Title\n\nbody")).toEqual({ tags: [], category: null });
  });
});
