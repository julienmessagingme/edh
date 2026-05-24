"use client";

import {
  BarChart,
  Bar,
  Grid,
  BarXAxis,
  BarYAxis,
  ChartTooltip,
} from "@/components/ui/bar-chart";
import type { ComputedStep } from "@/lib/dashboards/types";
import { compactStepLabel } from "@/lib/dashboards/types";

/** Palette contrastée pour le mode stacked : il faut distinguer N sources
 *  empilées dans la même barre. Couleurs choisies pour un bon contraste
 *  entre voisines (zinc dark / violet / sky / green / orange / red / yellow
 *  dark / cyan / purple / lime / fuchsia / teal). */
const STACK_COLORS = [
  "#27272a",
  "#7c3aed",
  "#0284c7",
  "#16a34a",
  "#ea580c",
  "#dc2626",
  "#a16207",
  "#0891b2",
  "#9333ea",
  "#65a30d",
  "#c026d3",
  "#0d9488",
];

const SIMPLE_COLOR = "#27272a"; // zinc-800 — barre solo (1 source / étape)

interface SeriesMeta {
  label: string;
  color: string;
}

/** Met en forme un nombre fr (1 234) — Intl pour respecter le séparateur. */
function fmtNum(v: unknown): string {
  if (typeof v !== "number") return String(v);
  return v.toLocaleString("fr-FR");
}

export function FunnelChart({ steps }: { steps: ComputedStep[] }) {
  if (steps.length === 0) return null;

  // Détection : au moins une étape cumule plusieurs refs available → stacked
  const hasCumul = steps.some(
    (s) => s.refs.filter((r) => r.available).length > 1
  );

  // Collecte les sources distinctes (par label) à travers toutes les
  // étapes, en gardant l'ordre d'apparition. En mode simple on n'a qu'une
  // série synthétique "count" avec la couleur unique zinc.
  let series: SeriesMeta[];
  if (hasCumul) {
    series = [];
    const seen = new Set<string>();
    for (const s of steps) {
      for (const r of s.refs) {
        if (!r.available || seen.has(r.label)) continue;
        seen.add(r.label);
        series.push({
          label: r.label,
          color: STACK_COLORS[series.length % STACK_COLORS.length],
        });
      }
    }
  } else {
    series = [{ label: "Volume", color: SIMPLE_COLOR }];
  }

  // Data : 1 ligne par étape. Le `label` sert d'axe X. Chaque clé série
  // = volume de cette source dans cette étape (ou 0 si absent).
  type Row = { label: string; __total__: number } & Record<
    string,
    number | string
  >;
  const data: Row[] = steps.map((s, i) => {
    const row: Row = {
      label: `${i + 1}. ${compactStepLabel(s)}`,
      __total__: s.count,
    };
    if (hasCumul) {
      for (const ser of series) {
        const ref = s.refs.find(
          (r) => r.available && r.label === ser.label
        );
        row[ser.label] = ref ? ref.count : 0;
      }
    } else {
      row.Volume = s.count;
    }
    return row;
  });

  return (
    <div className="w-full">
      <BarChart
        data={data}
        xDataKey="label"
        stacked={hasCumul}
        stackGap={hasCumul ? 2 : 0}
        barGap={0.3}
        margin={{ top: 36, right: 24, bottom: 56, left: 56 }}
        aspectRatio="16 / 7"
        animationDuration={900}
      >
        <Grid horizontal fadeHorizontal={false} />
        <BarYAxis />
        {series.map((ser) => (
          <Bar
            key={ser.label}
            dataKey={ser.label}
            fill={ser.color}
            lineCap={4}
            animationType="grow"
          />
        ))}
        <BarXAxis showAllLabels tickerHalfWidth={70} />
        <ChartTooltip
          showDots={false}
          rows={(point) => {
            if (!hasCumul) {
              return [
                {
                  color: SIMPLE_COLOR,
                  label: "Volume",
                  value: fmtNum(point.Volume),
                },
              ];
            }
            // Stacked : ligne par série non-zéro, triée par valeur desc.
            const rows = series
              .map((ser) => ({
                color: ser.color,
                label: ser.label,
                value: Number(point[ser.label] ?? 0),
              }))
              .filter((r) => r.value > 0)
              .sort((a, b) => b.value - a.value)
              .map((r) => ({
                ...r,
                value: fmtNum(r.value),
              }));
            const total = Number(point.__total__ ?? 0);
            // Ligne "Total" en tête, séparée visuellement par sa couleur
            // neutre (gris) et son label en gras (cf. TooltipContent qui
            // utilise du gras sur la valeur uniquement, mais le label
            // "Total" en gris distingue).
            return [
              { color: "#71717a", label: "Total", value: fmtNum(total) },
              ...rows,
            ];
          }}
        />
      </BarChart>
    </div>
  );
}
