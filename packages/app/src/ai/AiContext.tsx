import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getChromeAiAvailability, runChromeAiCompletion, type AiCompletionParams } from "./client";
import type { AiAvailability } from "./types";

export type Ai = {
  availability: AiAvailability;
  /** True for "available" or "downloadable" - both are clickable (a "downloadable" click triggers the one-time on-device model download). */
  configured: boolean;
  complete(params: AiCompletionParams, onDownloadProgress?: (fraction: number) => void): Promise<string>;
};

const AiContext = createContext<Ai | null>(null);

export function AiProvider({ children }: { children: React.ReactNode }) {
  const [availability, setAvailability] = useState<AiAvailability>("unavailable");

  useEffect(() => {
    let cancelled = false;
    void getChromeAiAvailability().then((result) => {
      if (!cancelled) setAvailability(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<Ai>(
    () => ({
      availability,
      configured: availability === "available" || availability === "downloadable",
      complete: async (params, onDownloadProgress) => {
        const wasDownloadable = availability === "downloadable";
        if (wasDownloadable) setAvailability("downloading");
        try {
          const result = await runChromeAiCompletion(params, onDownloadProgress);
          setAvailability("available");
          return result;
        } catch (err) {
          if (wasDownloadable) setAvailability("downloadable");
          throw err;
        }
      },
    }),
    [availability],
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi(): Ai {
  const ai = useContext(AiContext);
  if (!ai) throw new Error("useAi must be used within an AiProvider");
  return ai;
}
