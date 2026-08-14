/**
 * Parses a raw `Cookie` request header into a name-value map.
 *
 * The project has no cookie-parsing middleware installed; the guard and the
 * sign-out endpoint each need exactly one cookie's value, which does not
 * justify adding one.
 */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};

  if (header === undefined) {
    return result;
  }

  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (name.length === 0) {
      continue;
    }

    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }

  return result;
}
