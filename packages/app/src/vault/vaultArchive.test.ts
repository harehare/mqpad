import { beforeEach, describe, expect, it } from "vitest";
import { installMockOpfs } from "../testUtils/mockOpfs";
import { OPFSFileSystem } from "../fs/opfs";
import { exportVaultZip, importVaultZip } from "./vaultArchive";

describe("exportVaultZip / importVaultZip", () => {
  beforeEach(() => {
    installMockOpfs();
  });

  it("round-trips every markdown file, including nested folders, into a fresh vault", async () => {
    const source = new OPFSFileSystem("source");
    await source.initialize();
    await source.writeFile("/note.md", "# Hello");
    await source.writeFile("/folder/nested.md", "nested content");

    const zipData = await exportVaultZip(source);

    const dest = new OPFSFileSystem("dest");
    await dest.initialize();
    const count = await importVaultZip(dest, zipData);

    expect(count).toBe(2);
    expect(await dest.readFile("/note.md")).toBe("# Hello");
    expect(await dest.readFile("/folder/nested.md")).toBe("nested content");
  });

  it("skips non-markdown entries on import", async () => {
    const source = new OPFSFileSystem("source");
    await source.initialize();
    await source.writeFile("/note.md", "content");

    const zipData = await exportVaultZip(source);

    const dest = new OPFSFileSystem("dest");
    await dest.initialize();
    const count = await importVaultZip(dest, zipData);
    expect(count).toBe(1);
  });

  it("overwrites a file that already exists at the same path", async () => {
    const source = new OPFSFileSystem("source");
    await source.initialize();
    await source.writeFile("/note.md", "new content");
    const zipData = await exportVaultZip(source);

    const dest = new OPFSFileSystem("dest");
    await dest.initialize();
    await dest.writeFile("/note.md", "old content");

    await importVaultZip(dest, zipData);
    expect(await dest.readFile("/note.md")).toBe("new content");
  });
});
