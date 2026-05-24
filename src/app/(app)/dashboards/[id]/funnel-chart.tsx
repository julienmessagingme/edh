"use client";

import {
  BarChart,
  Bar,
  Grid,
  BarXAxis,
  ChartTooltip,
} from "@/components/ui/bar-chart";
import type { ComputedStep } from "@/lib/dashboards/types";
import { compactStepLabel } from "@/lib/dashboards/types";

/** Palette par POSITION dans la pile (pas par identité de source) :
 *  le segment du bas de chaque barre prend toujours STACK_COLORS[0],
 *  celui juste au-dessus STACK_COLORS[1], etc. Conséquence souhaitée :
 *  une même barre ne mélange jamais 2 couleurs proches, et 2 barres
 *  adjacentes n'ont jamais leur segment principal de la même couleur
 *  que les nuances secondaires de leur voisine. La sémantique cross-barre
 *  (« cette source est en violet partout ») est perdue mais le tooltip
 *  + les sous-pourcentages dans la table permettent de la suivre. */
const STACK_COLORS = [
  "#27272a", // zinc-800 — segment principal (le plus en bas, le + gros par tri)
  "#dc2626", // red-600
  "#0284c7", // sky-600
  "#16a34a", // green-600
  "#ea580c", // orange-600
  "#7c3aed", // violet-600
  "#facc15", // yellow-400
  "#0d9488", // teal-600
  "#ec4899", // pink-500
  "#a16207", // yellow-700
];

const SIMPLE_COLOR = "#27272a";

/** Met en forme un nombre fr (1 234). */
function fmtNum(v: unknown): string {
  if (typeof v !== "number") return String(v);
  return v.toLocaleString("fr-FR");
}

interface RefForStep {
  label: string;
  count: number;
}

export function FunnelChart({ steps }: { steps: ComputedStep[] }) {
  if (steps.length === 0) return null;

  // Mode stacked dès qu'au moins une étape cumule plusieurs refs.
  const hasCumul = steps.some(
    (s) => s.refs.filter((r) => r.available).length > 1
  );

  if (!hasCumul) {
    // ── Mode simple : 1 série Volume, 1 couleur uniforme ──
    type Row = { label: string; Volume: number };
    const data: Row[] = steps.map((s, i) => ({
      label: `${i + 1}. ${compactStepLabel(s)}`,
      Volume: s.count,
    }));
    return (
      <div className="w-full">
        <BarChart
          data={data}
          xDataKey="label"
          barGap={0.3}
          margin={{ top: 36, right: 24, bottom: 56, left: 24 }}
          aspectRatio="16 / 7"
          animationDuration={900}
        >
          <Grid horizontal fadeHorizontal={false} />
          <Bar
            dataKey="Volume"
            fill={SIMPLE_COLOR}
            lineCap={4}
            animationType="grow"
          />
          <BarXAxis showAllLabels tickerHalfWidth={70} />
          <ChartTooltip
            showDots={false}
            rows={(point) => [
              {
                color: SIMPLE_COLOR,
                label: "Volume",
                value: fmtNum(point.Volume),
              },
            ]}
          />
        </BarChart>
      </div>
    );
  }

  // ── Mode stacked : 1 série par POSITION dans la pile ──
  // Chaque étape range ses refs (triées par count desc, le plus gros
  // d'abord) dans des slots seg_0, seg_1, seg_2…
  //   - seg_0  → segment du bas, plus grand, couleur principale (zinc).
  //   - seg_N  → segment du haut, plus petit, couleur secondaire.
  // Couleur fixée par seg index, pas par source : 2 barres adjacentes
  // ont donc le même seg_0 visuel (zinc dominant) — c'est OK et lisible
  // car ce sont 2 "barres principales" distinctes côté UX.
  const maxSources = Math.max(
    ...steps.map((s) => s.refs.filter((r) => r.available).length),
    1
  );
  const segKeys = Array.from({ length: maxSources }, (_, i) => `__seg_${i}`);

  type Row = {
    label: string;
    __total__: number;
    __sources__: RefForStep[]; // ordre = ordre des seg_*
  } & Record<string, number | string | RefForStep[]>;

  const data: Row[] = steps.map((s, i) => {
    const sorted = s.refs
      .filter((r) => r.available)
      .map((r) => ({ label: r.label, count: r.count }))
      .sort((a, b) => b.count - a.count);
    const row: Row = {
      label: `${i + 1}. ${compactStepLabel(s)}`,
      __total__: s.count,
      __sources__: sorted,
    };
    segKeys.forEach((key, idx) => {
      row[key] = sorted[idx]?.count ?? 0;
    });
    return row;
  });

  return (
    <div className="w-full">
      <BarChart
        data={data}
        xDataKey="label"
        stacked
        stackGap={2}
        barGap={0.3}
        margin={{ top: 36, right: 24, bottom: 56, left: 24 }}
        aspectRatio="16 / 7"
        animationDuration={900}
      >
        <Grid horizontal fadeHorizontal={false} />
        {segKeys.map((key, idx) => (
          <Bar
            key={key}
            dataKey={key}
            fill={STACK_COLORS[idx % STACK_COLORS.length]}
            lineCap={4}
            animationType="grow"
          />
        ))}
        <BarXAxis showAllLabels tickerHalfWidth={70} />
        <ChartTooltip
          showDots={false}
          rows={(point) => {
            const sources = (point.__sources__ as RefForStep[]) ?? [];
            const total = Number(point.__total__ ?? 0);
            // Total en tête, puis chaque source avec sa vraie couleur
            // (= celle du seg_index correspondant) et son volume.
            return [
              { color: "#71717a", label: "Total", value: fmtNum(total) },
              ...sources.map((src, idx) => ({
                color: STACK_COLORS[idx % STACK_COLORS.length],
                label: src.label,
                value: fmtNum(src.count),
              })),
            ];
          }}
        />
      </BarChart>
    </div>
  );
}
