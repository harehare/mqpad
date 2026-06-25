import type { FileNode } from "./types";

/**
 * postMessage protocol shared between the webview (BridgeFileSystem, the
 * requester) and the VS Code extension host (the handler, backed by
 * vscode.workspace.fs). Both sides import these types so the request/response
 * shapes can't drift apart.
 */
export type FsMethod =
  | "listFiles"
  | "readFile"
  | "writeFile"
  | "deleteFile"
  | "createDirectory"
  | "deleteDirectory"
  | "renameFile"
  | "fileExists"
  | "isDirectoryPath";

export type FsRequestArgs = {
  listFiles: { path?: string };
  readFile: { path: string };
  writeFile: { path: string; content: string };
  deleteFile: { path: string };
  createDirectory: { path: string };
  deleteDirectory: { path: string };
  renameFile: { oldPath: string; newPath: string };
  fileExists: { path: string };
  isDirectoryPath: { path: string };
};

export type FsResult = {
  listFiles: FileNode[];
  readFile: string;
  writeFile: void;
  deleteFile: void;
  createDirectory: void;
  deleteDirectory: void;
  renameFile: void;
  fileExists: boolean;
  isDirectoryPath: boolean;
};

// A distributive mapped type, so each member keeps a literal `method`,
// making `message.method` a valid discriminant for narrowing `message.args`.
export type FsRequestMessage = {
  [M in FsMethod]: {
    source: "mqpad-fs-request";
    id: string;
    method: M;
    args: FsRequestArgs[M];
  };
}[FsMethod];

export type FsResponseMessage<M extends FsMethod = FsMethod> =
  | { source: "mqpad-fs-response"; id: string; ok: true; result: FsResult[M] }
  | { source: "mqpad-fs-response"; id: string; ok: false; error: string };

export function isFsRequestMessage(value: unknown): value is FsRequestMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { source?: unknown }).source === "mqpad-fs-request"
  );
}

export function isFsResponseMessage(
  value: unknown,
): value is FsResponseMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { source?: unknown }).source === "mqpad-fs-response"
  );
}

/**
 * Unsolicited push from the extension host to the webview: `path` changed on
 * disk for a reason other than mqpad's own `writeFile` (e.g. an AI CLI agent
 * or another editor touched it). Unlike the request/response messages above,
 * this isn't correlated to any prior request.
 */
export type FsChangeMessage = {
  source: "mqpad-file-changed";
  path: string;
};

export function isFsChangeMessage(value: unknown): value is FsChangeMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { source?: unknown }).source === "mqpad-file-changed"
  );
}
