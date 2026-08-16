import { navigation } from "@/components/navigation";

export interface Crumb {
  readonly label: string;
  /** Absent on the last crumb — it is where the reader already is. */
  readonly href?: string;
}

/** Routes with no navigation entry of their own still need a name. */
const SECTION_LABELS: Readonly<Record<string, string>> = {
  "api-status": "API Status",
  "needs-attention": "Needs attention",
  outreach: "Outreach",
  review: "Review",
  pipeline: "Pipeline",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where the current page sits, derived from the path alone.
 *
 * A record's identifier is shown as its first eight characters rather than
 * being resolved to a name: the top bar renders on every route and cannot
 * fetch, and a crumb reading "Company" where the reader expected a company's
 * name would be a label pretending to be data. The short id is what the URL
 * actually says.
 */
export function breadcrumbFor(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Workspace", href: "/" }];

  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return [...crumbs, { label: "Dashboard" }];
  }

  let href = "";
  for (const [index, segment] of segments.entries()) {
    href += `/${segment}`;
    const last = index === segments.length - 1;
    const entry = navigation.find((item) => item.href === href);

    const label = entry
      ? entry.name
      : UUID.test(segment)
        ? `${segment.slice(0, 8)}…`
        : (SECTION_LABELS[segment] ?? formatSegment(segment));

    crumbs.push(last ? { label } : { label, href });
  }

  return crumbs;
}

function formatSegment(segment: string): string {
  const words = segment.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
