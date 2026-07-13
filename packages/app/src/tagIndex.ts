import { parseFrontmatter, type FrontmatterData } from "./editor/frontmatter";

export type NoteMeta = {
  tags: string[];
  category: string | null;
};

const EMPTY_META: NoteMeta = { tags: [], category: null };

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "number") return [String(value)];
  return [];
}

function toSingleString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length > 0 ? toSingleString(value[0]) : null;
  return null;
}

/** Reads the `tags`/`tag` and `category`/`categories` frontmatter keys, tolerating either array or scalar shapes. */
export function extractNoteMeta(data: FrontmatterData | null): NoteMeta {
  if (!data) return EMPTY_META;
  const tags = toStringArray(data.tags ?? data.tag);
  const category = toSingleString(data.category ?? data.categories);
  return tags.length === 0 && category === null ? EMPTY_META : { tags, category };
}

export function noteMetaFromMarkdown(markdown: string): NoteMeta {
  return extractNoteMeta(parseFrontmatter(markdown).data);
}
