import { vi, type Mock } from "vitest";

type MonitorCallback = (monitor: { addEventListener: (type: string, cb: (e: { loaded: number }) => void) => void }) => void;

type MockLanguageModelOptions = {
  availability?: "unavailable" | "downloadable" | "downloading" | "available";
  response?: string | ((user: string) => string);
  /** Fractions (0-1) emitted as `downloadprogress` events during `create()`, simulating a first-use model download. */
  downloadProgress?: number[];
};

/** Installs a fake `LanguageModel` global (Chrome's built-in AI) for tests, mirroring the real Prompt API's create/prompt/destroy shape closely enough to exercise `ai/client.ts`. */
export function installMockLanguageModel(
  options: MockLanguageModelOptions = {},
): { promptMock: Mock; destroyMock: Mock; createMock: Mock } {
  const promptMock = vi.fn(async (user: string) =>
    typeof options.response === "function" ? options.response(user) : (options.response ?? "mock response"),
  );
  const destroyMock = vi.fn();
  const createMock = vi.fn(async (createOptions?: { monitor?: MonitorCallback }) => {
    if (options.downloadProgress && createOptions?.monitor) {
      const listeners: Record<string, (e: { loaded: number }) => void> = {};
      createOptions.monitor({
        addEventListener: (type, cb) => {
          listeners[type] = cb;
        },
      });
      for (const loaded of options.downloadProgress) {
        listeners.downloadprogress?.({ loaded });
      }
    }
    return { prompt: promptMock, destroy: destroyMock };
  });

  (globalThis as unknown as { LanguageModel: unknown }).LanguageModel = {
    availability: vi.fn(async () => options.availability ?? "available"),
    create: createMock,
  };

  return { promptMock, destroyMock, createMock };
}

export function uninstallMockLanguageModel() {
  delete (globalThis as { LanguageModel?: unknown }).LanguageModel;
}
