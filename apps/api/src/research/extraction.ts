/**
 * Deterministic extraction of contact information from page content.
 *
 * These extractors never construct or guess contact details — they only
 * extract what is explicitly present in the fetched content.
 */

/**
 * A extracted contact detail with its source.
 */
export interface ExtractedDetail {
  readonly value: string;
  readonly sourceUrl: string;
}

/**
 * Extracts email addresses from mailto: links in HTML content.
 *
 * Only extracts addresses that appear in href="mailto:..." attributes.
 * Does not extract addresses from text content to avoid false positives.
 */
export function extractMailtoLinks(
  html: string,
  pageUrl: string,
): readonly ExtractedDetail[] {
  const results: ExtractedDetail[] = [];
  const regex = /href\s*=\s*["']mailto:([^"']+)["']/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const email = match[1]?.trim();
    if (email && email.includes("@")) {
      results.push({ value: email, sourceUrl: pageUrl });
    }
  }

  return results;
}

/**
 * Extracts phone numbers from tel: links in HTML content.
 *
 * Only extracts numbers that appear in href="tel:..." attributes.
 */
export function extractTelLinks(
  html: string,
  pageUrl: string,
): readonly ExtractedDetail[] {
  const results: ExtractedDetail[] = [];
  const regex = /href\s*=\s*["']tel:([^"']+)["']/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const phone = match[1]?.trim();
    if (phone && phone.length >= 5) {
      results.push({ value: phone, sourceUrl: pageUrl });
    }
  }

  return results;
}

/**
 * A structured data person extracted from schema.org markup.
 */
export interface StructuredDataPerson {
  readonly name: string;
  readonly jobTitle?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly url?: string;
}

/**
 * Extracts Person and Organization structured data from HTML.
 *
 * Parses JSON-LD script tags containing schema.org Person or Organization
 * markup.
 */
export function extractStructuredData(
  html: string,
  pageUrl: string,
): readonly StructuredDataPerson[] {
  const results: StructuredDataPerson[] = [];
  const jsonLdRegex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    const content = match[1]?.trim();
    if (!content) continue;

    try {
      const data = JSON.parse(content);
      extractPeopleFromJsonLd(data, results, pageUrl);
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  return results;
}

function extractPeopleFromJsonLd(
  data: unknown,
  results: StructuredDataPerson[],
  pageUrl: string,
): void {
  if (data === null || typeof data !== "object") return;

  if (Array.isArray(data)) {
    for (const item of data) {
      extractPeopleFromJsonLd(item, results, pageUrl);
    }
    return;
  }

  const obj = data as Record<string, unknown>;
  const type = obj["@type"];

  if (type === "Person" || type === "Organization") {
    const person = parseStructuredPerson(obj, pageUrl);
    if (person !== null) {
      results.push(person);
    }
  }

  // Recurse into nested objects
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null) {
      extractPeopleFromJsonLd(value, results, pageUrl);
    }
  }
}

function parseStructuredPerson(
  obj: Record<string, unknown>,
  _pageUrl: string,
): StructuredDataPerson | null {
  const name = typeof obj["name"] === "string" ? obj["name"] : null;
  if (!name) return null;

  const jobTitle = typeof obj["jobTitle"] === "string" ? obj["jobTitle"] : undefined;
  const url = typeof obj["url"] === "string" ? obj["url"] : undefined;

  let email: string | undefined;
  let phone: string | undefined;

  // Extract email from contactPoint or email field
  const contactPoint = obj["contactPoint"];
  if (typeof contactPoint === "object" && contactPoint !== null) {
    const cp = contactPoint as Record<string, unknown>;
    if (typeof cp["email"] === "string") email = cp["email"];
    if (typeof cp["telephone"] === "string") phone = cp["telephone"];
  }

  if (typeof obj["email"] === "string") email = obj["email"];
  if (typeof obj["telephone"] === "string") phone = obj["telephone"];

  return {
    name,
    jobTitle,
    email,
    phone,
    url,
  };
}

/**
 * A visible address extracted from rendered text.
 */
export interface VisibleAddress {
  readonly value: string;
  readonly sourceUrl: string;
}

/**
 * Extracts visible addresses from rendered page text.
 *
 * Uses a strict pattern to find addresses that are clearly displayed
 * on the page. Stores the address at the domain it actually appears on,
 * not the company's domain.
 */
export function extractVisibleAddresses(
  text: string,
  pageUrl: string,
): readonly VisibleAddress[] {
  const results: VisibleAddress[] = [];

  // Pattern for common address formats
  // Matches: "123 Street Name, City, Country" or "PO Box 123, City"
  const addressPatterns = [
    /(?:^|\n)\s*(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way|Circle|Cir)[.,\s]+[A-Za-z\s]+(?:,\s*[A-Za-z\s]+){1,3})/gi,
    /(?:^|\n)\s*(PO\s*Box\s+\d+[,\s]+[A-Za-z\s]+(?:,\s*[A-Za-z\s]+){0,2})/gi,
  ];

  for (const pattern of addressPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const address = match[1]?.trim();
      if (address && address.length >= 10) {
        results.push({ value: address, sourceUrl: pageUrl });
      }
    }
  }

  return results;
}
