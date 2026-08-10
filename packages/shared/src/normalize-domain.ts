/**
 * Domain normalization.
 *
 * Two records describe the same company when their websites resolve to the
 * same normalized domain, so this is what `companies.normalized_domain` stores
 * and what the partial unique index deduplicates on. It must be deterministic
 * and total: input that is absent or is not a registrable domain returns
 * `null`, meaning "unknown", rather than a guess that would silently merge or
 * split company records.
 */

/** `https:`, `ftp:`, `mailto:` — anything the URL parser would treat as a scheme. */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Every public suffix is either alphabetic or an IDN A-label. Requiring one
 * excludes hostnames that are not registrable domains — a bare host such as
 * `localhost` and IP literals such as `192.168.1.1` — which must never be
 * stored as though they identified a company.
 */
const REGISTRABLE_TLD = /^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/;

const WWW_PREFIX = "www.";

export function normalizeDomain(input: string | null | undefined): string | null {
  if (input === null || input === undefined) {
    return null;
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // A bare `example.ae` has no scheme and the URL parser requires one. The
  // assumed scheme is discarded — only the host survives normalization, so
  // http and https forms of one site converge.
  const withScheme = SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  // The WHATWG parser has already dropped the port, path, query and fragment,
  // and converted a Unicode host to its punycode A-label — so `مثال.إمارات`
  // and `xn--mgbh0fb.xn--kgbeam7a8h` arrive here identical. It lowercases the
  // host of special schemes only; do it unconditionally.
  let host = parsed.hostname.toLowerCase();

  // A fully qualified name may carry the root dot: `example.ae.` is `example.ae`.
  if (host.endsWith(".")) {
    host = host.slice(0, -1);
  }

  // `www` is a conventional prefix rather than part of the identity — but only
  // when something registrable is left behind it, so `www.com` stays `www.com`
  // and other subdomains (`shop.example.ae`) are preserved as distinct sites.
  if (host.startsWith(WWW_PREFIX)) {
    const withoutWww = host.slice(WWW_PREFIX.length);
    if (withoutWww.includes(".")) {
      host = withoutWww;
    }
  }

  const labels = host.split(".");
  const tld = labels.at(-1);

  if (labels.length < 2 || tld === undefined || !REGISTRABLE_TLD.test(tld)) {
    return null;
  }

  if (labels.some((label) => label.length === 0)) {
    return null;
  }

  return host;
}
