import { apiUrl } from "./api";
import { fetchWithTimeout } from "./fetch-with-timeout";

/** An account as returned by `GET /api/accounts` — never a password hash. */
export interface AccountSummary {
  readonly id: string;
  readonly email: string;
  readonly role: "operator" | "viewer";
}

/**
 * Every account, for resolving an attribution id (`approvedByAccountId` and
 * its siblings) to a displayable email (task 8.5). Falls back to an empty
 * list on any failure — attribution then falls back to just showing the
 * time with no name, rather than the whole page failing over one lookup.
 */
export async function fetchAccounts(): Promise<readonly AccountSummary[]> {
  const url = apiUrl("/accounts");
  if (url === null) {
    return [];
  }

  const result = await fetchWithTimeout<AccountSummary[]>(url);
  return result.status === "ok" ? result.data : [];
}

export function resolveAccountEmail(
  accounts: readonly AccountSummary[],
  accountId: string | null,
): string | null {
  if (accountId === null) {
    return null;
  }
  return accounts.find((account) => account.id === accountId)?.email ?? null;
}
