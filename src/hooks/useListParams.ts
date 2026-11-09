"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * List state (page, limit, search, filters) lives in the URL, so the server page
 * re-renders with the new data and every view is shareable / bookmarkable.
 */
export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const get = useCallback((key: string) => searchParams.get(key) ?? "", [searchParams]);

  /** Sets several params at once; empty values are removed. Resets to page 1 unless page is set. */
  const update = useCallback(
    (changes: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (!("page" in changes)) next.delete("page");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [pathname, router, searchParams]
  );

  return { get, update, isPending };
}
