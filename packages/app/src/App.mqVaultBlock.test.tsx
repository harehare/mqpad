import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { OPFSFileSystem } from "./fs/opfs";
import type { MqRunner } from "./mq/MqRunnerContext";
import { installMockOpfs } from "./testUtils/mockOpfs";

function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, "value")!;
  desc.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("mq vault-scope code block", () => {
  it("runs the query against every note in the vault and links each result back to its note", async () => {
    const fs = new OPFSFileSystem("vault");
    installMockOpfs();
    await fs.initialize();
    await fs.writeFile("/note.md", "# Hello\n\nBody.\n\n```mq-vault\n```");
    await fs.writeFile("/other.md", "# Other note");

    const mqRunner: MqRunner = {
      run: async (_query, content) => (content.includes("Hello") ? "FROM-NOTE" : "FROM-OTHER"),
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <App fs={fs} mqRunner={mqRunner} vaultRootLabel="vault" vaultRoot="vault" onVaultRootChange={() => {}} />,
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

    // The vault-scope block created via the ```mq-vault input rule opens
    // straight into edit mode, with "Vault" already the active scope.
    const textarea = container.querySelector(".mqpad-mq-block-query") as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    const scopeButtons = container.querySelectorAll(".mqpad-mq-block-scope-toggle button");
    expect(Array.from(scopeButtons).find((b) => b.textContent === "Vault")?.className).toContain("active");

    for (const ch of [".", "h", "1"]) {
      await act(async () => {
        setNativeValue(textarea, textarea.value + ch);
      });
    }
    await act(async () => {
      textarea.focus();
    });
    await act(async () => {
      textarea.blur();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const resultText = container.querySelector(".mqpad-mq-block-result")?.textContent ?? "";
    expect(resultText).toContain("FROM-NOTE");
    expect(resultText).toContain("FROM-OTHER");
    expect(resultText).toContain("note");
    expect(resultText).toContain("other");
    expect(container.querySelector(".mqpad-mq-block-scope")?.textContent).toBe("vault");
  });
});
