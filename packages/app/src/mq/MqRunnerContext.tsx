import { createContext, useContext } from "react";

export type MqRunner = {
  run(query: string, content: string): Promise<string>;
};

const MqRunnerContext = createContext<MqRunner | null>(null);

export const MqRunnerProvider = MqRunnerContext.Provider;

export function useMqRunner(): MqRunner {
  const runner = useContext(MqRunnerContext);
  if (!runner) {
    throw new Error("useMqRunner must be used within a MqRunnerProvider");
  }
  return runner;
}
