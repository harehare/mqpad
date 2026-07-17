/**
 * Mirrors the Chrome built-in AI `Availability` union (see
 * `LanguageModel.availability()` in `@types/dom-chromium-ai`) as our own
 * literal type, so this module doesn't depend on the ambient global type's
 * exact name.
 */
export type AiAvailability = "unavailable" | "downloadable" | "downloading" | "available";

export class AiError extends Error {}
