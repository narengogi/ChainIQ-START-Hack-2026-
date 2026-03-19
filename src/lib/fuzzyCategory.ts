/**
 * Token-based fuzzy category matcher.
 * Used when an exact category_l2 lookup returns 0 suppliers.
 */
import { query } from "../db/mysql";

export interface CategoryMatch {
  category_l1: string;
  category_l2: string;
  score:        number;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[()\/\-&,]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
}

/** Jaccard similarity + containment bonus */
function score(query: Set<string>, candidate: Set<string>): number {
  if (query.size === 0 || candidate.size === 0) return 0;
  let overlap = 0;
  for (const t of query) if (candidate.has(t)) overlap++;
  const jaccard     = overlap / (query.size + candidate.size - overlap);
  const containment = overlap / query.size; // what fraction of query tokens appear in candidate
  return (jaccard + containment) / 2;
}

/**
 * Load all active categories from the suppliers table, then return the best-
 * matching category_l2 for the given input, optionally restricted to a known l1.
 */
export async function fuzzyMatchCategory(
  inputL1: string,
  inputL2: string,
  minScore = 0.3,
): Promise<CategoryMatch | null> {
  const rows = await query<{ category_l1: string; category_l2: string }>(
    `SELECT DISTINCT category_l1, category_l2 FROM suppliers WHERE contract_status = 'active'`,
  );

  const inputL2Tokens = tokenize(inputL2);
  const inputL1Lower  = inputL1.toLowerCase().trim();

  let best: CategoryMatch | null = null;

  for (const row of rows) {
    // If L1 is a plausible match, weight it higher
    const l1Match = row.category_l1.toLowerCase() === inputL1Lower;
    const candidateTokens = tokenize(row.category_l2);
    let s = score(inputL2Tokens, candidateTokens);
    if (l1Match) s = Math.min(1, s * 1.25); // boost same-L1 candidates

    if (s > (best?.score ?? 0)) {
      best = { category_l1: row.category_l1, category_l2: row.category_l2, score: s };
    }
  }

  if (!best || best.score < minScore) return null;
  return best;
}

/**
 * MySQL LIKE fallback: tries key words from the input against category_l2.
 * Catches cases where tokenize produces zero overlap (e.g. very short inputs).
 */
export async function likeMatchCategory(
  inputL2: string,
): Promise<{ category_l1: string; category_l2: string } | null> {
  const words = inputL2.split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) return null;

  // Build OR of LIKE conditions for each meaningful word
  const conditions  = words.map(() => `category_l2 LIKE ?`).join(" OR ");
  const params      = words.map((w) => `%${w}%`);

  const rows = await query<{ category_l1: string; category_l2: string; cnt: string }>(
    `SELECT category_l1, category_l2, COUNT(*) as cnt
     FROM suppliers
     WHERE contract_status = 'active' AND (${conditions})
     GROUP BY category_l1, category_l2
     ORDER BY cnt DESC
     LIMIT 1`,
    params,
  );

  return rows[0] ?? null;
}
