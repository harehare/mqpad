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

describe("mq code block editing", () => {
  it("runs the full typed query once on blur, not a partial one mid-typing", async () => {
    const fs = new OPFSFileSystem("vault");
    installMockOpfs();
    await fs.initialize();
    await fs.writeFile("/note.md", "# Hello\n\nBody.\n\n```mq\n```");

    const calls: string[] = [];
    const mqRunner: MqRunner = {
      run: async (query) => {
        calls.push(query);
        return `RESULT-FOR(${query})`;
      },
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

    // An empty mq block opens straight into edit mode.
    const textarea = container.querySelector(".mqpad-mq-block-query") as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();

    // Type character by character - this must not trigger a run until the
    // box is actually left, and must not blur itself mid-typing.
    for (const ch of [".", "h", "1"]) {
      await act(async () => {
        setNativeValue(textarea, textarea.value + ch);
      });
    }
    expect(container.querySelector(".mqpad-mq-block-query")).toBeTruthy();
    expect(calls).toEqual([]);

    await act(async () => {
      textarea.focus();
    });
    await act(async () => {
      textarea.blur();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(calls).toEqual([".h1"]);
    expect(container.querySelector(".mqpad-mq-block-result")?.textContent).toBe("RESULT-FOR(.h1)");
  });

  it("re-evaluates a settled block once the document changes elsewhere, without looping", async () => {
    const fs = new OPFSFileSystem("vault");
    installMockOpfs();
    await fs.initialize();
    // Block A is already evaluated (query + cached result), so it loads
    // straight into preview mode. Block B is a fresh empty block, which
    // opens directly into edit mode - typing into it is a real document
    // change "elsewhere" that doesn't touch block A's own attributes.
    await fs.writeFile(
      "/note.md",
      "# Hello\n\nBody.\n\n```mq\n.h1\n```\n\n```mq-result\nHello\n```\n\n```mq\n```",
    );

    let callCount = 0;
    const mqRunner: MqRunner = {
      run: async (_query, content) => {
        callCount++;
        return content.includes("trigger") ? "Updated" : "Hello";
      },
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

    expect(container.querySelector(".mqpad-mq-block-result")?.textContent).toBe("Hello");
    expect(callCount).toBe(0);

    // Block B (the fresh block) is the only one in edit mode right now.
    const textarea = container.querySelector(".mqpad-mq-block-query") as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    for (const ch of ["t", "r", "i", "g", "g", "e", "r"]) {
      await act(async () => {
        setNativeValue(textarea, textarea.value + ch);
      });
    }

    // Block A hasn't been touched directly, but the document changed
    // elsewhere - it should pick that up live, debounced, without anyone
    // blurring or clicking into it.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });

    expect(container.querySelector(".mqpad-mq-block-result")?.textContent).toBe("Updated");
    const callsAfterUpdate = callCount;

    // Confirm it settles rather than looping: waiting longer shouldn't
    // produce further runs once the result has converged.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    expect(callCount).toBe(callsAfterUpdate);
  });
});
