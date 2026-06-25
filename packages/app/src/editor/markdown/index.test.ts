import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { describe, expect, it } from "vitest";
import { MathBlock } from "../extensions/MathBlock";
import { MqCodeBlock } from "../extensions/MqCodeBlock";
import { WikiLink } from "../extensions/WikiLink";
import { buildMarkdownParser, buildMarkdownSerializer, serializeToMarkdown } from "./index";

const schema = getSchema([
  StarterKit,
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
const serializer = buildMarkdownSerializer();

function roundTrip(markdown: string): string {
  const doc = parser.parse(markdown);
  return serializeToMarkdown(serializer, doc);
}

describe("markdown round-trip", () => {
  it("preserves headings and inline marks", () => {
    const md = "# Title\n\nHello **bold**, *italic*, ~~strike~~, and `code`.";
    expect(roundTrip(md)).toBe(md);
  });

  it("preserves underline via the <u> passthrough tag", () => {
    const md = "Some <u>underlined</u> text.";
    expect(roundTrip(md)).toBe(md);
  });

  it("preserves lists", () => {
    const md = "- one\n- two\n- three";
    expect(roundTrip(md)).toBe(md);
  });

  it("preserves links", () => {
    const md = 'See [the site](https://example.com "Example").';
    expect(roundTrip(md)).toBe(md);
  });

  it("preserves generic fenced code blocks", () => {
    const md = "```js\nconsole.log(1)\n```";
    expect(roundTrip(md)).toBe(md);
  });

  it("parses a wikilink into a wikiLink node and serializes it back", () => {
    const md = "See [[Project Notes]] for details.";
    const doc = parser.parse(md);

    let found: { title: string; alias: string | null } | null = null;
    doc.descendants((node) => {
      if (node.type.name === "wikiLink") {
        found = { title: node.attrs.title, alias: node.attrs.alias };
      }
    });

    expect(found).toEqual({ title: "Project Notes", alias: null });
    expect(serializeToMarkdown(serializer, doc)).toBe(md);
  });

  it("round-trips a wikilink with an alias", () => {
    const md = "[[Project Notes|notes]]";
    expect(roundTrip(md)).toBe(md);
  });

  it("parses an mq fence into an mqCodeBlock node with an empty result", () => {
    const md = "```mq\n.h1\n```";
    const doc = parser.parse(md);

    let found: { query: string; result: string } | null = null;
    doc.descendants((node) => {
      if (node.type.name === "mqCodeBlock") {
        found = { query: node.attrs.query, result: node.attrs.result };
      }
    });

    expect(found).toEqual({ query: ".h1", result: "" });
    expect(roundTrip(md)).toBe(md);
  });

  it("round-trips an mq fence with a previously evaluated result", () => {
    const md = "```mq\n.h1\n```\n\n```mq-result\n# Output\n```";
    const doc = parser.parse(md);

    let found: { query: string; result: string } | null = null;
    doc.descendants((node) => {
      if (node.type.name === "mqCodeBlock") {
        found = { query: node.attrs.query, result: node.attrs.result };
      }
    });

    expect(found).toEqual({ query: ".h1", result: "# Output" });
    expect(roundTrip(md)).toBe(md);
  });

  it("copy mode replaces an mq block with its evaluated result instead of the live fences", () => {
    const md = "Before.\n\n```mq\n.h1\n```\n\n```mq-result\n# Output\n```\n\nAfter.";
    const doc = parser.parse(md);
    const copySerializer = buildMarkdownSerializer({ mqCodeBlock: "result" });

    expect(serializeToMarkdown(copySerializer, doc)).toBe("Before.\n\n# Output\n\nAfter.");
  });

  it("copy mode drops an mq block entirely when it has never been run", () => {
    const md = "Before.\n\n```mq\n.h1\n```\n\nAfter.";
    const doc = parser.parse(md);
    const copySerializer = buildMarkdownSerializer({ mqCodeBlock: "result" });

    expect(serializeToMarkdown(copySerializer, doc)).toBe("Before.\n\nAfter.");
  });

  it("copy mode preserves a multi-line result verbatim", () => {
    const md = "```mq\n.h1\n```\n\n```mq-result\n# A\n\n- one\n- two\n```";
    const doc = parser.parse(md);
    const copySerializer = buildMarkdownSerializer({ mqCodeBlock: "result" });

    expect(serializeToMarkdown(copySerializer, doc)).toBe("# A\n\n- one\n- two");
  });

  it("parses a $$...$$ block into a mathBlock node and round-trips it", () => {
    const md = "$$\nx^2 + y^2 = z^2\n$$";
    const doc = parser.parse(md);

    let found: { source: string } | null = null;
    doc.descendants((node) => {
      if (node.type.name === "mathBlock") {
        found = { source: node.attrs.source };
      }
    });

    expect(found).toEqual({ source: "x^2 + y^2 = z^2" });
    expect(roundTrip(md)).toBe(md);
  });

  it("preserves a mermaid fence as a generic code block", () => {
    const md = "```mermaid\ngraph TD\n  A --> B\n```";
    expect(roundTrip(md)).toBe(md);
  });

  it("parses a GFM table into table/tableRow/tableHeader/tableCell nodes and round-trips it", () => {
    const md = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";
    const doc = parser.parse(md);

    const headerCells: string[] = [];
    doc.descendants((node) => {
      if (node.type.name === "tableHeader") headerCells.push(node.textContent);
    });

    expect(headerCells).toEqual(["Name", "Age"]);
    expect(roundTrip(md)).toBe(md);
  });

  it("round-trips column alignment markers", () => {
    const md = "| A | B | C |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |";
    expect(roundTrip(md)).toBe(md);
  });

  it("escapes pipes inside table cells", () => {
    const md = "| A |\n| --- |\n| 1 \\| 2 |";
    expect(roundTrip(md)).toBe(md);
  });

  it("parses a GFM task list into taskList/taskItem nodes with checked state", () => {
    const md = "- [ ] todo\n- [x] done";
    const doc = parser.parse(md);

    const items: boolean[] = [];
    doc.descendants((node) => {
      if (node.type.name === "taskItem") items.push(node.attrs.checked);
    });

    expect(items).toEqual([false, true]);
    expect(roundTrip(md)).toBe(md);
  });

  it("leaves a plain bullet list unaffected by the task list rule", () => {
    const md = "- one\n- two";
    const doc = parser.parse(md);

    let sawTaskItem = false;
    doc.descendants((node) => {
      if (node.type.name === "taskItem") sawTaskItem = true;
    });

    expect(sawTaskItem).toBe(false);
    expect(roundTrip(md)).toBe(md);
  });
});
