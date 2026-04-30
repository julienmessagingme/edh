"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function Sidebar({
  schools,
  currentSlug,
}: {
  schools: { slug: string; name: string }[];
  currentSlug: string;
}) {
  const router = useRouter();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  async function selectSchool(slug: string) {
    if (slug === currentSlug) return;
    setPendingSlug(slug);
    const r = await fetch("/api/school", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    setPendingSlug(null);
    if (r.ok) router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-56 bg-white border-r flex flex-col p-4 space-y-1">
      <h1 className="font-semibold text-lg mb-4">EDH Stats</h1>
      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Écoles</p>
      {schools.map((s) => {
        const active = s.slug === currentSlug;
        const pending = s.slug === pendingSlug;
        const disabled = pendingSlug !== null;
        return (
          <button
            key={s.slug}
            onClick={() => selectSchool(s.slug)}
            className={`text-left px-3 py-2 rounded text-sm transition-colors ${
              active
                ? "bg-zinc-900 text-white"
                : "hover:bg-zinc-100 text-zinc-700"
            } ${pending ? "opacity-60" : ""} ${disabled && !pending ? "opacity-40" : ""}`}
            disabled={disabled}
          >
            {s.name}
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        onClick={logout}
        className="text-sm text-zinc-500 hover:text-zinc-900 text-left px-3 py-2"
      >
        Se déconnecter
      </button>
    </aside>
  );
}
