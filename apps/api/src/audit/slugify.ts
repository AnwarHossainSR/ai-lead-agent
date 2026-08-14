/** Turns a `@RequiresRole` action string ("Approving outreach") into an audit event name ("approving_outreach"). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
