import type { VaultQueryResult } from "./runVaultQuery";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function resultsToCsv(results: VaultQueryResult[]): string {
  const header = "path,title,output";
  const rows = results.map((r) => [r.path, r.title, r.output].map(csvEscape).join(","));
  return [header, ...rows].join("\n");
}

export function resultsToJson(results: VaultQueryResult[]): string {
  return JSON.stringify(results, null, 2);
}
