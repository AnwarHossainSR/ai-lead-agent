"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFilterParams } from "@/lib/use-filter-params";

/**
 * One filter's dropdown, backed by a URL search param (design D6). Shared
 * across every filter bar so a filtered view is always a link, never
 * client-side state that could drift from the URL.
 */
export function FilterSelect({
  label,
  paramKey,
  value,
  options,
}: {
  label: string;
  paramKey: string;
  value: string | undefined;
  options: readonly { value: string; label: string }[];
}) {
  const { setParam } = useFilterParams();
  const allLabel = `All ${label.toLowerCase()}`;

  return (
    <Select
      value={value ?? "all"}
      onValueChange={(next) => setParam(paramKey, next === "all" ? null : String(next))}
    >
      <SelectTrigger aria-label={label} className="w-full sm:w-44">
        {/* base-ui only knows an item's label once that item has mounted, so a
            filter restored from the URL would otherwise show the raw id until
            the menu is opened once. Formatting from `options` here makes the
            trigger correct from first paint. */}
        <SelectValue placeholder={label}>
          {(current: string) =>
            current === "all"
              ? allLabel
              : (options.find((o) => o.value === current)?.label ?? current)
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
