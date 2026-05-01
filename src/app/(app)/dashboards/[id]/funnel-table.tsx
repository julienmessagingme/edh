"use client";

import type { ComputedStep } from "@/lib/dashboards/types";

function pct(num: number, denom: number): string {
  if (denom === 0) return "—";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

export function FunnelTable({ steps }: { steps: ComputedStep[] }) {
  if (steps.length === 0) return null;
  const first = steps[0]?.count ?? 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-zinc-500 border-b">
          <tr>
            <th className="py-2 pr-4">Étape</th>
            <th className="py-2 pr-4 text-right">Volume</th>
            <th className="py-2 pr-4 text-right">Conv. vs précédent</th>
            <th className="py-2 pr-4 text-right">Conv. vs étape 1</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => {
            const prev = i === 0 ? null : steps[i - 1].count;
            return (
              <tr
                key={`${s.position}-${s.ref_id}`}
                className={`border-b ${!s.available ? "opacity-50" : ""}`}
              >
                <td className="py-2 pr-4">
                  <span className="text-zinc-400 mr-2">{i + 1}.</span>
                  {s.label}
                  {!s.available && (
                    <span className="ml-2 text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                      indisponible
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{s.count}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-zinc-600">
                  {prev === null ? "—" : pct(s.count, prev)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-zinc-600">
                  {i === 0 ? "—" : pct(s.count, first)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
