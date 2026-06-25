import { useState } from "react";

const STORAGE_KEY = "mqpad-welcome-seen";

function loadSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether the welcome/tutorial dialog has already been dismissed, persisted in localStorage so it only auto-shows once. */
export function useFirstRun(): [boolean, () => void] {
  const [seen, setSeen] = useState<boolean>(loadSeen);

  const markSeen = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setSeen(true);
  };

  return [seen, markSeen];
}
