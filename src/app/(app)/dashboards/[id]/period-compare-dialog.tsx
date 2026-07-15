"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type {
  ComputedDashboardData,
  ComputedStep,
  DashboardType,
} from "@/lib/dashboards/types";
import { compactStepLabel } from "@/lib/dashboards/types";
import {
  computeMonths,
  computeQuarters,
  type Range,
} from "@/lib/dashboards/period-presets";
import { PieChartViz } from "./pie-chart";
import { FunnelChart } from "./funnel-chart";

type Mode = "months" | "quarters" | "manual";

export function PeriodCompareDialog({
  dashboardId,
  type,
  open,
  onOpenChange,
}: {
  dashboardId: string;
  type: DashboardType;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>("months");
  const seed = computeMonths();
  const [pA, setPA] = useState<Range>(seed.A);
  const [pB, setPB] = useState<Range>(seed.B);
  const [dataA, setDataA] = useState<ComputedDashboardData | null>(null);
  const [dataB, setDataB] = useState<ComputedDashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  function applyMode(m: Mode) {
    setMode(m);
    if (m === "months") {
      const r = computeMonths();
      setPA(r.A);
      setPB(r.B);
    } else if (m === "quarters") {
      const r = computeQuarters();
      setPA(r.A);
      setPB(r.B);
    }
    // manual : on garde les valeurs courantes, éditables.
  }

  async function fetchRange(r: Range): Promise<ComputedDashboardData> {
    const qp = new URLSearchParams({
      preset: "custom",
      from: r.from,
      to: r.to,
    });
    const res = await fetch(`/api/dashboards/${dashboardId}/data?${qp}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as ComputedDashboardData;
  }

  async function compare() {
    if (!pA.from || !pA.to || !pB.from || !pB.to) {
      toast.error("Renseigne les deux périodes.");
      return;
    }
    setLoading(true);
    try {
      const [a, b] = await Promise.all([fetchRange(pA), fetchRange(pB)]);
      setDataA(a);
      setDataB(b);
    } catch {
      toast.error("Erreur de chargement de la comparaison");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col sm:!max-w-5xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Comparer deux périodes</DialogTitle>
        </DialogHeader>

        {/* Contrôles (mode + périodes), figés en haut. */}
        <div className="shrink-0 space-y-3 border-b pb-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <ModeBtn active={mode === "months"} onClick={() => applyMode("months")}>
              2 derniers mois
            </ModeBtn>
            <ModeBtn
              active={mode === "quarters"}
              onClick={() => applyMode("quarters")}
            >
              Derniers trimestres
            </ModeBtn>
            <ModeBtn active={mode === "manual"} onClick={() => applyMode("manual")}>
              Manuel
            </ModeBtn>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RangePicker
              title="Période A (récente)"
              range={pA}
              onChange={setPA}
              disabled={mode !== "manual"}
              onEnter={compare}
            />
            <RangePicker
              title="Période B (précédente)"
              range={pB}
              onChange={setPB}
              disabled={mode !== "manual"}
              onEnter={compare}
            />
          </div>
          <Button onClick={compare} disabled={loading} size="sm">
            {loading ? "Comparaison…" : "Comparer"}
          </Button>
        </div>

        {/* Résultats, scrollables. */}
        <div className="flex-1 overflow-auto pt-3">
          {dataA && dataB ? (
            <ComparisonResult
              type={type}
              dataA={dataA}
              dataB={dataB}
              rangeA={pA}
              rangeB={pB}
            />
          ) : (
            <p className="text-zinc-500 text-sm py-10 text-center">
              Choisis les deux périodes puis clique « Comparer » (ou Entrée).
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded border ${
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}

function RangePicker({
  title,
  range,
  onChange,
  disabled,
  onEnter,
}: {
  title: string;
  range: Range;
  onChange: (r: Range) => void;
  disabled: boolean;
  onEnter: () => void;
}) {
  return (
    <div className="border rounded p-2 space-y-1.5">
      <p className="text-[11px] uppercase text-zinc-500 font-semibold tracking-wide">
        {title}
      </p>
      <div className="flex items-end gap-2">
        <div className="space-y-0.5">
          <Label className="text-[10px]">Du</Label>
          <Input
            type="date"
            value={range.from}
            disabled={disabled}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEnter();
            }}
            className="h-8 w-36 text-sm"
          />
        </div>
        <div className="space-y-0.5">
          <Label className="text-[10px]">Au</Label>
          <Input
            type="date"
            value={range.to}
            disabled={disabled}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEnter();
            }}
            className="h-8 w-36 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

function ComparisonResult({
  type,
  dataA,
  dataB,
  rangeA,
  rangeB,
}: {
  type: DashboardType;
  dataA: ComputedDashboardData;
  dataB: ComputedDashboardData;
  rangeA: Range;
  rangeB: Range;
}) {
  // Les deux jeux ont les mêmes étapes/parts (même tableau) : on aligne par
  // position. On garde le max des deux au cas où une étape synthétique
  // (launch/failed) n'existe que d'un côté (peu probable mais robuste).
  const n = Math.max(dataA.steps.length, dataB.steps.length);
  const rows: {
    label: string;
    a: number;
    b: number;
  }[] = [];
  for (let i = 0; i < n; i++) {
    const a = dataA.steps[i] as ComputedStep | undefined;
    const b = dataB.steps[i] as ComputedStep | undefined;
    const ref = a ?? b;
    if (!ref) continue;
    rows.push({
      label: compactStepLabel(ref),
      a: a?.count ?? 0,
      b: b?.count ?? 0,
    });
  }

  return (
    <div className="space-y-5">
      {/* Deux graphes côte à côte. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCol
          type={type}
          steps={dataA.steps}
          title="Période A (récente)"
          range={rangeA}
        />
        <ChartCol
          type={type}
          steps={dataB.steps}
          title="Période B (précédente)"
          range={rangeB}
        />
      </div>

      {/* Tableau comparatif avec colonne d'écart. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500 border-b">
            <tr>
              <th className="py-2 pr-4">{type === "pie" ? "Part" : "Étape"}</th>
              <th className="py-2 pr-4 text-right">Période A</th>
              <th className="py-2 pr-4 text-right">Période B</th>
              <th className="py-2 pr-4 text-right">Δ</th>
              <th className="py-2 pr-4 text-right">Δ %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const delta = r.a - r.b;
              const pct = r.b > 0 ? (delta / r.b) * 100 : null;
              const color =
                delta > 0
                  ? "text-emerald-600"
                  : delta < 0
                    ? "text-red-600"
                    : "text-zinc-400";
              return (
                <tr key={i} className="border-b">
                  <td className="py-1.5 pr-4">{r.label}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">
                    {r.a.toLocaleString("fr-FR")}
                  </td>
                  <td className="py-1.5 pr-4 text-right tabular-nums text-zinc-500">
                    {r.b.toLocaleString("fr-FR")}
                  </td>
                  <td
                    className={`py-1.5 pr-4 text-right tabular-nums font-medium ${color}`}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toLocaleString("fr-FR")}
                  </td>
                  <td className={`py-1.5 pr-4 text-right tabular-nums ${color}`}>
                    {pct === null
                      ? "—"
                      : `${pct > 0 ? "+" : ""}${pct.toFixed(1)} %`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartCol({
  type,
  steps,
  title,
  range,
}: {
  type: DashboardType;
  steps: ComputedStep[];
  title: string;
  range: Range;
}) {
  return (
    <div className="border rounded-lg p-3 bg-white space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold text-zinc-700">{title}</p>
        <p className="text-[11px] text-zinc-400">
          {range.from} → {range.to}
        </p>
      </div>
      {steps.length === 0 ? (
        <p className="text-xs text-zinc-400 py-8 text-center">
          Aucune donnée sur cette période.
        </p>
      ) : type === "pie" ? (
        <PieChartViz steps={steps} />
      ) : (
        <FunnelChart steps={steps} />
      )}
    </div>
  );
}
