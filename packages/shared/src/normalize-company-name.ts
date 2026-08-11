/**
 * Company name normalization.
 *
 * A comparison key, never a display value: `companies.name` keeps the name as
 * it was actually observed. This exists so that two records for one company
 * can be recognised as duplicates when neither has a website to deduplicate
 * on, and so that `Example Trading L.L.C.` and `example trading llc` do not
 * become two companies.
 */

/**
 * Legal-form suffixes common to UAE and Saudi company registrations, written
 * as they appear *after* punctuation is folded: `L.L.C.` reaches this list as
 * `llc` and `FZ-LLC` as `fz llc`. Extend the list rather than the algorithm.
 */
export const LEGAL_SUFFIXES: readonly string[] = [
  "llc",
  "fz llc",
  "llc fz",
  "fze",
  "ltd",
  "limited",
  "wll",
  "pjsc",
];

/**
 * Longest first, so `fz llc` is matched before the `llc` inside it regardless
 * of the order the suffixes are declared in.
 */
const SUFFIX_TOKENS: readonly (readonly string[])[] = LEGAL_SUFFIXES.map((suffix) =>
  suffix.split(" "),
).sort((a, b) => b.length - a.length);

/** Dots and apostrophes join their neighbours, so `L.L.C.` folds to `llc`. */
const JOINING_PUNCTUATION = /[.'’]/g;

/**
 * Everything else separates. Matching on Unicode letters and numbers rather
 * than `a-z0-9` keeps Arabic company names intact instead of erasing them.
 */
const SEPARATORS = /[^\p{L}\p{N}]+/gu;

/**
 * Removes one trailing legal suffix, or returns `null` when the name does not
 * end in one. Never removes every remaining token: a company recorded only as
 * `LLC` normalizes to `llc`, which is unhelpful but honest, where an empty
 * string would collide with every other suffix-only name.
 */
function stripOneSuffix(tokens: readonly string[]): string[] | null {
  for (const suffix of SUFFIX_TOKENS) {
    if (tokens.length <= suffix.length) {
      continue;
    }

    const tail = tokens.slice(-suffix.length);
    if (tail.every((token, index) => token === suffix[index])) {
      return tokens.slice(0, -suffix.length);
    }
  }

  return null;
}

export function normalizeCompanyName(input: string | null | undefined): string | null {
  if (input === null || input === undefined) {
    return null;
  }

  const folded = input
    .toLowerCase()
    .replace(JOINING_PUNCTUATION, "")
    .replace(SEPARATORS, " ")
    .trim();

  if (folded.length === 0) {
    return null;
  }

  // Repeated, because a name can carry more than one suffix.
  let tokens = folded.split(" ");
  let shorter = stripOneSuffix(tokens);

  while (shorter !== null) {
    tokens = shorter;
    shorter = stripOneSuffix(tokens);
  }

  return tokens.join(" ");
}
