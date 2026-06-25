# mqpad

A WYSIWYG Markdown editor with Obsidian-style links and live [mq](https://github.com/harehare/mq) query blocks, right inside VS Code.

mqpad opens your notes in a webview-based editor with two signature behaviors:

- **Obsidian-style links** — type `[[Some Note]]` and the target file is created immediately (if it doesn't exist) and turned into a clickable link.
- **Live `mq` code blocks** — a ` ```mq ` block runs its query against the document's current markdown and writes the result straight back into the note (as an adjacent ` ```mq-result ` fence, so it stays plain, diffable Markdown and round-trips on reopen). Blocks re-evaluate live as the rest of the document changes, not just when you leave the block.

File I/O goes through `vscode.workspace.fs`, so notes are regular files in your workspace — no separate vault storage to sync.

## Usage

- **`mqpad: Open`** (command palette) — opens the mqpad panel rooted at the configured vault folder (see Settings below).
- **`Open in mqpad`** (Explorer context menu, on `.md`/`.markdown` files) — opens that file directly in the mqpad custom editor, even without a vault configured.

## Features

- Slash commands (`/`) for headings, lists, tables, blockquotes, code blocks, Mermaid diagrams, math blocks, and `mq` query blocks.
- A formatting toolbar and command palette (`Cmd/Ctrl+K`) for file/folder creation, mode toggles, and theming.
- Markdown source mode (`Cmd/Ctrl+Shift+M`) and focus mode (`Cmd/Ctrl+Shift+Enter`).
- GFM tables, task lists, Mermaid diagrams, KaTeX math, and a frontmatter editor.
- A collapsible folder tree (Markdown files only) with drag-and-drop and pinned notes.
- 16 themes, plus typography/page-width/text-direction settings.
- **External change detection** — if a note changes on disk while open (an AI CLI agent, another editor, `git pull`, …), mqpad reloads it automatically when there are no unsaved edits, or prompts you to reload-from-disk/keep-your-edits when there are.

## Settings

- **`mqpad.vaultPath`** — folder mqpad treats as its vault root, relative to the workspace folder. Empty means the workspace root.

## Learn more

See the [mqpad repository](https://github.com/harehare/mqpad) for the full feature list, screenshots, and the shared editor's architecture across the web app and this extension.

## License

MIT — see [LICENSE](LICENSE).

