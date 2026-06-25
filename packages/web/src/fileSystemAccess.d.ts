// Augments lib.dom.d.ts with the File System Access API surface this app
// uses that TypeScript doesn't ship types for yet. Both are Chromium-only;
// callers feature-detect before use.
interface DataTransferItem {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
}
