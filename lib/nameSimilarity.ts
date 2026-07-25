/**
 * Catching "the same person typed slightly differently" at sign-up time.
 *
 * Sign-up matches an existing player by exact (case-insensitive) name and
 * otherwise creates a new one, so "P’Note" quietly became a second record
 * alongside "Note" and split that player's history in half. This decides when a
 * typed name is close enough to an existing one to be worth asking about.
 *
 * It only ever prompts — it never merges anything by itself. Two people really
 * can be called Bank, and only they know which one they are.
 */

/**
 * Strip everything that varies between spellings of one nickname: case, spaces,
 * and the punctuation people decorate names with — P’Note/P'Note/P.Note,
 * "Tae (Kukkai)", "Bank-Thaioil". Thai and Latin letters both survive.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s'’`."·\-_()[\]{}]/g, "")
    .trim();
}

/** Levenshtein distance, bailing out early once it exceeds `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Shortest name length we'll treat as a containment match. Below this, "T"
 * would flag "Tae", "Toto" and every other name starting with t — noise that
 * trains people to dismiss the prompt.
 */
const MIN_CONTAINMENT_LENGTH = 3;

/**
 * Below this, one edit is most of the name: the club has both NK and NW, and
 * both BB and Bus. Short names must match exactly (or by containment).
 */
const MIN_TYPO_LENGTH = 4;

/** True when two names are close enough to be worth asking the player about. */
export function isSimilarName(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  // One name inside the other: "Note" ⊂ "P’Note", "Kukkai" ⊂ "Tae (Kukkai)".
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= MIN_CONTAINMENT_LENGTH && long.includes(short)) return true;

  // Typos, but only once the names are long enough for an edit to be a slip
  // rather than the whole difference: on two-letter names NK and NW are one
  // edit apart and are two different people.
  const shortest = Math.min(na.length, nb.length);
  if (shortest < MIN_TYPO_LENGTH) return false;
  const max = shortest >= 6 ? 2 : 1;
  return editDistance(na, nb, max) <= max;
}

export interface NamedPerson {
  id: string;
  name: string;
}

/**
 * Existing players whose names are close to `typed`, best match first. An exact
 * (normalized) match sorts ahead of anything fuzzier.
 */
export function findSimilarNames<T extends NamedPerson>(
  typed: string,
  people: T[],
  limit = 5
): T[] {
  const target = normalizeName(typed);
  if (!target) return [];
  return people
    .filter((p) => isSimilarName(typed, p.name))
    .sort((x, y) => {
      const xExact = normalizeName(x.name) === target ? 0 : 1;
      const yExact = normalizeName(y.name) === target ? 0 : 1;
      return xExact - yExact || x.name.localeCompare(y.name, "th");
    })
    .slice(0, limit);
}
