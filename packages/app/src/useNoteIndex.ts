import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileNode, FileSystem } from "./fs/types";
import { noteMetaFromMarkdown, type NoteMeta } from "./tagIndex";

const EMPTY_META: NoteMeta = { tags: [], category: null };

// Matches what the FileSystem backends themselves treat as a note (see
// OPFSFileSystem's isMarkdownFile) - .md and .markdown, not just .md/.mdx.
export function flattenMarkdownPaths(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      if (/\.(md|markdown)$/i.test(node.name)) paths.push(node.path);
    } else {
      paths.push(...flattenMarkdownPaths(node.children ?? []));
    }
  }
  return paths;
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

function joinPath(dir: string, name: string): string {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

/** Same pattern WikiLink.ts uses to recognize `[[Title]]` / `[[Title|Alias]]` while typing. */
function wikilinkPattern(): RegExp {
  return /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g;
}

/** Resolves every `[[Title]]` in a file's content to the absolute path it points at, the same way App.tsx's resolveWikiLinkTarget does. */
export function extractOutgoingLinks(content: string, fileDir: string): string[] {
  const targets = new Set<string>();
  const pattern = wikilinkPattern();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    const title = (match[1] ?? "").trim();
    if (title) targets.add(joinPath(fileDir, `${title}.md`));
  }
  return [...targets];
}

type NoteIndexEntry = {
  meta: NoteMeta;
  content: string;
  links: string[];
};

const EMPTY_ENTRY: NoteIndexEntry = { meta: EMPTY_META, content: "", links: [] };

function buildEntry(path: string, content: string): NoteIndexEntry {
  return {
    meta: noteMetaFromMarkdown(content),
    content,
    links: extractOutgoingLinks(content, dirname(path)),
  };
}

/**
 * Indexes every markdown file in the vault - frontmatter `tags`/`category`, raw content, and
 * outgoing `[[WikiLink]]` targets - so consumers (tag/category browsing, full-text search,
 * backlinks) don't each re-read and re-parse every file themselves. Rescans on `files` changes
 * (create/rename/delete); `refreshPath` lets a caller cheaply update a single entry after a save
 * instead of waiting on the next full rescan.
 */
export function useNoteIndex(fs: FileSystem, files: FileNode[]) {
  const [indexByPath, setIndexByPath] = useState<Record<string, NoteIndexEntry>>({});
  // Guards against a slower, stale scan clobbering a newer one's results.
  const generation = useRef(0);

  useEffect(() => {
    const paths = flattenMarkdownPaths(files);
    const myGeneration = ++generation.current;
    Promise.all(
      paths.map(async (path) => {
        const content = await fs.readFile(path).catch(() => null);
        return [path, content === null ? EMPTY_ENTRY : buildEntry(path, content)] as const;
      }),
    ).then((entries) => {
      if (generation.current !== myGeneration) return;
      setIndexByPath(Object.fromEntries(entries));
    });
  }, [fs, files]);

  const refreshPath = useCallback((path: string, content: string) => {
    setIndexByPath((prev) => ({ ...prev, [path]: buildEntry(path, content) }));
  }, []);

  const metaByPath = useMemo(
    () => Object.fromEntries(Object.entries(indexByPath).map(([path, entry]) => [path, entry.meta])),
    [indexByPath],
  );

  const contentByPath = useMemo(
    () => Object.fromEntries(Object.entries(indexByPath).map(([path, entry]) => [path, entry.content])),
    [indexByPath],
  );

  /** For each note, the notes whose `[[WikiLink]]`s resolve to it. */
  const backlinksByPath = useMemo(() => {
    const reverse: Record<string, string[]> = {};
    for (const [sourcePath, entry] of Object.entries(indexByPath)) {
      for (const target of entry.links) {
        (reverse[target] ??= []).push(sourcePath);
      }
    }
    return reverse;
  }, [indexByPath]);

  return { metaByPath, contentByPath, backlinksByPath, refreshPath };
}
