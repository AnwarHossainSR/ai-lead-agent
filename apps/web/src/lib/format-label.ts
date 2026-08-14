/** Turns a lower_snake_case identifier into a display label, e.g. "high_priority" -> "High Priority". */
export function formatLabel(id: string): string {
  return id
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
