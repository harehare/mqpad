import { describe, expect, it } from "vitest";
import { fuzzyScore } from "./fuzzyMatch";

describe("fuzzyScore", () => {
  it("matches when query is a subsequence of target", () => {
    expect(fuzzyScore("tdl", "/notes/todo-list.md")).not.toBeNull();
  });

  it("returns null when query characters are out of order", () => {
    expect(fuzzyScore("lto", "/notes/todo-list.md")).toBeNull();
  });

  it("returns null when a character is missing entirely", () => {
    expect(fuzzyScore("xyz", "/notes/todo-list.md")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(fuzzyScore("TODO", "/notes/todo-list.md")).not.toBeNull();
  });

  it("returns 0 for an empty query", () => {
    expect(fuzzyScore("", "/notes/todo-list.md")).toBe(0);
  });

  it("scores a match right after a path separator higher than a mid-word match", () => {
    const afterSlash = fuzzyScore("todo", "/todo/other.md");
    const midWord = fuzzyScore("todo", "/xxxtodoxxx.md");
    expect(afterSlash).not.toBeNull();
    expect(midWord).not.toBeNull();
    expect(afterSlash as number).toBeGreaterThan(midWord as number);
  });

  it("scores a fully contiguous match higher than a scattered one", () => {
    const contiguous = fuzzyScore("todo", "/todo.md");
    const scattered = fuzzyScore("todo", "/t-o-d-o.md");
    expect(contiguous as number).toBeGreaterThan(scattered as number);
  });
});
