"use client";

import type { ComputedStep } from "@/lib/dashboards/types";
import { compactStepLabel } from "@/lib/dashboards/types";

function pct(num: number, denom: number): string {
  if (denom === 0) return "—";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

/** Format EUR sans décimale pour > 100 €, 2 décimales en dessous. */
function fmtEur(v: number): string {
  return v >= 100
    ? `${v.toFixed(0)} €`
    : `${v.toFixed(2).replace(".", ",")} €`;
}

export function FunnelTable({ steps }: { steps: ComputedStep[] }) {
  if (steps.length === 0) return null;
  const first = steps[0]?.count ?? 0;
  // Colonne « Coût Meta » affichée uniquement si au moins une étape porte
  // un coût. Évite une colonne vide dans 99 % des funnels EDH.
  const hasMetaCost = steps.some(
    (s) => s.meta_cost_eur != null && s.meta_cost_eur > 0
  );
  const totalMetaCost = hasMetaCost
    ? steps.reduce((acc, s) => acc + (s.meta_cost_eur ?? 0), 0)
    : 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-zinc-500 border-b">
          <tr>
            <th className="py-2 pr-4">Étape</th>
            <th className="py-2 pr-4 text-right">Volume</th>
            <th className="py-2 pr-4 text-right">Conv. vs précédent</th>
            <th className="py-2 pr-4 text-right">Conv. vs étape 1</th>
            {hasMetaCost && (
              <th
                className="py-2 pr-4 text-right"
                title="Coût Meta WhatsApp marketing estimé, calculé par indicatif pays sur les events porteurs d'un numéro de tel"
              >
                Coût Meta
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => {
            const prev = i === 0 ? null : steps[i - 1].count;
            const showBreakdown = s.refs.length > 1;
            return (
              <tr
                key={`step-${s.position}`}
                className={`border-b align-top ${!s.available ? "opacity-50" : ""}`}
              >
                <td className="py-2 pr-4">
                  <div>
                    <span className="text-zinc-400 mr-2">{i + 1}.</span>
                    {compactStepLabel(s)}
                    {!s.available && (
                      <span className="ml-2 text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                        indisponible
                      </span>
                    )}
                  </div>
                  {showBreakdown && (
                    <ul className="mt-1 ml-6 text-xs text-zinc-500 space-y-0.5">
                      {s.refs.map((r, ri) => (
                        <li
                          key={`${ri}-${r.ref_id}`}
                          className={`flex justify-between gap-4 ${
                            !r.available ? "opacity-60" : ""
                          }`}
                        >
                          <span className="truncate">
                            <span className="text-zinc-400 mr-1">·</span>
                            {r.label}
                            {!r.available && (
                              <span className="ml-1 text-amber-700">(indispo)</span>
                            )}
                          </span>
                          <span className="tabular-nums">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{s.count}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-zinc-600">
                  {prev === null ? "—" : pct(s.count, prev)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-zinc-600">
                  {i === 0 ? "—" : pct(s.count, first)}
                </td>
                {hasMetaCost && (
                  <td className="py-2 pr-4 text-right tabular-nums text-zinc-600">
                    {s.meta_cost_eur != null ? fmtEur(s.meta_cost_eur) : "—"}
                  </td>
                )}
              </tr>
            );
          })}
          {hasMetaCost && (
            <tr className="font-semibold border-t-2 border-zinc-300">
              <td className="py-2 pr-4">Total coût Meta</td>
              <td className="py-2 pr-4" />
              <td className="py-2 pr-4" />
              <td className="py-2 pr-4" />
              <td className="py-2 pr-4 text-right tabular-nums">
                {fmtEur(totalMetaCost)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
