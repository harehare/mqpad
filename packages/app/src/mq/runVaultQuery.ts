import type { VaultFile } from "./VaultIndexContext";
import type { MqRunner } from "./MqRunnerContext";

export type VaultQueryResult = { path: string; title: string; output: string };

/** Runs `query` against every file in the vault, one `mq` evaluation per file, returning only the notes with non-empty output. */
export async function runVaultQueryStructured(
  runner: MqRunner,
  query: string,
  files: VaultFile[],
): Promise<VaultQueryResult[]> {
  const results: VaultQueryResult[] = [];
  for (const file of files) {
    const output = (await runner.run(query, file.content)).trim();
    if (!output) continue;
    results.push({ path: file.path, title: file.title, output });
  }
  return results;
}

/**
 * Runs `query` against every file in the vault (one `mq` evaluation per
 * file, queued through the same runner used for document-scope blocks) and
 * concatenates the non-empty outputs, each headed by a `[[title]]` WikiLink
 * back to the note it came from - so a vault-scope block reads like a
 * dashboard of linked results rather than one undifferentiated blob.
 */
export async function runVaultQuery(runner: MqRunner, query: string, files: VaultFile[]): Promise<string> {
  const results = await runVaultQueryStructured(runner, query, files);
  return results.map((r) => `**[[${r.title}]]**\n\n${r.output}`).join("\n\n---\n\n");
}
