export type FileNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
};

/**
 * Storage backend abstraction. Implementations: OPFSFileSystem (standalone web
 * app) and BridgeFileSystem (VS Code webview, proxies to vscode.workspace.fs).
 */
export interface FileSystem {
  initialize(): Promise<void>;
  listFiles(path?: string): Promise<FileNode[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  createDirectory(path: string): Promise<void>;
  deleteDirectory(path: string): Promise<void>;
  renameFile(oldPath: string, newPath: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  isDirectoryPath(path: string): Promise<boolean>;
  /**
   * Watches a single file for changes made outside mqpad (another app, an AI
   * CLI agent, etc.) and calls `onChange` when they happen. Returns an
   * unsubscribe function. Optional - backends with no way to observe
   * external writes (e.g. OPFS, which nothing outside the browser origin can
   * reach) simply omit it.
   */
  watch?(path: string, onChange: () => void): () => void;
}

export class FileSystemError extends Error {}
