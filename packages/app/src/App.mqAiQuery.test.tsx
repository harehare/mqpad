import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { OPFSFileSystem } from "./fs/opfs";
import type { MqRunner } from "./mq/MqRunnerContext";
import { installMockLanguageModel, uninstallMockLanguageModel } from "./testUtils/mockLanguageModel";
import { installMockOpfs } from "./testUtils/mockOpfs";

describe("AI-assisted mq query generation", () => {
  afterEach(() => {
    uninstallMockLanguageModel();
  });

  it("drafts a query from an instruction via Chrome's built-in AI, without running it", async () => {
    const { promptMock } = installMockLanguageModel({ response: ".h1" });

    const fs = new OPFSFileSystem("vault");
    installMockOpfs();
    await fs.initialize();
    await fs.writeFile("/note.md", "# Hello\n\nBody.\n\n```mq\n```");

    const mqRunner: MqRunner = { run: vi.fn(async () => "should not run") };

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

    const aiButton = container.querySelector(".mqpad-mq-block-ai-btn") as HTMLButtonElement;
    expect(aiButton.disabled).toBe(false);
    await act(async () => {
      aiButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const instructionInput = container.querySelector(".mqpad-mq-block-ai-popover input") as HTMLInputElement;
    expect(instructionInput).toBeTruthy();

    const proto = Object.getPrototypeOf(instructionInput);
    const desc = Object.getOwnPropertyDescriptor(proto, "value")!;
    await act(async () => {
      desc.set!.call(instructionInput, "headings only");
      instructionInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const generateButton = Array.from(container.querySelectorAll(".mqpad-mq-block-ai-popover button")).find(
      (b) => b.textContent === "Generate",
    ) as HTMLButtonElement;
    await act(async () => {
      generateButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(promptMock).toHaveBeenCalledTimes(1);
    const textarea = container.querySelector(".mqpad-mq-block-query") as HTMLTextAreaElement;
    expect(textarea.value).toBe(".h1");
    // The generated query is only drafted, never auto-run - the block is
    // still in edit mode and the mq runner was never invoked.
    expect(container.querySelector(".mqpad-mq-block-ai-popover")).toBeNull();
    expect(mqRunner.run).not.toHaveBeenCalled();
  });

  it("disables the Ask AI button when Chrome's built-in AI isn't available", async () => {
    installMockLanguageModel({ availability: "unavailable" });

    const fs = new OPFSFileSystem("vault");
    installMockOpfs();
    await fs.initialize();
    await fs.writeFile("/note.md", "# Hello\n\nBody.\n\n```mq\n```");

    const mqRunner: MqRunner = { run: vi.fn(async () => "") };
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

    const aiButton = container.querySelector(".mqpad-mq-block-ai-btn") as HTMLButtonElement;
    expect(aiButton.disabled).toBe(true);
    expect(aiButton.title).toContain("Chrome's built-in AI");
  });
});
