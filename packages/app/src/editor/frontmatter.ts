import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type FrontmatterData = Record<string, unknown>;

const FRONTMATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n)*/;

export type ParsedMarkdown = {
  /** `null` when the document has no leading frontmatter block, or it isn't a YAML mapping. */
  data: FrontmatterData | null;
  body: string;
};

/** Splits a markdown document into its leading `---` YAML block (if any) and the remaining body. */
export function parseFrontmatter(markdown: string): ParsedMarkdown {
  const match = FRONTMATTER_BLOCK.exec(markdown);
  if (!match) return { data: null, body: markdown };

  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]!);
  } catch {
    return { data: null, body: markdown };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { data: null, body: markdown };
  }

  return { data: parsed as FrontmatterData, body: markdown.slice(match[0].length) };
}

/** Reassembles a markdown document from frontmatter data (or none) and a body. */
export function stringifyFrontmatter(data: FrontmatterData | null, body: string): string {
  if (!data || Object.keys(data).length === 0) return body;
  return `---\n${stringifyYaml(data)}---\n${body}`;
}

/** The form's notion of a field type - drives which input widget a row renders. */
export type FrontmatterRowType = "string" | "number" | "boolean" | "array" | "unsupported";

export type FrontmatterRow = {
  /** Stable across edits so React doesn't remount the row's inputs (and lose focus) on every keystroke. */
  id: string;
  key: string;
  type: FrontmatterRowType;
  /** Array values are always string[] in the form, regardless of their original item types - simplest editable shape for a tag list. "unsupported" keeps the original value verbatim. */
  value: string | number | boolean | string[] | unknown;
};

function rowTypeOf(value: unknown): FrontmatterRowType {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value) && value.every((item) => typeof item !== "object" || item === null)) {
    return "array";
  }
  return "unsupported";
}

let nextRowId = 0;

/** Builds the form's row model from parsed frontmatter data. */
export function dataToRows(data: FrontmatterData | null): FrontmatterRow[] {
  if (!data) return [];
  return Object.entries(data).map(([key, value]) => {
    const type = rowTypeOf(value);
    return {
      id: String(nextRowId++),
      key,
      type,
      value: type === "array" ? (value as unknown[]).map((item) => String(item)) : value,
    };
  });
}

export function emptyRow(): FrontmatterRow {
  return { id: String(nextRowId++), key: "", type: "string", value: "" };
}

/** Converts the form's row model back into frontmatter data, dropping rows whose key is blank. */
export function rowsToData(rows: FrontmatterRow[]): FrontmatterData | null {
  const data: FrontmatterData = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    data[key] = row.type === "array" ? (row.value as string[]).filter((item) => item !== "") : row.value;
  }
  return Object.keys(data).length > 0 ? data : null;
}
