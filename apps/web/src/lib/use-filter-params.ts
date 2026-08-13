"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Reads and updates a page's filters through the URL (design D6) — no
 * client-side filter state, so the current view is always exactly what the
 * URL says it is. Setting a value to `null` or `""` removes the param
 * instead of writing an empty one, keeping the URL free of noise.
 *
 * Calls `useSearchParams()`, so the component using this hook must be
 * rendered inside a `<Suspense>` boundary (see design D7).
 */
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }

      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { searchParams, setParam };
}
