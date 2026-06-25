import * as fs from "node:fs";
import * as vscode from "vscode";
import { isFsRequestMessage } from "mqpad-app/src/fs/bridgeProtocol";
import { handleFsRequest } from "./fsHandler";

function isOpenSettingsMessage(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && (value as { source?: unknown }).source === "mqpad-open-settings"
  );
}

function getVaultUri(): vscode.Uri {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error("mqpad requires an open workspace folder");
  }
  const root = folders[0]?.uri;
  if (!root) throw new Error("mqpad requires an open workspace folder");
  const vaultPath = vscode.workspace.getConfiguration("mqpad").get<string>("vaultPath", "");
  return vaultPath ? vscode.Uri.joinPath(root, vaultPath) : root;
}

function buildWebviewHtml(webview: vscode.Webview, context: vscode.ExtensionContext, initialPath?: string): string {
  const distWebviewUri = vscode.Uri.joinPath(context.extensionUri, "dist", "webview");
  const indexPath = vscode.Uri.joinPath(distWebviewUri, "index.html").fsPath;
  const raw = fs.readFileSync(indexPath, "utf8");
  const base = webview.asWebviewUri(distWebviewUri).toString();

  const withAssets = raw.replace(/(src|href)="\.\/(.*?)"/g, (_match, attr: string, assetPath: string) => {
    return `${attr}="${base}/${assetPath}"`;
  });

  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource} 'wasm-unsafe-eval'`,
    `connect-src ${webview.cspSource} https:`,
  ].join("; ");

  const initialPathScript = initialPath
    ? `\n    <script>window.__mqpadInitialPath = ${JSON.stringify(initialPath)};</script>`
    : "";

  return withAssets.replace(
    "<head>",
    `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">${initialPathScript}`,
  );
}

function openMqpadPanel(context: vscode.ExtensionContext): void {
  const vaultUri = getVaultUri();
  const panel = vscode.window.createWebviewPanel("mqpad", "mqpad", vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "webview")],
  });

  panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "icon.png");
  panel.webview.html = buildWebviewHtml(panel.webview, context);

  panel.webview.onDidReceiveMessage((message: unknown) => {
    if (isFsRequestMessage(message)) {
      void handleFsRequest(panel.webview, message, vaultUri);
      return;
    }
    if (isOpenSettingsMessage(message)) {
      void vscode.commands.executeCommand("workbench.action.openSettings", "mqpad.vaultPath");
    }
  });

  const watcher = watchVaultForExternalChanges(vaultUri, panel.webview);
  panel.onDidDispose(() => watcher.dispose());
}

function basename(uri: vscode.Uri): string {
  return uri.path.slice(uri.path.lastIndexOf("/") + 1);
}

function toVaultPath(vaultUri: vscode.Uri, fileUri: vscode.Uri): string {
  const relative = fileUri.path.slice(vaultUri.path.length);
  return relative.startsWith("/") ? relative : `/${relative}`;
}

/**
 * Pushes a `mqpad-file-changed` message whenever a file inside the vault is
 * modified on disk - by an AI CLI agent, another editor, `git pull`, etc.
 * mqpad's own `writeFile` calls also land here, but the webview no-ops on
 * those since the content it reads back matches what it already has.
 */
function watchVaultForExternalChanges(vaultUri: vscode.Uri, webview: vscode.Webview): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vaultUri, "**/*"));
  watcher.onDidChange((uri) => {
    void webview.postMessage({ source: "mqpad-file-changed", path: toVaultPath(vaultUri, uri) });
  });
  return watcher;
}

/**
 * Lets a `.md` file be opened directly via the editor's "Open With..." menu,
 * without a `mqpad.vaultPath` workspace already configured - the file's own
 * parent directory becomes the vault for that panel, and it opens straight
 * into the picked file (see `__mqpadInitialPath` in webview/main.tsx).
 */
class MqpadPreviewEditorProvider implements vscode.CustomTextEditorProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    const vaultUri = vscode.Uri.joinPath(document.uri, "..");
    const initialPath = `/${basename(document.uri)}`;

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview")],
    };
    panel.webview.html = buildWebviewHtml(panel.webview, this.context, initialPath);

    panel.webview.onDidReceiveMessage((message: unknown) => {
      if (isFsRequestMessage(message)) {
        void handleFsRequest(panel.webview, message, vaultUri);
        return;
      }
      if (isOpenSettingsMessage(message)) {
        void vscode.commands.executeCommand("workbench.action.openSettings", "mqpad.vaultPath");
      }
    });

    // No vault-wide FileSystemWatcher here: VS Code already tracks this single
    // file as a TextDocument and reloads it on external disk changes, firing
    // this event (including for changes made while this panel had focus).
    const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        void panel.webview.postMessage({ source: "mqpad-file-changed", path: initialPath });
      }
    });
    panel.onDidDispose(() => changeSub.dispose());
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("mqpad.open", () => {
      try {
        openMqpadPanel(context);
      } catch (error) {
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    // Invoked from the Explorer's "Open in mqpad" context menu entry - opens
    // the picked file straight in the mqpad.preview custom editor, without
    // the user having to go through "Open With...".
    vscode.commands.registerCommand("mqpad.openFile", (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target) return;
      void vscode.commands.executeCommand("vscode.openWith", target, "mqpad.preview");
    }),
    vscode.window.registerCustomEditorProvider("mqpad.preview", new MqpadPreviewEditorProvider(context), {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
}

export function deactivate(): void {}
