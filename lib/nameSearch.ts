/**
 * Ranks name-search results so a short query still finds its exact match.
 *
 * "T" matches 21 real names in the club (anything containing the letter t) —
 * plain alphabetical order with a take-10 limit cut the athlete literally named
 * "T" before it ever reached the list, since "T" sorts after "Bank (Thaioil)",
 * "First", "Note"… A short query is exactly the case where a plain substring
 * search is least useful, so exact and prefix matches must outrank the rest
 * regardless of where they'd fall alphabetically.
 */

export interface Named {
  name: string;
}

function tier(query: string, name: string): 0 | 1 | 2 {
  const q = query.trim().toLowerCase();
  const n = name.toLowerCase();
  if (n === q) return 0; // exact
  if (n.startsWith(q)) return 1; // prefix
  return 2; // contains, anywhere else
}

/** `candidates` must already be filtered to ones that match `query` in some
 *  way (e.g. a DB `contains` query) — this only orders and trims them. */
export function rankNameMatches<T extends Named>(
  query: string,
  candidates: T[],
  limit = 10
): T[] {
  return [...candidates]
    .sort((a, b) => {
      const ta = tier(query, a.name);
      const tb = tier(query, b.name);
      return ta - tb || a.name.localeCompare(b.name, "th");
    })
    .slice(0, limit);
}
