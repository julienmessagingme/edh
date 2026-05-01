"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

/**
 * Sub-navigation rendered inside both /urls and /stats pages. Replaces the
 * inline sub-nav that used to live in urls-client.tsx and stats-client.tsx.
 * Single source of truth for the URLs / Stats tab styling and active state.
 */
export function SubNavStats() {
  const pathname = usePathname();
  const isUrls = pathname.startsWith("/urls");

  return (
    <nav className="flex gap-2">
      <Link
        href="/urls"
        prefetch={false}
        className={
          isUrls
            ? "px-3 py-1.5 rounded bg-zinc-900 text-white text-sm"
            : "px-3 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700"
        }
      >
        URLs
      </Link>
      <Link
        href="/stats"
        prefetch={false}
        className={
          isUrls
            ? "px-3 py-1.5 rounded hover:bg-zinc-100 text-sm text-zinc-700"
            : "px-3 py-1.5 rounded bg-zinc-900 text-white text-sm"
        }
      >
        Stats
      </Link>
    </nav>
  );
}
