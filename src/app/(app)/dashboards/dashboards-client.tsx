"use client";

import { Toaster } from "sonner";
import { SubNavStats } from "../sub-nav-stats";

export function DashboardsClient() {
  return (
    <div className="space-y-4">
      <Toaster richColors position="top-right" />
      <header className="flex justify-between items-center">
        <SubNavStats />
      </header>
      <h2 className="text-xl font-semibold">Mes tableaux</h2>
      <p className="text-zinc-500">À venir.</p>
    </div>
  );
}
