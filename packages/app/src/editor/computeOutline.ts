import type { Node as PMNode } from "@tiptap/pm/model";

export type HeadingItem = { level: number; text: string; pos: number };

export function computeOutline(doc: PMNode): HeadingItem[] {
  const items: HeadingItem[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    items.push({ level: node.attrs.level as number, text: node.textContent, pos });
  });
  return items;
}
