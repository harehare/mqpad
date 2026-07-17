/// <reference types="dom-chromium-ai" />
import { AiError, type AiAvailability } from "./types";

export type AiCompletionParams = {
  system: string;
  user: string;
};

/** Chrome's built-in on-device AI (the Prompt API, backed by Gemini Nano) - see developer.chrome.com/docs/ai/prompt-api. Not implemented anywhere else. */
export function isChromeAiSupported(): boolean {
  return typeof self !== "undefined" && "LanguageModel" in self;
}

export async function getChromeAiAvailability(): Promise<AiAvailability> {
  if (!isChromeAiSupported()) return "unavailable";
  try {
    return await LanguageModel.availability();
  } catch {
    return "unavailable";
  }
}

/**
 * Runs a one-shot completion against Chrome's on-device model. Each call
 * creates its own session (with `system` as that session's only system
 * prompt) and destroys it afterward, rather than reusing one long-lived
 * session across unrelated requests, which would otherwise accumulate
 * conversation history between e.g. an mq-query prompt and a selection-edit
 * prompt. `onDownloadProgress` only fires when this call is the one that
 * triggers the (one-time) on-device model download.
 */
export async function runChromeAiCompletion(
  { system, user }: AiCompletionParams,
  onDownloadProgress?: (fraction: number) => void,
): Promise<string> {
  if (!isChromeAiSupported()) {
    throw new AiError("Chrome's built-in AI isn't available in this browser");
  }

  let session: LanguageModel;
  try {
    session = await LanguageModel.create({
      initialPrompts: [{ role: "system", content: system }],
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (e) => onDownloadProgress?.(e.loaded));
      },
    });
  } catch (err) {
    throw new AiError(err instanceof Error ? err.message : String(err));
  }

  try {
    return await session.prompt(user);
  } catch (err) {
    throw new AiError(err instanceof Error ? err.message : String(err));
  } finally {
    session.destroy();
  }
}
