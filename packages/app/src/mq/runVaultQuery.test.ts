import { describe, expect, it } from "vitest";
import type { MqRunner } from "./MqRunnerContext";
import type { VaultFile } from "./VaultIndexContext";
import { runVaultQuery } from "./runVaultQuery";

describe("runVaultQuery", () => {
  it("runs the query once per file and links each non-empty result back to its note", async () => {
    const files: VaultFile[] = [
      { path: "/a.md", title: "a", content: "# A" },
      { path: "/b.md", title: "b", content: "# B" },
    ];
    const runner: MqRunner = {
      run: async (query, content) => `${query}:${content}`,
    };

    const result = await runVaultQuery(runner, ".h1", files);

    expect(result).toBe("**[[a]]**\n\n.h1:# A\n\n---\n\n**[[b]]**\n\n.h1:# B");
  });

  it("skips files whose output is empty", async () => {
    const files: VaultFile[] = [
      { path: "/a.md", title: "a", content: "# A" },
      { path: "/b.md", title: "b", content: "no heading" },
    ];
    const runner: MqRunner = {
      run: async (_query, content) => (content.startsWith("#") ? content : ""),
    };

    const result = await runVaultQuery(runner, ".h1", files);

    expect(result).toBe("**[[a]]**\n\n# A");
  });

  it("returns an empty string when the vault has no files", async () => {
    const runner: MqRunner = { run: async () => "anything" };
    expect(await runVaultQuery(runner, ".h1", [])).toBe("");
  });
});
