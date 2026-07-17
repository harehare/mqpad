import { createContext, useContext } from "react";

export type VaultFile = {
  path: string;
  title: string;
  content: string;
};

const VaultIndexContext = createContext<VaultFile[]>([]);

export const VaultIndexProvider = VaultIndexContext.Provider;

/** Every markdown file in the vault, for blocks/consoles that query across the whole vault instead of just the open document. */
export function useVaultIndex(): VaultFile[] {
  return useContext(VaultIndexContext);
}
