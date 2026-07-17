<div align="center">
  <img src="assets/logo.svg" width="96" height="96" alt="mqpad logo" />

  <h1>mqpad</h1>

  **A WYSIWYG Markdown editor with live <a href="https://github.com/harehare/mq">mq</a> queries built in.**

  <p>
    <a href="https://github.com/harehare/mqpad/actions/workflows/ci.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/harehare/mqpad/ci.yml?style=flat-square&logo=github-actions&label=ci" alt="CI" />
    </a>
    <a href="https://marketplace.visualstudio.com/items?itemName=harehare.mqpad-vscode-extension">
      <img src="https://img.shields.io/badge/VS%20Code-Marketplace-007ACC?style=flat-square&logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace" />
    </a>
    <a href="https://open-vsx.org/extension/harehare/mqpad-vscode-extension">
      <img src="https://img.shields.io/open-vsx/v/harehare/mqpad-vscode-extension?style=flat-square&logo=eclipseide" alt="Open VSX Version" />
    </a>
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License: MIT" />
    </a>
  </p>
</div>

<p align="center">
  <img src="assets/demo.gif" width="720" alt="mqpad demo: WYSIWYG editing, task lists, slash commands, and a live mq query block" />
</p>

mqpad is a Markdown editor with two signature behaviors:

- **Obsidian-style links** — type `[[Some Note]]` and the target file is created immediately (if it doesn't exist) and turned into a clickable link.
- **Live `mq` code blocks** — a ` ```mq ` block runs its query against the document's current markdown and writes the result straight back into the note (as an adjacent ` ```mq-result ` fence, so it stays plain, diffable Markdown and round-trips on reopen). Blocks re-evaluate live as the rest of the document changes, not just when you leave the block.

It ships as both a standalone web app (storage in the browser's [OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)) and a VS Code extension (storage on disk via `vscode.workspace.fs`), sharing one editor UI.

## Features

### Editing

- **WikiLinks** — `[[Title]]` / `[[Title|Alias]]`, converted on typing, pasting, or IME input alike.
- **Slash commands** — type `/` for a quick-insert menu: headings, bullet/numbered/task lists, tables, blockquote, code block, Mermaid diagram, math block, an `mq` query block, and a horizontal rule.
- **Formatting toolbar** — bold, italic, underline, strikethrough, headings, lists, task lists, tables, blockquote, code block, links.
- **Command palette** (`Cmd/Ctrl+K`) — new file/folder, mode toggles, theme switching, and more, fuzzy-searchable.
- **Markdown source mode** (`Cmd/Ctrl+Shift+M`) — toggle to the raw Markdown text and back without losing your place.
- **Focus mode** (`Cmd/Ctrl+Shift+Enter`) — fades the sidebar and toolbar for distraction-free writing; hovering brings them back.
- **Preview mode** — open any `.md` file directly via drag-and-drop onto the window, or the OS's "Open With" menu, with no notes folder/vault set up first.

### Markdown power features

- **Live `mq` blocks** — evaluate against the whole document and re-run automatically as it changes; the result renders the same way the document itself would (headings, lists, tables, links, …), not as raw text.
- **Vault-wide `mq` blocks** — a ` ```mq-vault ` block (or the "Vault" toggle on any `mq` block) runs its query once per note across the whole vault and combines the non-empty results, each linked back to its note with a `[[WikiLink]]` — a Dataview-style dashboard using the same query language, re-evaluating live as other notes are saved. The query console has a matching "Whole vault" toggle for ad hoc cross-vault queries.
- **Query console** — run an ad hoc `mq` query against the whole document (or the whole vault) without inserting anything into the note.
- **Tables** — GFM pipe tables, edited in place (Tab between cells, toolbar/slash-command insert, add/remove rows and columns, toggle header row, column resizing).
- **Task lists** — `- [ ]` / `- [x]`, with a clickable checkbox that strikes through completed items in the editor; round-trips through Markdown.
- **Mermaid diagrams** — ` ```mermaid ` fences render live below the source as you type.
- **KaTeX math** — block `$$...$$` equations render live.
- **Frontmatter editor** — a collapsible panel above the toolbar exposes the document's leading `---` YAML block as form fields instead of raw text. Each field gets a type-appropriate input (text, number, checkbox, or a tag list for arrays); add/remove fields freely and they round-trip straight back into the YAML block on save.
- **Syntax highlighting** — fenced code blocks (with line numbers) and `mq` query blocks, via [Shiki](https://shiki.style) and `mq`'s own grammar.

### AI (Chrome's built-in on-device model, no key required)

Two AI features use [Chrome's built-in Prompt API](https://developer.chrome.com/docs/ai/prompt-api) (Gemini Nano, running entirely on-device) instead of a cloud provider — no API key, no account, no backend call. They're only available in Chrome (desktop, with sufficient disk/GPU for the on-device model); the "Ask AI" buttons are simply disabled everywhere else, including the VS Code extension. Neither feature ever edits your note silently — every AI output lands somewhere you review before it takes effect.

- **AI-drafted `mq` queries** — inside any `mq` block, click the sparkle button and describe what you want ("list headings that mention TODO") in plain language. The draft lands in the query box for you to review and edit; it never runs on its own — you still trigger evaluation the normal way (click away from the block).
- **Ask AI on a selection** — select text and use the toolbar's sparkle button for quick actions (fix grammar, improve writing, shorten, expand) or a free-text instruction. The suggestion is shown as an inline word-level diff against your original text — nothing is applied until you hit Accept.
- The first use in a browser profile downloads Chrome's on-device model (a few GB); the button shows download progress and becomes a normal "Generate" once it's cached.

### Organization

- **Folders** — opt-in collapsible folder tree, with drag-and-drop to move notes and folders around.
- **Markdown-only file tree** — the tree lists `.md`/`.markdown` files only; other files in the vault (images, assets, …) are hidden. Folders are always shown, even ones that end up with nothing markdown inside.
- **Pinned notes** — pin a note from the file tree to keep it at the top of its folder, persisted in `localStorage`.
- **External change detection** (VS Code extension only) — if a note changes on disk while it's open (an AI CLI agent, another editor, `git pull`, …), mqpad reloads it automatically when there are no unsaved edits, or shows a banner to reload-from-disk/keep-your-edits when there are. The web app has no real filesystem to watch (OPFS vault notes aren't reachable from outside the browser, and polling a dropped file's handle isn't worth the cost), so this doesn't apply there.
- **Status bar** — file path, save state, cursor position, word/character count.
- **URL-synced files** (web) — the open file is reflected in the URL, so reload and browser back/forward land on the same note.

### Look & feel

- **16 themes** — Tarn, Ember, Nord, Dracula, Solarized, Gruvbox, One Dark, Monokai, Tokyo Night, Catppuccin, Rosé Pine, GitHub, and Ayu, switchable from Settings.
- **Typography, page width, and text direction** — serif/sans-serif/monospace prose font, four page widths (narrow to full-width), and left-to-right or right-to-left text direction.

## Packages

- `packages/app` — the shared React + [Tiptap](https://tiptap.dev/) editor UI: file explorer, tabs, the WikiLink/MqCodeBlock extensions, syntax highlighting, and a `FileSystem` interface with backends for OPFS (`OPFSFileSystem`), the VS Code webview bridge (`BridgeFileSystem`), and a single dropped/opened file (`SingleFileFileSystem`, used by preview mode).
- `packages/web` — Vite app that boots `app` with `OPFSFileSystem` + [`mq-web`](https://www.npmjs.com/package/mq-web) (wasm). Installable as a PWA.
- `packages/vscode-extension` — VS Code extension. The webview loads the same `app` UI (also backed by `mq-web`, since wasm runs fine in a webview); the extension host only handles file I/O (`vscode.workspace.fs`), filesystem watching, and panel lifecycle over a small postMessage protocol.

## Develop

```sh
pnpm install

# Web app (browser-testable at http://localhost:5173)
pnpm dev:web

# VS Code extension: open this folder in VS Code, then press F5
# (runs the "mqpad: build extension" task, then launches an Extension
# Development Host - run the "mqpad: Open" command there)
```

Run tests/typecheck/lint across every package with `pnpm test` / `pnpm type-check` / `pnpm lint` (or `--filter <package>` for just one).

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+K` | Open the command palette |
| `Cmd/Ctrl+Shift+M` | Toggle Markdown source mode |
| `Cmd/Ctrl+Shift+Enter` | Toggle focus mode |
| `[[` | Start a WikiLink, with autocomplete |
| `/` | Open the slash command menu |
| `Tab` (in a table) | Move to the next cell |

## Settings

- **Theme**: one of 16 built-in themes, picked from the in-app Settings dialog (persisted in `localStorage`, applies immediately).
- **Typography**: serif, sans-serif, or monospace prose font.
- **Page width**: narrow, medium, wide, or full-width.
- **Text direction**: left-to-right or right-to-left.
- **Vault root** — Web: the OPFS vault folder name, changeable from Settings (persisted in `localStorage`, takes effect on reload). VS Code: the `mqpad.vaultPath` setting (relative to the workspace folder; empty means the workspace root) - the in-app Settings dialog opens VS Code's native settings UI for it.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
