class MockFileHandle {
  readonly kind = "file" as const;
  content = "";
  constructor(public name: string) {}
  async getFile() {
    const content = this.content;
    return { text: async () => content };
  }
  async createWritable() {
    return {
      write: async (data: string) => {
        this.content = data;
      },
      close: async () => {},
    };
  }
}

class MockDirectoryHandle {
  readonly kind = "directory" as const;
  children = new Map<string, MockFileHandle | MockDirectoryHandle>();
  constructor(public name: string) {}

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDirectoryHandle> {
    let child = this.children.get(name);
    if (!child) {
      if (!opts?.create) throw new Error(`directory not found: ${name}`);
      child = new MockDirectoryHandle(name);
      this.children.set(name, child);
    }
    if (!(child instanceof MockDirectoryHandle)) throw new Error(`not a directory: ${name}`);
    return child;
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    let child = this.children.get(name);
    if (!child) {
      if (!opts?.create) throw new Error(`file not found: ${name}`);
      child = new MockFileHandle(name);
      this.children.set(name, child);
    }
    if (!(child instanceof MockFileHandle)) throw new Error(`not a file: ${name}`);
    return child;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.children.delete(name)) throw new Error(`not found: ${name}`);
  }

  async *values() {
    for (const child of this.children.values()) yield child;
  }
}

/** Stubs `navigator.storage.getDirectory()` with an in-memory OPFS-like tree, for tests. */
export function installMockOpfs(): void {
  const root = new MockDirectoryHandle("");
  Object.defineProperty(globalThis.navigator, "storage", {
    value: { getDirectory: async () => root },
    configurable: true,
  });
}
