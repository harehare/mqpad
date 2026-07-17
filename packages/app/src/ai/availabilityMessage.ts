import type { AiAvailability } from "./types";

/** A tooltip explaining why an AI action is or isn't clickable right now, shared by every "Ask AI" entry point. */
export function aiAvailabilityTooltip(availability: AiAvailability, whenReady: string): string {
  switch (availability) {
    case "unavailable":
      return "Requires Chrome's built-in AI (not available in this browser)";
    case "downloading":
      return "Downloading Chrome's on-device AI model…";
    case "downloadable":
      return `${whenReady} (first use downloads Chrome's on-device AI model)`;
    case "available":
      return whenReady;
  }
}
