import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import type { FileNode, FileSystem } from "./fs/types";
import type { MqRunner } from "./mq/MqRunnerContext";

function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, "value")!;
  desc.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Minimal in-memory FileSystem whose `watch` can be triggered manually, to
 * simulate a file changing on disk for a reason other than mqpad's own
 * writeFile (an AI CLI agent, another editor, etc). */
class FakeFileSystem implements FileSystem {
  private readonly files = new Map<string, string>();
  private readonly watchers = new Map<string, Set<() => void>>();

  constructor(initial: Record<string, string>) {
    for (const [path, content] of Object.entries(initial)) this.files.set(path, content);
  }

  async initialize(): Promise<void> {}

  async listFiles(): Promise<FileNode[]> {
    return Array.from(this.files.keys()).map((path) => ({ name: path.slice(1), path, type: "file" as const }));
  }

  async readFile(path: string): Promise<string> {
    return this.files.get(path) ?? "";
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  async createDirectory(): Promise<void> {}
  async deleteDirectory(): Promise<void> {}

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    this.files.set(newPath, this.files.get(oldPath) ?? "");
    this.files.delete(oldPath);
  }

  async fileExists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async isDirectoryPath(): Promise<boolean> {
    return false;
  }

  watch(path: string, onChange: () => void): () => void {
    let set = this.watchers.get(path);
    if (!set) {
      set = new Set();
      this.watchers.set(path, set);
    }
    set.add(onChange);
    return () => set?.delete(onChange);
  }

  /** Bypasses writeFile's own bookkeeping, like a real external write would. */
  externalWrite(path: string, content: string): void {
    this.files.set(path, content);
    for (const cb of this.watchers.get(path) ?? []) cb();
  }
}

const noopMqRunner: MqRunner = { run: async () => "" };

async function mountAndOpenNote(fs: FileSystem) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <App fs={fs} mqRunner={noopMqRunner} vaultRootLabel="vault" vaultRoot="vault" onVaultRootChange={() => {}} />,
    );
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

  const fileItem = Array.from(container.querySelectorAll(".file-tree-name")).find(
    (el) => el.textContent === "note.md",
  );
  await act(async () => {
    fileItem!.closest(".file-tree-item")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

  // Switch to source mode (Cmd+Shift+M) so the document body is a plain,
  // directly assertable textarea instead of Tiptap's rendered DOM.
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "m", metaKey: true, shiftKey: true, bubbles: true }));
  });

  return container;
}

describe("external file change detection", () => {
  it("silently reloads when the file changes on disk and there are no local edits", async () => {
    const fs = new FakeFileSystem({ "/note.md": "Original" });
    const container = await mountAndOpenNote(fs);

    await act(async () => {
      fs.externalWrite("/note.md", "Changed externally");
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect((container.querySelector(".mqpad-source-view") as HTMLTextAreaElement).value).toBe("Changed externally");
    expect(container.querySelector(".file-changed-banner")?.textContent).toContain("Reloaded");
    expect(container.querySelector(".file-changed-banner-button")).toBeNull();
  });

  it("flags a conflict instead of clobbering unsaved local edits", async () => {
    const fs = new FakeFileSystem({ "/note.md": "Original" });
    const container = await mountAndOpenNote(fs);

    const textarea = container.querySelector(".mqpad-source-view") as HTMLTextAreaElement;
    await act(async () => {
      setNativeValue(textarea, "My local edit");
    });

    await act(async () => {
      fs.externalWrite("/note.md", "Changed externally");
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Local edit is preserved, not overwritten, while the conflict is unresolved.
    expect(textarea.value).toBe("My local edit");
    const banner = container.querySelector(".file-changed-banner");
    expect(banner).toBeTruthy();
    const buttons = Array.from(container.querySelectorAll(".file-changed-banner-button"));
    expect(buttons.map((b) => b.textContent)).toEqual(["Reload from disk", "Keep my edits"]);

    // "Reload from disk" discards the local edit in favor of what's on disk.
    await act(async () => {
      (buttons[0] as HTMLButtonElement).click();
    });
    expect(textarea.value).toBe("Changed externally");
    expect(container.querySelector(".file-changed-banner-button")).toBeNull();
  });

  it("keeps local edits when the user dismisses the conflict via 'Keep my edits'", async () => {
    const fs = new FakeFileSystem({ "/note.md": "Original" });
    const container = await mountAndOpenNote(fs);

    const textarea = container.querySelector(".mqpad-source-view") as HTMLTextAreaElement;
    await act(async () => {
      setNativeValue(textarea, "My local edit");
    });
    await act(async () => {
      fs.externalWrite("/note.md", "Changed externally");
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const keepMineButton = Array.from(container.querySelectorAll(".file-changed-banner-button")).find(
      (b) => b.textContent === "Keep my edits",
    ) as HTMLButtonElement;
    await act(async () => {
      keepMineButton.click();
    });

    expect(textarea.value).toBe("My local edit");
    expect(container.querySelector(".file-changed-banner")).toBeNull();
  });
});
