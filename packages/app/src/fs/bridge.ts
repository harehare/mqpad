import type { FileSystem } from "./types";
import {
  type FsChangeMessage,
  type FsMethod,
  type FsRequestArgs,
  type FsResponseMessage,
  type FsResult,
  isFsChangeMessage,
  isFsResponseMessage,
} from "./bridgeProtocol";

export type VsCodeApi = {
  postMessage(message: unknown): void;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

let nextId = 0;

/**
 * FileSystem backend for the VS Code webview: every call is shipped to the
 * extension host via postMessage, which performs the real I/O with
 * vscode.workspace.fs and replies with a correlated response message.
 */
export class BridgeFileSystem implements FileSystem {
  private readonly pending = new Map<string, Pending>();
  private readonly watchers = new Map<string, Set<() => void>>();

  constructor(private readonly vscode: VsCodeApi) {
    window.addEventListener("message", (event: MessageEvent) => {
      const message = event.data;
      if (isFsResponseMessage(message)) {
        this.handleResponse(message);
        return;
      }
      if (isFsChangeMessage(message)) {
        this.handleChange(message);
      }
    });
  }

  private handleResponse(message: FsResponseMessage): void {
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.ok) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error(message.error));
    }
  }

  private handleChange(message: FsChangeMessage): void {
    for (const callback of this.watchers.get(message.path) ?? []) callback();
  }

  /** The extension host watches the vault on disk; this just fans its push messages out by path. */
  watch(path: string, onChange: () => void): () => void {
    let callbacks = this.watchers.get(path);
    if (!callbacks) {
      callbacks = new Set();
      this.watchers.set(path, callbacks);
    }
    callbacks.add(onChange);
    return () => {
      callbacks?.delete(onChange);
      if (callbacks?.size === 0) this.watchers.delete(path);
    };
  }

  private call<M extends FsMethod>(
    method: M,
    args: FsRequestArgs[M],
  ): Promise<FsResult[M]> {
    const id = `fs-${++nextId}`;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.vscode.postMessage({ source: "mqpad-fs-request", id, method, args });
    });
  }

  async initialize(): Promise<void> {
    // The extension host's filesystem is already available; nothing to set up.
  }

  listFiles(path?: string) {
    return this.call("listFiles", { path });
  }

  readFile(path: string) {
    return this.call("readFile", { path });
  }

  writeFile(path: string, content: string) {
    return this.call("writeFile", { path, content });
  }

  deleteFile(path: string) {
    return this.call("deleteFile", { path });
  }

  createDirectory(path: string) {
    return this.call("createDirectory", { path });
  }

  deleteDirectory(path: string) {
    return this.call("deleteDirectory", { path });
  }

  renameFile(oldPath: string, newPath: string) {
    return this.call("renameFile", { oldPath, newPath });
  }

  fileExists(path: string) {
    return this.call("fileExists", { path });
  }

  isDirectoryPath(path: string) {
    return this.call("isDirectoryPath", { path });
  }
}
