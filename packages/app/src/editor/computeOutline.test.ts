import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { describe, expect, it } from "vitest";
import { Image } from "./extensions/Image";
import { MathBlock } from "./extensions/MathBlock";
import { MqCodeBlock } from "./extensions/MqCodeBlock";
import { WikiLink } from "./extensions/WikiLink";
import { buildMarkdownParser } from "./markdown";
import { computeOutline } from "./computeOutline";

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

describe("computeOutline", () => {
  it("returns no headings for a document without any", () => {
    const doc = parser.parse("just a paragraph");
    expect(computeOutline(doc)).toEqual([]);
  });

  it("lists headings in document order with their level and position", () => {
    const doc = parser.parse("# Title\n\nintro\n\n## Section\n\nbody\n\n### Sub\n\nmore");
    expect(computeOutline(doc)).toEqual([
      { level: 1, text: "Title", pos: 0 },
      { level: 2, text: "Section", pos: expect.any(Number) },
      { level: 3, text: "Sub", pos: expect.any(Number) },
    ]);
  });

  it("uses the heading's plain text content, ignoring inline marks", () => {
    const doc = parser.parse("# **Bold** and *italic*");
    expect(computeOutline(doc)).toEqual([{ level: 1, text: "Bold and italic", pos: 0 }]);
  });
});
