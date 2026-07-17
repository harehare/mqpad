/**
 * Scores how well `query`'s characters appear in order within `target`
 * (case-insensitive). Rewards runs of consecutive matches and matches right
 * after a path separator, so "todo" ranks "notes/todo.md" above
 * "to-do-list.md". Returns null if query isn't a subsequence of target.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = target.toLowerCase();

  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      consecutive++;
      // Squared, not linear, so one long contiguous run outscores the same
      // number of matches scattered across several separator-adjacent
      // fragments (each of which also gets its own boundary bonus below).
      score += consecutive * consecutive;
      if (ti === 0 || t[ti - 1] === "/" || t[ti - 1] === "-" || t[ti - 1] === "_" || t[ti - 1] === " ") {
        score += 5;
      }
      qi++;
    } else {
      consecutive = 0;
    }
  }
  return qi === q.length ? score : null;
}
