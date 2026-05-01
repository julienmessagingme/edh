"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

/**
 * Top-level navigation : "Stats" (which encompasses /urls and /stats) and
 * "Base de connaissance" (/knowledge). Lives at the top of the auth-gated
 * shell, just above the school sidebar + main content.
 *
 * The active tab is computed from the current pathname rather than passed
 * as a prop : the layout doesn't know which page is rendering, and we
 * want the active state to update immediately on client-side navigation
 * without waiting for a server round-trip.
 */
export function HeaderTabs() {
  const pathname = usePathname();
  const isKnowledge = pathname.startsWith("/knowledge");

  return (
    <nav className="flex gap-1">
      <Link
        href="/urls"
        prefetch={false}
        className={
          isKnowledge
            ? "px-4 py-2 text-sm rounded-md text-zinc-700 hover:bg-zinc-100"
            : "px-4 py-2 text-sm rounded-md bg-zinc-900 text-white"
        }
      >
        Stats
      </Link>
      <Link
        href="/knowledge"
        prefetch={false}
        className={
          isKnowledge
            ? "px-4 py-2 text-sm rounded-md bg-zinc-900 text-white"
            : "px-4 py-2 text-sm rounded-md text-zinc-700 hover:bg-zinc-100"
        }
      >
        Base de connaissance
      </Link>
    </nav>
  );
}
