function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Vault-relative path for the daily note on `date` (defaults to today), e.g. "/Daily/2026-08-23.md". */
export function getDailyNotePath(folder: string, date: Date = new Date()): string {
  const dateStr = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const cleanFolder = folder.trim().replace(/^\/+|\/+$/g, "");
  return cleanFolder ? `/${cleanFolder}/${dateStr}.md` : `/${dateStr}.md`;
}
