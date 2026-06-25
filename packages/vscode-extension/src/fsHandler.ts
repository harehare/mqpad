import ignore, { type Ignore } from "ignore";
import * as vscode from "vscode";
import type { FileNode } from "mqpad-app/src/fs/types";
import type { FsRequestMessage, FsResponseMessage } from "mqpad-app/src/fs/bridgeProtocol";

function resolveUri(vaultUri: vscode.Uri, path: string): vscode.Uri {
  const parts = path.split("/").filter(Boolean);
  return vscode.Uri.joinPath(vaultUri, ...parts);
}

interface IgnoreScope {
  /** Vault-relative directory this scope's patterns are anchored to, e.g. "/" or "/foo". */
  base: string;
  ig: Ignore;
}

async function loadGitignore(vaultUri: vscode.Uri, dirPath: string): Promise<string | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(resolveUri(vaultUri, `${dirPath}/.gitignore`));
    return decoder.decode(bytes);
  } catch {
    return undefined;
  }
}

/** Collects the `.gitignore` scopes for every ancestor directory of `path`, root first. */
async function buildIgnoreScopes(vaultUri: vscode.Uri, path: string): Promise<IgnoreScope[]> {
  const parts = path.split("/").filter(Boolean);
  const scopes: IgnoreScope[] = [];
  let current = "/";

  for (let i = 0; i <= parts.length; i++) {
    const content = await loadGitignore(vaultUri, current);
    if (content) scopes.push({ base: current, ig: ignore().add(content) });
    if (i < parts.length) current = current === "/" ? `/${parts[i]}` : `${current}/${parts[i]}`;
  }

  return scopes;
}

function isIgnored(scopes: IgnoreScope[], nodePath: string, isDirectory: boolean): boolean {
  return scopes.some(({ base, ig }) => {
    const relative = base === "/" ? nodePath.slice(1) : nodePath.slice(base.length + 1);
    if (!relative) return false;
    return ig.ignores(isDirectory ? `${relative}/` : relative);
  });
}

async function isDirectory(uri: vscode.Uri): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return (stat.type & vscode.FileType.Directory) !== 0;
  } catch {
    return false;
  }
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown)$/i.test(name);
}

function sortNodes(nodes: FileNode[]): FileNode[] {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Unfiltered directory listing, used for actual file operations (e.g. rename/copy). */
async function listAllFiles(vaultUri: vscode.Uri, path: string): Promise<FileNode[]> {
  const dirUri = resolveUri(vaultUri, path);
  const entries = await vscode.workspace.fs.readDirectory(dirUri);
  const nodes: FileNode[] = [];

  for (const [name, type] of entries) {
    const nodePath = path === "/" ? `/${name}` : `${path}/${name}`;
    if (type === vscode.FileType.Directory) {
      nodes.push({ name, path: nodePath, type: "directory", children: await listAllFiles(vaultUri, nodePath) });
    } else {
      nodes.push({ name, path: nodePath, type: "file" });
    }
  }

  return sortNodes(nodes);
}

/**
 * Directory listing for display, excluding `.git`, anything matched by an
 * applicable `.gitignore`, and (for files) anything that isn't markdown.
 * Directories are always kept, even ones with no markdown inside.
 */
async function listFilesFiltered(vaultUri: vscode.Uri, path: string, scopes: IgnoreScope[]): Promise<FileNode[]> {
  const dirUri = resolveUri(vaultUri, path);
  const entries = await vscode.workspace.fs.readDirectory(dirUri);
  const nodes: FileNode[] = [];

  for (const [name, type] of entries) {
    if (name === ".git") continue;
    const nodePath = path === "/" ? `/${name}` : `${path}/${name}`;
    const isDirectory = type === vscode.FileType.Directory;
    if (isIgnored(scopes, nodePath, isDirectory)) continue;
    if (!isDirectory && !isMarkdownFile(name)) continue;

    if (isDirectory) {
      const content = await loadGitignore(vaultUri, nodePath);
      const childScopes = content ? [...scopes, { base: nodePath, ig: ignore().add(content) }] : scopes;
      nodes.push({ name, path: nodePath, type: "directory", children: await listFilesFiltered(vaultUri, nodePath, childScopes) });
    } else {
      nodes.push({ name, path: nodePath, type: "file" });
    }
  }

  return sortNodes(nodes);
}

async function listFiles(vaultUri: vscode.Uri, path: string): Promise<FileNode[]> {
  const scopes = await buildIgnoreScopes(vaultUri, path);
  return listFilesFiltered(vaultUri, path, scopes);
}

async function copyDirectory(vaultUri: vscode.Uri, source: string, dest: string): Promise<void> {
  await vscode.workspace.fs.createDirectory(resolveUri(vaultUri, dest));
  const entries = await listAllFiles(vaultUri, source);
  for (const entry of entries) {
    const relative = entry.path.substring(source.length);
    const destPath = dest + relative;
    if (entry.type === "directory") {
      await copyDirectory(vaultUri, entry.path, destPath);
    } else {
      await vscode.workspace.fs.copy(resolveUri(vaultUri, entry.path), resolveUri(vaultUri, destPath), {
        overwrite: true,
      });
    }
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function dispatch(vaultUri: vscode.Uri, message: FsRequestMessage) {
  switch (message.method) {
    case "listFiles":
      return listFiles(vaultUri, message.args.path ?? "/");
    case "readFile": {
      const bytes = await vscode.workspace.fs.readFile(resolveUri(vaultUri, message.args.path));
      return decoder.decode(bytes);
    }
    case "writeFile":
      await vscode.workspace.fs.writeFile(
        resolveUri(vaultUri, message.args.path),
        encoder.encode(message.args.content),
      );
      return;
    case "deleteFile":
      await vscode.workspace.fs.delete(resolveUri(vaultUri, message.args.path));
      return;
    case "createDirectory":
      await vscode.workspace.fs.createDirectory(resolveUri(vaultUri, message.args.path));
      return;
    case "deleteDirectory":
      await vscode.workspace.fs.delete(resolveUri(vaultUri, message.args.path), { recursive: true });
      return;
    case "renameFile":
      if (await isDirectory(resolveUri(vaultUri, message.args.oldPath))) {
        await copyDirectory(vaultUri, message.args.oldPath, message.args.newPath);
        await vscode.workspace.fs.delete(resolveUri(vaultUri, message.args.oldPath), { recursive: true });
      } else {
        await vscode.workspace.fs.rename(
          resolveUri(vaultUri, message.args.oldPath),
          resolveUri(vaultUri, message.args.newPath),
          { overwrite: true },
        );
      }
      return;
    case "fileExists":
      return exists(resolveUri(vaultUri, message.args.path));
    case "isDirectoryPath":
      return isDirectory(resolveUri(vaultUri, message.args.path));
  }
}

export async function handleFsRequest(
  webview: vscode.Webview,
  message: FsRequestMessage,
  vaultUri: vscode.Uri,
): Promise<void> {
  try {
    const result = await dispatch(vaultUri, message);
    const response: FsResponseMessage = {
      source: "mqpad-fs-response",
      id: message.id,
      ok: true,
      result,
    };
    webview.postMessage(response);
  } catch (error) {
    const response: FsResponseMessage = {
      source: "mqpad-fs-response",
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    webview.postMessage(response);
  }
}
