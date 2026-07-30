import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { describe, expect, it } from "vitest";
import { buildMarkdownParser } from "../markdown";
import { Image } from "./Image";
import { MathBlock } from "./MathBlock";
import { MqCodeBlock } from "./MqCodeBlock";
import { WikiLink } from "./WikiLink";
import { findMatches } from "./FindAndReplace";

const schema = getSchema([
  StarterKit,
  Image,
  WikiLink,
  MqCodeBlock,
  MathBlock,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: true }),
]);
const parser = buildMarkdownParser(schema);

describe("findMatches", () => {
  it("returns no matches for an empty query", () => {
    const doc = parser.parse("hello world");
    expect(findMatches(doc, "", false)).toEqual([]);
  });

  it("finds all case-insensitive matches by default", () => {
    const doc = parser.parse("Foo bar foo");
    const matches = findMatches(doc, "foo", false);
    expect(matches).toHaveLength(2);
  });

  it("respects case sensitivity when requested", () => {
    const doc = parser.parse("Foo bar foo");
    expect(findMatches(doc, "Foo", true)).toHaveLength(1);
  });

  it("treats the query as a literal string, not a regex", () => {
    const doc = parser.parse("a.b a+b");
    expect(findMatches(doc, "a.b", false)).toHaveLength(1);
  });

  it("returns no matches when the query isn't present", () => {
    const doc = parser.parse("hello world");
    expect(findMatches(doc, "xyz", false)).toEqual([]);
  });
});
