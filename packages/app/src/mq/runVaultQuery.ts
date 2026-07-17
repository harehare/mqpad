import type { VaultFile } from "./VaultIndexContext";
import type { MqRunner } from "./MqRunnerContext";

/**
 * Runs `query` against every file in the vault (one `mq` evaluation per
 * file, queued through the same runner used for document-scope blocks) and
 * concatenates the non-empty outputs, each headed by a `[[title]]` WikiLink
 * back to the note it came from - so a vault-scope block reads like a
 * dashboard of linked results rather than one undifferentiated blob.
 */
export async function runVaultQuery(runner: MqRunner, query: string, files: VaultFile[]): Promise<string> {
  const sections: string[] = [];
  for (const file of files) {
    const output = (await runner.run(query, file.content)).trim();
    if (!output) continue;
    sections.push(`**[[${file.title}]]**\n\n${output}`);
  }
  return sections.join("\n\n---\n\n");
}
