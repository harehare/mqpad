import { useCallback, useEffect, useRef, useState } from "react";
import type { FileNode, FileSystem } from "./fs/types";
import { noteMetaFromMarkdown, type NoteMeta } from "./tagIndex";

const EMPTY_META: NoteMeta = { tags: [], category: null };

function flattenMarkdownPaths(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      if (/\.mdx?$/i.test(node.name)) paths.push(node.path);
    } else {
      paths.push(...flattenMarkdownPaths(node.children ?? []));
    }
  }
  return paths;
}

/**
 * Indexes frontmatter `tags`/`category` across every markdown file in the vault, so the
 * file tree can filter/browse by them without every consumer re-reading and re-parsing files.
 * Rescans on `files` changes (create/rename/delete); `refreshPath` lets a caller cheaply update
 * a single entry after a save instead of waiting on the next full rescan.
 */
export function useTagIndex(fs: FileSystem, files: FileNode[]) {
  const [metaByPath, setMetaByPath] = useState<Record<string, NoteMeta>>({});
  // Guards against a slower, stale scan clobbering a newer one's results.
  const generation = useRef(0);

  useEffect(() => {
    const paths = flattenMarkdownPaths(files);
    const myGeneration = ++generation.current;
    Promise.all(
      paths.map(async (path) => {
        const content = await fs.readFile(path).catch(() => null);
        return [path, content === null ? EMPTY_META : noteMetaFromMarkdown(content)] as const;
      }),
    ).then((entries) => {
      if (generation.current !== myGeneration) return;
      setMetaByPath(Object.fromEntries(entries));
    });
  }, [fs, files]);

  const refreshPath = useCallback((path: string, content: string) => {
    setMetaByPath((prev) => ({ ...prev, [path]: noteMetaFromMarkdown(content) }));
  }, []);

  return { metaByPath, refreshPath };
}
