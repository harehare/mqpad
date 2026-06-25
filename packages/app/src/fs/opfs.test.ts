import { beforeEach, describe, expect, it } from "vitest";
import { installMockOpfs } from "../testUtils/mockOpfs";
import { OPFSFileSystem } from "./opfs";

describe("OPFSFileSystem", () => {
  beforeEach(() => {
    installMockOpfs();
  });

  it("writes and reads a file", async () => {
    const fs = new OPFSFileSystem("vault");
    await fs.initialize();
    await fs.writeFile("/note.md", "hello");
    expect(await fs.readFile("/note.md")).toBe("hello");
    expect(await fs.fileExists("/note.md")).toBe(true);
  });

  it("creates nested directories implicitly when writing", async () => {
    const fs = new OPFSFileSystem("vault");
    await fs.initialize();
    await fs.writeFile("/folder/a.md", "A");
    expect(await fs.isDirectoryPath("/folder")).toBe(true);

    const files = await fs.listFiles("/");
    expect(files).toEqual([{ name: "folder", path: "/folder", type: "directory", children: [
      { name: "a.md", path: "/folder/a.md", type: "file" },
    ] }]);
  });

  it("lists only markdown files but keeps every directory", async () => {
    const fs = new OPFSFileSystem("vault");
    await fs.initialize();
    await fs.writeFile("/note.md", "hello");
    await fs.writeFile("/image.png", "binary");
    await fs.writeFile("/assets/logo.png", "binary");
    await fs.writeFile("/docs/guide.md", "guide");

    const files = await fs.listFiles("/");
    expect(files).toEqual([
      { name: "assets", path: "/assets", type: "directory", children: [] },
      { name: "docs", path: "/docs", type: "directory", children: [
        { name: "guide.md", path: "/docs/guide.md", type: "file" },
      ] },
      { name: "note.md", path: "/note.md", type: "file" },
    ]);
  });

  it("renames (moves) a file", async () => {
    const fs = new OPFSFileSystem("vault");
    await fs.initialize();
    await fs.writeFile("/note.md", "hello");
    await fs.renameFile("/note.md", "/renamed.md");

    expect(await fs.fileExists("/note.md")).toBe(false);
    expect(await fs.readFile("/renamed.md")).toBe("hello");
  });

  it("deletes a file", async () => {
    const fs = new OPFSFileSystem("vault");
    await fs.initialize();
    await fs.writeFile("/note.md", "hello");
    await fs.deleteFile("/note.md");
    expect(await fs.fileExists("/note.md")).toBe(false);
  });

  it("recursively renames a directory", async () => {
    const fs = new OPFSFileSystem("vault");
    await fs.initialize();
    await fs.writeFile("/folder/a.md", "A");
    await fs.writeFile("/folder/b.md", "B");
    await fs.renameFile("/folder", "/moved");

    expect(await fs.isDirectoryPath("/folder")).toBe(false);
    expect(await fs.readFile("/moved/a.md")).toBe("A");
    expect(await fs.readFile("/moved/b.md")).toBe("B");
  });
});
