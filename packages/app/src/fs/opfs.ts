import type { FileNode, FileSystem } from "./types";
import { FileSystemError } from "./types";

/**
 * Origin Private File System backend for the standalone web app. Adapted from
 * mq's mq-playground OPFSFileSystem (same author/license, ported rather than
 * imported since mqpad lives in a separate repo).
 */
export class OPFSFileSystem implements FileSystem {
  private root: FileSystemDirectoryHandle | null = null;
  private readonly vaultName: string;

  constructor(vaultName = "mqpad") {
    this.vaultName = vaultName;
  }

  static isSupported(): boolean {
    return "storage" in navigator && "getDirectory" in navigator.storage;
  }

  async initialize(): Promise<void> {
    if (!OPFSFileSystem.isSupported()) {
      throw new FileSystemError(
        "Origin Private File System is not supported in this browser",
      );
    }
    const opfsRoot = await navigator.storage.getDirectory();
    this.root = await opfsRoot.getDirectoryHandle(this.vaultName, {
      create: true,
    });
  }

  private requireRoot(): FileSystemDirectoryHandle {
    if (!this.root) throw new FileSystemError("File system not initialized");
    return this.root;
  }

  private async getParentDir(
    path: string,
    create: boolean,
  ): Promise<{ dir: FileSystemDirectoryHandle; name: string }> {
    const parts = path.split("/").filter(Boolean);
    const name = parts.pop();
    if (!name) throw new FileSystemError(`Invalid path: ${path}`);

    let dir = this.requireRoot();
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return { dir, name };
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { dir, name } = await this.getParentDir(path, true);
    const fileHandle = await dir.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async readFile(path: string): Promise<string> {
    const { dir, name } = await this.getParentDir(path, false);
    const fileHandle = await dir.getFileHandle(name);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  async deleteFile(path: string): Promise<void> {
    const { dir, name } = await this.getParentDir(path, false);
    await dir.removeEntry(name);
  }

  async createDirectory(path: string): Promise<void> {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) throw new FileSystemError(`Invalid path: ${path}`);

    let dir = this.requireRoot();
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
  }

  async deleteDirectory(path: string): Promise<void> {
    const { dir, name } = await this.getParentDir(path, false);
    await dir.removeEntry(name, { recursive: true });
  }

  async isDirectoryPath(path: string): Promise<boolean> {
    try {
      const { dir, name } = await this.getParentDir(path, false);
      await dir.getDirectoryHandle(name);
      return true;
    } catch {
      return false;
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      const { dir, name } = await this.getParentDir(path, false);
      await dir.getFileHandle(name);
      return true;
    } catch {
      return false;
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    if (await this.isDirectoryPath(oldPath)) {
      await this.copyDirectory(oldPath, newPath);
      await this.deleteDirectory(oldPath);
    } else {
      const content = await this.readFile(oldPath);
      await this.writeFile(newPath, content);
      await this.deleteFile(oldPath);
    }
  }

  private async copyDirectory(
    sourcePath: string,
    destPath: string,
  ): Promise<void> {
    await this.createDirectory(destPath);
    const entries = await this.listAllFiles(sourcePath);
    for (const entry of entries) {
      const relative = entry.path.substring(sourcePath.length);
      const destEntryPath = destPath + relative;
      if (entry.type === "directory") {
        await this.copyDirectory(entry.path, destEntryPath);
      } else {
        await this.writeFile(destEntryPath, await this.readFile(entry.path));
      }
    }
  }

  /** Directory listing for display: markdown files only, but all directories (even ones with no markdown inside). */
  async listFiles(path = "/"): Promise<FileNode[]> {
    const nodes = await this.listAllFiles(path);
    return filterToMarkdown(nodes);
  }

  /** Unfiltered directory listing, used for actual file operations (e.g. copy/rename). */
  private async listAllFiles(path: string): Promise<FileNode[]> {
    const parts = path.split("/").filter(Boolean);
    let dir = this.requireRoot();
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part);
    }

    const result: FileNode[] = [];
    for await (const entry of dir.values()) {
      const nodePath = path === "/" ? `/${entry.name}` : `${path}/${entry.name}`;
      if (entry.kind === "directory") {
        result.push({
          name: entry.name,
          path: nodePath,
          type: "directory",
          children: await this.listAllFiles(nodePath),
        });
      } else {
        result.push({ name: entry.name, path: nodePath, type: "file" });
      }
    }

    return sortNodes(result);
  }
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown)$/i.test(name);
}

/** Keeps every directory but drops non-markdown files, recursively. */
function filterToMarkdown(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === "directory") {
      result.push({ ...node, children: filterToMarkdown(node.children ?? []) });
    } else if (isMarkdownFile(node.name)) {
      result.push(node);
    }
  }
  return result;
}
