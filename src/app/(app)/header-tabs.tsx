"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

interface Tab {
  href: string;
  label: string;
  match: (p: string) => boolean;
}

/**
 * Top-level navigation : "Stats" (which encompasses /urls, /stats and
 * /dashboards), "Base de connaissance" (/knowledge), and "Admin" (only
 * visible when `isAdmin` is true). Lives at the top of the auth-gated
 * shell, just above the school sidebar + main content.
 */
export function HeaderTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const tabs: Tab[] = [
    {
      href: "/urls",
      label: "Stats",
      // Stats encompasses URLs / Stats / Mes tableaux
      match: (p) =>
        !p.startsWith("/knowledge") &&
        !p.startsWith("/admin"),
    },
    {
      href: "/knowledge",
      label: "Base de connaissance",
      match: (p) => p.startsWith("/knowledge"),
    },
  ];
  if (isAdmin) {
    tabs.push({
      href: "/admin",
      label: "Admin",
      match: (p) => p.startsWith("/admin"),
    });
  }

  return (
    <nav className="flex gap-1">
      {tabs.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            className={
              active
                ? "px-4 py-2 text-sm rounded-md bg-zinc-900 text-white"
                : "px-4 py-2 text-sm rounded-md text-zinc-700 hover:bg-zinc-100"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
