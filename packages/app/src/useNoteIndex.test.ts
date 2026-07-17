import { describe, expect, it } from "vitest";
import { extractOutgoingLinks, flattenMarkdownPaths } from "./useNoteIndex";
import type { FileNode } from "./fs/types";

describe("extractOutgoingLinks", () => {
  it("resolves a wikilink relative to the file's own directory", () => {
    expect(extractOutgoingLinks("See [[Other Note]] for details.", "/journal")).toEqual(["/journal/Other Note.md"]);
  });

  it("ignores the alias half of `[[Title|Alias]]`", () => {
    expect(extractOutgoingLinks("[[Other Note|display text]]", "/")).toEqual(["/Other Note.md"]);
  });

  it("dedupes repeated links to the same target", () => {
    expect(extractOutgoingLinks("[[A]] mentioned twice: [[A]]", "/")).toEqual(["/A.md"]);
  });

  it("returns an empty array when there are no wikilinks", () => {
    expect(extractOutgoingLinks("Just plain text.", "/")).toEqual([]);
  });

  it("resolves against the vault root when the file is at the top level", () => {
    expect(extractOutgoingLinks("[[Home]]", "/")).toEqual(["/Home.md"]);
  });
});

describe("flattenMarkdownPaths", () => {
  it("collects markdown files recursively and skips non-markdown files", () => {
    const tree: FileNode[] = [
      { name: "a.md", path: "/a.md", type: "file" },
      { name: "image.png", path: "/image.png", type: "file" },
      {
        name: "folder",
        path: "/folder",
        type: "directory",
        children: [{ name: "b.markdown", path: "/folder/b.markdown", type: "file" }],
      },
    ];
    expect(flattenMarkdownPaths(tree)).toEqual(["/a.md", "/folder/b.markdown"]);
  });
});
