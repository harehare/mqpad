import type { FileNode, FileSystem } from "./types";
import { FileSystemError } from "./types";

/**
 * Wraps one `FileSystemFileHandle` (from a drag-and-drop drop or a file
 * picker) as a one-file "vault", so the standard App/FileTree UI can open
 * and save it directly on disk - no OPFS vault folder required. This is
 * "preview mode": opening a single `.md` file that lives outside the vault.
 */
export class SingleFileFileSystem implements FileSystem {
  readonly path: string;

  constructor(private readonly handle: FileSystemFileHandle) {
    this.path = `/${handle.name}`;
  }

  async initialize(): Promise<void> {}

  async listFiles(): Promise<FileNode[]> {
    return [{ name: this.handle.name, path: this.path, type: "file" }];
  }

  async readFile(path: string): Promise<string> {
    this.assertPath(path);
    const file = await this.handle.getFile();
    return await file.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.assertPath(path);
    const writable = await this.handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async deleteFile(): Promise<void> {
    throw new FileSystemError("This file was opened directly - close the tab instead of deleting it");
  }

  async createDirectory(): Promise<void> {
    throw new FileSystemError("Folders aren't available when a file is opened directly");
  }

  async deleteDirectory(): Promise<void> {
    throw new FileSystemError("Folders aren't available when a file is opened directly");
  }

  async renameFile(): Promise<void> {
    throw new FileSystemError("Renaming isn't available when a file is opened directly");
  }

  async fileExists(path: string): Promise<boolean> {
    return path === this.path;
  }

  async isDirectoryPath(): Promise<boolean> {
    return false;
  }

  private assertPath(path: string): void {
    if (path !== this.path) throw new FileSystemError(`Unknown path: ${path}`);
  }
}
