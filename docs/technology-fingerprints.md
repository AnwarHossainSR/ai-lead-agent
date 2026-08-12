# Technology Fingerprints

Technology fingerprints define how to detect software technologies from captured website content. Each fingerprint declares patterns that match specific locations in a page capture.

## Adding a Fingerprint

Fingerprints are defined in `packages/config/src/product/fingerprints.ts`. To add a new technology:

1. **Choose an identifier** — a unique, lowercase, kebab-case ID (e.g., `nextjs`, `shopify`)
2. **Set the technology name** — the human-readable name (e.g., `Next.js`, `Shopify`)
3. **Choose a category** — one of: `cms`, `ecommerce`, `framework`, `page-builder`, `analytics`, `cdn`, `payment`, `hosting`
4. **Add patterns** — at least one pattern that matches the technology
5. **Optionally add implications** — technologies that are implied when this one is detected

### Example Fingerprint

```typescript
{
  id: "nextjs",
  technology: "Next.js",
  category: "framework",
  patterns: [
    {
      in: "html",
      match: "<meta name=\"next-head-count\" content=\"\\d+\"",
      version: 0,
    },
    {
      in: "header",
      match: "x-powered-by: Next\\.js",
    },
  ],
  implies: ["react"],
}
```

### Pattern Properties

| Property | Description |
|----------|-------------|
| `in` | Location to search: `header`, `html`, `script`, `stylesheet`, `cookie`, or `meta` |
| `match` | Regular expression pattern to match against |
| `version` | Optional capture group index to extract version from (0 = full match) |

## Match Locations

| Location | What it sees | Example |
|----------|--------------|---------|
| `header` | Response headers joined as `Key: Value` lines | `x-powered-by: Express` |
| `html` | First 2MB of page HTML | `<meta name="generator" content="WordPress 6.4">` |
| `script` | Script source URLs, one per line | `https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js` |
| `stylesheet` | Stylesheet URLs, one per line | `https://example.com/wp-content/themes/flavor/style.css` |
| `cookie` | Cookie names, one per line | `__cf_bm` |
| `meta` | Meta generator tag content | `Hugo 0.120.0` |

## Implications

When a fingerprint declares `implies`, those technologies are automatically marked as `inferred` (not `observed`) when the parent is detected. For example:

- WordPress implies PHP
- Shopify implies Ruby

Implications can form chains (A implies B implies C), but cycles are rejected at load time.

## Re-running Detection

To re-run detection against an existing analysis:

```bash
curl -X POST http://localhost:3001/api/analysis/{analysisId}/detect
```

This re-runs the matcher against the stored capture without making any network requests.

## Getting Technologies

To get the latest detected technologies for a company:

```bash
curl http://localhost:3001/api/companies/{companyId}/technologies
```

Returns the detections from the most recent completed analysis.

## Validation

Fingerprints are validated at load time:

- **Duplicate identifiers** — rejected with the offending ID
- **Empty patterns** — each fingerprint must have at least one pattern
- **Invalid regex** — patterns are validated as regular expressions
- **Unknown categories** — must be one of the defined categories
- **Backtracking detection** — patterns with catastrophic backtracking potential are rejected
- **Cycle detection** — implication cycles are rejected with the fingerprint names
