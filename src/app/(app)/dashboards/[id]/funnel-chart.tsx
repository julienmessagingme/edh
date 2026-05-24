"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";
import type { ComputedStep } from "@/lib/dashboards/types";
import { compactStepLabel } from "@/lib/dashboards/types";

const COLORS = ["#27272a", "#3f3f46", "#52525b", "#71717a", "#a1a1aa", "#d4d4d8"];

/** Palette plus large et contrastée pour le mode stacked : il faut
 *  distinguer N sources empilées dans la même barre — la palette zinc
 *  monochrome ne marche plus. */
const STACK_COLORS = [
  "#27272a", // zinc-800
  "#7c3aed", // violet-600
  "#0284c7", // sky-600
  "#16a34a", // green-600
  "#ea580c", // orange-600
  "#dc2626", // red-600
  "#a16207", // yellow-700
  "#0891b2", // cyan-600
  "#9333ea", // purple-600
  "#65a30d", // lime-600
  "#c026d3", // fuchsia-600
  "#0d9488", // teal-600
];

export function FunnelChart({ steps }: { steps: ComputedStep[] }) {
  if (steps.length === 0) return null;

  // Détection : au moins une étape cumule plusieurs refs available
  // → on bascule en mode "stacked bar" (1 segment par source).
  // Sinon, mode simple historique (1 barre = 1 valeur).
  const hasCumul = steps.some(
    (s) => s.refs.filter((r) => r.available).length > 1
  );

  if (!hasCumul) {
    // Mode simple — 1 série, 1 barre par étape, couleurs zinc dégradées.
    const data = steps.map((s, i) => ({
      label: `${i + 1}. ${compactStepLabel(s)}`,
      count: s.count,
      available: s.available,
    }));
    return (
      <div className="w-full" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 24, right: 16, left: 0, bottom: 56 }}
          >
            <CartesianGrid stroke="#f4f4f5" vertical={false} />
            <XAxis
              dataKey="label"
              interval={0}
              angle={-25}
              textAnchor="end"
              height={56}
              tick={{ fontSize: 11, fill: "#52525b" }}
            />
            <YAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#52525b" }}
              width={48}
            />
            <Tooltip
              formatter={(v: unknown) => [String(v), "Volume"]}
              cursor={{ fill: "#fafafa" }}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              label={{ position: "top", fontSize: 11, fill: "#3f3f46" }}
            >
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={
                    d.available
                      ? COLORS[Math.min(i, COLORS.length - 1)]
                      : "#e4e4e7"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Mode stacked — 1 série par source unique (identifiée par son label).
  // On collecte d'abord les sources distinctes à travers TOUTES les
  // étapes, en gardant l'ordre d'apparition (1ère étape, 2ème, ...).
  // Si la même source apparaît dans plusieurs étapes, 1 seule série
  // (avec une seule couleur, ce qui aide à la lire dans les 2 barres).
  type Series = { label: string; color: string };
  const series: Series[] = [];
  const seen = new Set<string>();
  for (const s of steps) {
    for (const r of s.refs) {
      if (!r.available) continue;
      if (seen.has(r.label)) continue;
      seen.add(r.label);
      series.push({
        label: r.label,
        color: STACK_COLORS[(series.length) % STACK_COLORS.length],
      });
    }
  }

  // data : 1 ligne par étape, 1 colonne par série + total + label X.
  // `__total__` est exposé pour pouvoir l'afficher en label au-dessus
  // du dernier segment de chaque barre (recharts ne le calcule pas
  // automatiquement quand on stacke).
  type Row = { label: string; __total__: number } & Record<string, number | string>;
  const data: Row[] = steps.map((s, i) => {
    const row: Row = {
      label: `${i + 1}. ${compactStepLabel(s)}`,
      __total__: s.count,
    };
    for (const ser of series) {
      const ref = s.refs.find(
        (r) => r.available && r.label === ser.label
      );
      row[ser.label] = ref ? ref.count : 0;
    }
    return row;
  });

  // Hauteur : un peu plus grand pour laisser de la place à la légende
  // sous le chart.
  const legendH = Math.min(64, Math.ceil(series.length / 3) * 18 + 12);
  return (
    <div
      className="w-full"
      style={{ height: 320 + legendH }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 24, right: 16, left: 0, bottom: 56 + legendH }}
        >
          <CartesianGrid stroke="#f4f4f5" vertical={false} />
          <XAxis
            dataKey="label"
            interval={0}
            angle={-25}
            textAnchor="end"
            height={56}
            tick={{ fontSize: 11, fill: "#52525b" }}
          />
          <YAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#52525b" }}
            width={48}
          />
          <Tooltip cursor={{ fill: "#fafafa" }} content={<StackedTooltip />} />
          <Legend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          {series.map((ser, i) => {
            const isLast = i === series.length - 1;
            return (
              <Bar
                key={ser.label}
                dataKey={ser.label}
                stackId="stack"
                fill={ser.color}
                // Coin arrondi uniquement en haut du dernier segment de
                // la pile (visuellement plus propre).
                radius={isLast ? [4, 4, 0, 0] : 0}
                // Label "total" affiché uniquement au sommet (dernier
                // segment) — sinon on aurait 1 label par segment.
                label={
                  isLast
                    ? {
                        position: "top",
                        fontSize: 11,
                        fill: "#3f3f46",
                        formatter: (v: unknown, _entry?: unknown, idx?: number) => {
                          // `idx` n'est pas fiable selon les versions recharts ;
                          // on récupère le total via la valeur `__total__`
                          // que l'on a injectée dans chaque row.
                          if (typeof idx === "number" && data[idx]) {
                            return String(data[idx].__total__);
                          }
                          return String(v);
                        },
                      }
                    : false
                }
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tooltip custom pour le stacked bar : montre le total en titre puis
 *  le breakdown par source (couleur + label + volume + %). */
function StackedTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    payload: { __total__: number };
  }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload[0]?.payload?.__total__ ?? 0;
  // Filtre les séries à 0 (sources absentes de cette étape) pour ne pas
  // polluer le tooltip avec 10 lignes vides.
  const nonZero = payload.filter((p) => p.value > 0);
  return (
    <div className="bg-white border rounded shadow-sm text-xs p-2 min-w-[200px]">
      <div className="font-semibold mb-1">{label}</div>
      <div className="text-zinc-500 mb-1.5">
        Total : <span className="text-zinc-900 font-medium">{total}</span>
      </div>
      <ul className="space-y-0.5">
        {nonZero.map((p) => {
          const pct = total > 0 ? ((p.value / total) * 100).toFixed(0) : "0";
          return (
            <li key={p.dataKey} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-sm shrink-0"
                style={{ background: p.color }}
              />
              <span className="truncate flex-1">{p.dataKey}</span>
              <span className="tabular-nums text-zinc-600">
                {p.value} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
