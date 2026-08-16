import { sql } from "drizzle-orm";

import type { Executor } from "../client";

export interface SearchHit {
  readonly id: string;
  readonly name: string;
  /** What tells this hit apart from another with the same name. */
  readonly detail: string | null;
}

export interface SearchResults {
  readonly query: string;
  readonly companies: readonly SearchHit[];
  readonly leads: readonly SearchHit[];
  /** Matches found before the cap, so a truncated list can say it is truncated. */
  readonly totalMatches: number;
}

/** More than this in a palette is a list nobody reads. */
const PER_KIND_LIMIT = 8;

/**
 * Companies and leads by name or domain.
 *
 * Ordered by match quality — a prefix match before a contained one, then
 * alphabetically — so the thing the reader was most likely typing is first
 * rather than whatever the planner returned. The query is parameterised and
 * the wildcards are escaped: a query containing `%` searches for a percent
 * sign, it does not match everything.
 */
export async function searchWorkspace(
  executor: Executor,
  rawQuery: string,
): Promise<SearchResults> {
  const query = rawQuery.trim();

  if (query.length === 0) {
    return { query, companies: [], leads: [], totalMatches: 0 };
  }

  const escaped = query.replace(/[\\%_]/g, (character) => `\\${character}`);
  const prefix = `${escaped}%`;
  const contains = `%${escaped}%`;

  const [companyRows, leadRows, totals] = await Promise.all([
    executor.execute(sql`
      select
        companies.id::text as id,
        companies.name as name,
        companies.website as detail
      from companies
      where companies.name ilike ${contains} escape '\\'
         or companies.normalized_domain ilike ${contains} escape '\\'
      order by
        (companies.name ilike ${prefix} escape '\\') desc,
        companies.name asc
      limit ${PER_KIND_LIMIT}
    `),
    executor.execute(sql`
      select
        leads.id::text as id,
        companies.name as name,
        'Score ' || leads.lead_score::text || ' · ' || leads.status as detail
      from leads
      join companies on companies.id = leads.company_id
      where companies.name ilike ${contains} escape '\\'
         or companies.normalized_domain ilike ${contains} escape '\\'
      order by
        (companies.name ilike ${prefix} escape '\\') desc,
        leads.lead_score desc
      limit ${PER_KIND_LIMIT}
    `),
    executor.execute(sql`
      select
        (select count(*)::int from companies
          where name ilike ${contains} escape '\\'
             or normalized_domain ilike ${contains} escape '\\') as companies,
        (select count(*)::int from leads
          join companies on companies.id = leads.company_id
          where companies.name ilike ${contains} escape '\\'
             or companies.normalized_domain ilike ${contains} escape '\\') as leads
    `),
  ]);

  const totalRow = (totals as unknown as ReadonlyArray<{ companies: number; leads: number }>)[0];

  return {
    query,
    companies: companyRows as unknown as SearchHit[],
    leads: leadRows as unknown as SearchHit[],
    totalMatches: totalRow === undefined ? 0 : Number(totalRow.companies) + Number(totalRow.leads),
  };
}
