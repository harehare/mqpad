import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { FileSystem } from "../fs/types";
import { flattenMarkdownPaths } from "../useNoteIndex";

/**
 * Bundles every markdown file currently in the vault into a zip archive
 * (paths preserved, leading slash stripped since zip entries are relative).
 * Backs the "Export Vault" command - the web app's only storage is the
 * browser's OPFS, which has no built-in backup/export of its own.
 */
export async function exportVaultZip(fs: FileSystem): Promise<Uint8Array> {
  const files = await fs.listFiles("/");
  const paths = flattenMarkdownPaths(files);
  const entries: Record<string, Uint8Array> = {};
  for (const path of paths) {
    const content = await fs.readFile(path).catch(() => null);
    if (content !== null) entries[path.replace(/^\//, "")] = strToU8(content);
  }
  return zipSync(entries);
}

/**
 * Extracts a previously exported (or hand-built) zip archive back into the
 * vault. Writes create any missing parent folders, so archives with nested
 * paths round-trip without a separate mkdir pass. Files that already exist
 * at the same path are overwritten. Returns the number of files written.
 */
export async function importVaultZip(fs: FileSystem, data: Uint8Array): Promise<number> {
  const unzipped = unzipSync(data);
  let count = 0;
  for (const [name, fileData] of Object.entries(unzipped)) {
    if (name.endsWith("/") || !/\.mdx?$/i.test(name)) continue;
    await fs.writeFile(`/${name}`, strFromU8(fileData));
    count++;
  }
  return count;
}
