"use client";

import { PieChart, Pie, Cell } from "recharts";
import {
  BarChart,
  Bar,
  Grid,
  BarXAxis,
  ChartTooltip,
} from "@/components/ui/bar-chart";
import type { ComputedStep } from "@/lib/dashboards/types";
import { compactStepLabel } from "@/lib/dashboards/types";

/** 1 couleur stable par CUSTOM EVENT (identifié par son label) à travers
 *  toutes les étapes. Si le même event apparaît dans 2 barres, il a la
 *  même couleur dans les 2 (volontaire — on voit que c'est le même).
 *
 *  Palette 12 vraies couleurs distinctes (aucun gris/noir dominant) pour
 *  qu'aucun event ne se fonde dans un fond neutre. Espacées sur le wheel
 *  chromatique (~30°). À partir du 13ème event distinct, on cycle. */
const EVENT_COLORS = [
  "#7c3aed", // violet-600
  "#0284c7", // sky-600
  "#16a34a", // green-600
  "#ea580c", // orange-600
  "#dc2626", // red-600
  "#facc15", // yellow-400
  "#0d9488", // teal-600
  "#ec4899", // pink-500
  "#c026d3", // fuchsia-600
  "#65a30d", // lime-600
  "#0891b2", // cyan-600
  "#a16207", // yellow-700
];

/** Met en forme un nombre fr (1 234). */
function fmtNum(v: unknown): string {
  if (typeof v !== "number") return String(v);
  return v.toLocaleString("fr-FR");
}

/** Couleur fixe pour le segment "Échec WhatsApp" : rouge contrast, jamais
 *  réutilisée pour d'autres events (pour qu'on reconnaisse au coup d'œil
 *  la part d'envois ratés dans la barre du Lancement). */
const FAILED_COLOR = "#dc2626"; // red-600
const FAILED_SERIES_LABEL = "Échec WhatsApp";

export function FunnelChart({ steps: rawSteps }: { steps: ComputedStep[] }) {
  if (rawSteps.length === 0) return null;
  const failedStep = rawSteps.find((s) => s.synth_role === "failed") ?? null;
  // Le step "Échec" synthétique ne s'affiche pas comme une barre séparée :
  // il est splitté dans la barre du Lancement en 2 segments stackés
  // (net + failed) pour visualiser la part d'envois ratés.
  const steps = rawSteps.filter((s) => s.synth_role !== "failed");
  if (steps.length === 0) return null;

  // Collecte les events distincts (par label) à travers toutes les étapes,
  // dans l'ordre d'apparition. Chacun gagne une couleur stable. On exclut
  // les events de la barre Lancement si on va la splitter en net/failed
  // (sinon on aurait une série en double avec le label original du launch).
  const willSplitLaunch =
    failedStep !== null && failedStep.available && failedStep.count > 0;
  type Series = { label: string; color: string };
  const series: Series[] = [];
  const seen = new Set<string>();
  for (const s of steps) {
    if (willSplitLaunch && s.synth_role === "launch") continue;
    for (const r of s.refs) {
      if (!r.available || seen.has(r.label)) continue;
      seen.add(r.label);
      series.push({
        label: r.label,
        color: EVENT_COLORS[series.length % EVENT_COLORS.length],
      });
    }
  }
  // Si on split la barre Lancement, on ajoute 2 séries dédiées : net (couleur
  // du Lancement violet par défaut) + failed (rouge).
  if (willSplitLaunch) {
    const launchStep = steps.find((s) => s.synth_role === "launch");
    const netLabel = launchStep
      ? launchStep.refs.length > 1
        ? "Envois réussis (cumul lancement)"
        : `Envois réussis (${launchStep.refs[0]?.label ?? "Lancement"})`
      : "Envois réussis";
    // Série net en tête → tracée AU-DESSUS du failed dans la pile
    // (le 1er ajouté est rendu en bas). On veut le rouge en bas, le net dessus.
    series.unshift({ label: FAILED_SERIES_LABEL, color: FAILED_COLOR });
    series.unshift({ label: netLabel, color: EVENT_COLORS[0] });
    seen.add(netLabel);
    seen.add(FAILED_SERIES_LABEL);
  }
  // Cas dégénéré : aucun event available → on rend quand même quelque
  // chose pour éviter un chart vide cryptique.
  if (series.length === 0) {
    series.push({ label: "(vide)", color: EVENT_COLORS[0] });
  }

  // Data : 1 ligne par étape, 1 colonne par série + __total__ pour le
  // tooltip. Les colonnes série absentes d'une étape sont à 0.
  type Row = { label: string; __total__: number } & Record<
    string,
    number | string
  >;
  // Tronque les labels du chart à ~24 chars pour éviter le chevauchement
  // sur l'axe X quand un step porte un nom long.
  const truncate = (s: string, max = 24): string =>
    s.length <= max ? s : s.slice(0, max - 1) + "…";

  const data: Row[] = steps.map((s, i) => {
    const row: Row = {
      label: `${i + 1}. ${truncate(compactStepLabel(s))}`,
      __total__: s.count,
    };
    for (const ser of series) {
      // Cas spécial : barre Lancement splittée en net/failed.
      if (willSplitLaunch && s.synth_role === "launch" && failedStep) {
        if (ser.label === FAILED_SERIES_LABEL) {
          row[ser.label] = failedStep.count;
          continue;
        }
        // La série "Envois réussis (…)" porte le net = launch - failed.
        if (ser.label.startsWith("Envois réussis")) {
          row[ser.label] = Math.max(0, s.count - failedStep.count);
          continue;
        }
        row[ser.label] = 0;
        continue;
      }
      const ref = s.refs.find(
        (r) => r.available && r.label === ser.label
      );
      row[ser.label] = ref ? ref.count : 0;
    }
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
        margin={{ top: 36, right: 24, bottom: 76, left: 24 }}
        aspectRatio="16 / 7"
        animationDuration={900}
      >
        <Grid horizontal fadeHorizontal={false} />
        {series.map((ser) => (
          <Bar
            key={ser.label}
            dataKey={ser.label}
            fill={ser.color}
            lineCap={4}
            animationType="grow"
          />
        ))}
        <BarXAxis showAllLabels tickerHalfWidth={70} wrap />
        <ChartTooltip
          showDots={false}
          content={({ point }) => {
            const total = Number(point.__total__ ?? 0);
            // Segments présents dans l'étape survolée (volume > 0), triés
            // décroissant. ≥2 sources → mini pie chart de la répartition ;
            // sinon liste simple.
            const slices = series
              .map((ser) => ({
                label: ser.label,
                color: ser.color,
                value: Number(point[ser.label] ?? 0),
              }))
              .filter((s) => s.value > 0)
              .sort((a, b) => b.value - a.value);
            return <StepTooltip total={total} slices={slices} />;
          }}
        />
      </BarChart>
    </div>
  );
}

type Slice = { label: string; color: string; value: number };

/** Contenu du tooltip d'une barre du funnel. Si l'étape cumule ≥2 sources,
 *  on rend un mini PIE CHART de la répartition (demande produit : voir d'un
 *  coup d'œil le poids de chaque source dans le cumul) + une légende chiffrée.
 *  Sinon (0 ou 1 source), simple liste. */
function StepTooltip({ total, slices }: { total: number; slices: Slice[] }) {
  const multi = slices.length >= 2;
  return (
    <div className="space-y-1.5" style={{ minWidth: multi ? 240 : 150 }}>
      <div className="flex items-center justify-between gap-4 text-xs font-medium border-b pb-1">
        <span className="text-zinc-500 uppercase tracking-wide text-[10px]">
          Total
        </span>
        <span className="tabular-nums">{fmtNum(total)}</span>
      </div>
      {multi ? (
        <div className="flex items-center gap-2">
          <PieChart width={112} height={112}>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={52}
              stroke="#fff"
              strokeWidth={1}
              isAnimationActive={false}
            >
              {slices.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
          <ul className="flex-1 space-y-0.5 text-[11px] max-h-[130px] overflow-auto pr-1">
            {slices.map((s, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-sm shrink-0"
                  style={{ background: s.color }}
                />
                <span className="flex-1 truncate max-w-[130px]">{s.label}</span>
                <span className="tabular-nums text-zinc-700">
                  {fmtNum(s.value)}
                </span>
                <span className="tabular-nums text-zinc-400 w-8 text-right">
                  {total > 0 ? `${Math.round((s.value / total) * 100)}%` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="space-y-0.5 text-[11px]">
          {slices.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-sm shrink-0"
                style={{ background: s.color }}
              />
              <span className="flex-1 truncate max-w-[170px]">{s.label}</span>
              <span className="tabular-nums">{fmtNum(s.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
