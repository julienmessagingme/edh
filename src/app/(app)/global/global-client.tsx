"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { SubNavStats } from "../sub-nav-stats";
import { useScope } from "../scope-context";
import {
  getSchoolBySlug,
  EDH_SCOPE_NAME,
  EDH_GROUP_LOGO,
} from "@/lib/schools";
import type { ComputedDashboardData } from "@/lib/dashboards/types";
import { compactStepLabel } from "@/lib/dashboards/types";
import type { CampaignListItem } from "@/lib/campaigns/types";
import {
  type Range,
  lastNDays,
  computeMonths,
  computeQuarters,
} from "@/lib/dashboards/period-presets";
import {
  exportGlobalReportToPDF,
  formatPct,
  type GlobalReportFunnel,
  type GlobalReportLine,
} from "@/lib/dashboards/global-export";

type CompareMode = "months" | "quarters" | "manual";
type SinglePreset = "7" | "30" | "90" | "manual";

/**
 * Construit le rapport texte d'un funnel à partir des données calculées.
 * - Si la campagne a un event de lancement : lignes Envois / Échecs / Envois nets.
 * - Puis 1 ligne par étape (body steps, hors synthétiques launch/failed).
 * `dataB` non-null ⇒ mode comparaison (chaque ligne porte aussi sa valeur B).
 */
/** v / base × 100, ou null si base nulle (division impossible). */
function pctOf(v: number, base: number): number | null {
  return base > 0 ? (v / base) * 100 : null;
}

function buildFunnel(
  c: CampaignListItem,
  dataA: ComputedDashboardData,
  dataB: ComputedDashboardData | null
): GlobalReportFunnel {
  const cmp = dataB != null;
  const lines: GlobalReportLine[] = [];
  const sumA = dataA.campaign_summary ?? null;
  const sumB = dataB?.campaign_summary ?? null;
  const hasLaunch = !!sumA?.launch;

  const envoisA = sumA?.launch?.count ?? 0;
  const envoisB = sumB?.launch?.count ?? 0;
  const netA = sumA?.net_count ?? 0;
  const netB = sumB?.net_count ?? 0;

  const bodyA = dataA.steps.filter((s) => !s.synth_role);
  const bodyB = dataB ? dataB.steps.filter((s) => !s.synth_role) : [];

  // Base des % du corps du funnel : les envois hors échecs (net) deviennent le
  // 100 % des étapes. Si le funnel n'a pas de lancement, on retombe sur la 1re
  // étape comme base.
  const baseA = hasLaunch ? netA : bodyA[0]?.count ?? 0;
  const baseB = hasLaunch ? netB : bodyB[0]?.count ?? 0;

  if (sumA?.launch) {
    lines.push({
      label: "Nombre d'envois",
      kind: "envois",
      a: envoisA,
      b: cmp ? envoisB : null,
      pctA: envoisA > 0 ? 100 : null,
      pctB: cmp ? (envoisB > 0 ? 100 : null) : null,
    });
    if (sumA.failed) {
      const echA = sumA.failed.count;
      const echB = sumB?.failed?.count ?? 0;
      lines.push({
        label: "Échecs WhatsApp",
        kind: "echec",
        a: echA,
        b: cmp ? echB : null,
        pctA: pctOf(echA, envoisA),
        pctB: cmp ? pctOf(echB, envoisB) : null,
      });
    }
    lines.push({
      label: "Envois hors échecs",
      kind: "net",
      a: netA,
      b: cmp ? netB : null,
      pctA: pctOf(netA, envoisA),
      pctB: cmp ? pctOf(netB, envoisB) : null,
    });
  }

  bodyA.forEach((s, i) => {
    const va = s.count;
    const vb = bodyB[i]?.count ?? 0;
    lines.push({
      label: compactStepLabel(s),
      kind: "step",
      a: va,
      b: cmp ? vb : null,
      pctA: pctOf(va, baseA),
      pctB: cmp ? pctOf(vb, baseB) : null,
    });
  });

  return {
    name: c.name,
    isShared: c.is_shared,
    empty: lines.length === 0,
    lines,
  };
}

export function GlobalClient() {
  const { slug, isEdh } = useScope();
  const school = getSchoolBySlug(slug);
  const schoolName = isEdh ? EDH_SCOPE_NAME : school?.name ?? slug;
  const logoUrl = isEdh ? EDH_GROUP_LOGO : school?.logo ?? "";

  const [items, setItems] = useState<CampaignListItem[]>([]);
  const [reports, setReports] = useState<GlobalReportFunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [compareOn, setCompareOn] = useState(false);
  const [mode, setMode] = useState<CompareMode>("months");
  const [preset, setPreset] = useState<SinglePreset>("30");
  const [pA, setPA] = useState<Range>(() => lastNDays(30));
  const [pB, setPB] = useState<Range>(() => computeMonths().B);

  // Garde-fou anti-course : des clics de période rapides lancent plusieurs
  // `compute` concurrents ; seul le plus récent a le droit d'écrire l'état
  // (sinon un calcul lent résolu en dernier réafficherait une période périmée).
  const runIdRef = useRef(0);

  const fetchData = useCallback(
    async (dashId: string, r: Range): Promise<ComputedDashboardData> => {
      const qp = new URLSearchParams({
        preset: "custom",
        from: r.from,
        to: r.to,
      });
      const res = await fetch(`/api/dashboards/${dashId}/data?${qp}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as ComputedDashboardData;
    },
    []
  );

  const compute = useCallback(
    async (list: CampaignListItem[], a: Range, b: Range, cmp: boolean) => {
      const rid = ++runIdRef.current;
      setLoading(true);
      try {
        const built = await Promise.all(
          list.map(async (c) => {
            try {
              const dataA = await fetchData(c.dashboard_id!, a);
              const dataB = cmp ? await fetchData(c.dashboard_id!, b) : null;
              return buildFunnel(c, dataA, dataB);
            } catch {
              return {
                name: c.name,
                isShared: c.is_shared,
                empty: true,
                lines: [],
              } as GlobalReportFunnel;
            }
          })
        );
        if (runIdRef.current === rid) setReports(built);
      } finally {
        if (runIdRef.current === rid) setLoading(false);
      }
    },
    [fetchData]
  );

  // Chargement initial : liste des funnels (scope courant via cookie) puis
  // calcul sur la période par défaut (30 derniers jours, sans comparaison).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/campaigns", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { campaigns: CampaignListItem[] };
        const list = (j.campaigns ?? [])
          .filter((c) => c.dashboard_id)
          .sort((a, b) => a.name.localeCompare(b.name, "fr"));
        if (cancelled) return;
        setItems(list);
        await compute(list, lastNDays(30), computeMonths().B, false);
      } catch {
        if (!cancelled) {
          toast.error("Erreur de chargement");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySingle(days: 7 | 30 | 90) {
    const r = lastNDays(days);
    setCompareOn(false);
    setPreset(String(days) as SinglePreset);
    setPA(r);
    void compute(items, r, pB, false);
  }
  function enableManualSingle() {
    setCompareOn(false);
    setPreset("manual");
  }
  function toggleCompare(on: boolean) {
    if (on) {
      const m = computeMonths();
      setCompareOn(true);
      setMode("months");
      setPA(m.A);
      setPB(m.B);
      void compute(items, m.A, m.B, true);
    } else {
      const r = lastNDays(30);
      setCompareOn(false);
      setPreset("30");
      setPA(r);
      void compute(items, r, pB, false);
    }
  }
  function applyMode(m: CompareMode) {
    setMode(m);
    if (m === "months") {
      const r = computeMonths();
      setPA(r.A);
      setPB(r.B);
      void compute(items, r.A, r.B, true);
    } else if (m === "quarters") {
      const r = computeQuarters();
      setPA(r.A);
      setPB(r.B);
      void compute(items, r.A, r.B, true);
    }
    // manual : on garde les valeurs courantes, l'utilisateur clique Actualiser.
  }
  function refresh() {
    void compute(items, pA, pB, compareOn);
  }

  async function onExport() {
    setExporting(true);
    try {
      await exportGlobalReportToPDF(
        {
          schoolName,
          logoUrl,
          compare: compareOn,
          rangeA: pA,
          rangeB: compareOn ? pB : null,
        },
        reports
      );
    } catch {
      toast.error("Erreur lors de l'export PDF");
    } finally {
      setExporting(false);
    }
  }

  const nothing = !loading && reports.length === 0;

  return (
    <div className="space-y-4">
      <Toaster richColors position="top-right" />
      <header className="flex justify-between items-center">
        <SubNavStats />
        <Button
          onClick={onExport}
          disabled={exporting || loading || reports.length === 0}
        >
          <Download className="h-4 w-4 mr-1.5" />
          {exporting ? "Export…" : "Exporter en PDF"}
        </Button>
      </header>

      <div>
        <h2 className="text-xl font-semibold">Rapport global</h2>
        <p className="text-sm text-zinc-500">
          Tous les funnels de {schoolName}, en texte, avec pour chaque étape
          le volume. Choisissez la période et comparez si besoin.
        </p>
      </div>

      {/* Contrôles période / comparaison */}
      <div className="border rounded-lg p-3 space-y-3">
        {!compareOn ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase text-zinc-500 font-semibold tracking-wide mr-1">
              Période
            </span>
            <Seg active={preset === "7"} onClick={() => applySingle(7)}>
              7 jours
            </Seg>
            <Seg active={preset === "30"} onClick={() => applySingle(30)}>
              30 jours
            </Seg>
            <Seg active={preset === "90"} onClick={() => applySingle(90)}>
              90 jours
            </Seg>
            <Seg active={preset === "manual"} onClick={enableManualSingle}>
              Manuel
            </Seg>
            <span className="mx-1 h-5 w-px bg-zinc-200" />
            <Seg active={false} onClick={() => toggleCompare(true)}>
              Comparer les périodes
            </Seg>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase text-zinc-500 font-semibold tracking-wide mr-1">
              Comparer
            </span>
            <Seg active={mode === "months"} onClick={() => applyMode("months")}>
              2 derniers mois
            </Seg>
            <Seg
              active={mode === "quarters"}
              onClick={() => applyMode("quarters")}
            >
              Derniers trimestres
            </Seg>
            <Seg active={mode === "manual"} onClick={() => applyMode("manual")}>
              Manuel
            </Seg>
            <span className="mx-1 h-5 w-px bg-zinc-200" />
            <Seg active={false} onClick={() => toggleCompare(false)}>
              Période simple
            </Seg>
          </div>
        )}

        {!compareOn && preset === "manual" && (
          <div className="flex items-end gap-2">
            <DateField
              label="Du"
              value={pA.from}
              onChange={(v) => setPA({ ...pA, from: v })}
              onEnter={refresh}
            />
            <DateField
              label="Au"
              value={pA.to}
              onChange={(v) => setPA({ ...pA, to: v })}
              onEnter={refresh}
            />
            <Button size="sm" onClick={refresh}>
              Actualiser
            </Button>
          </div>
        )}

        {compareOn && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <RangeBox
              title="Période A (récente)"
              range={pA}
              onChange={setPA}
              disabled={mode !== "manual"}
              onEnter={refresh}
            />
            <RangeBox
              title="Période B (précédente)"
              range={pB}
              onChange={setPB}
              disabled={mode !== "manual"}
              onEnter={refresh}
            />
            {mode === "manual" && (
              <div className="sm:col-span-2">
                <Button size="sm" onClick={refresh}>
                  Actualiser
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-zinc-500">
          {compareOn
            ? `A : du ${pA.from} au ${pA.to}   ·   B : du ${pB.from} au ${pB.to}`
            : `du ${pA.from} au ${pA.to}`}
        </p>
      </div>

      {loading ? (
        <p className="text-zinc-500">Chargement…</p>
      ) : nothing ? (
        <p className="text-zinc-500">Aucun funnel dans cette école.</p>
      ) : (
        <div className="space-y-4">
          {reports.map((f, i) => (
            <FunnelFrame key={i} f={f} compare={compareOn} />
          ))}
        </div>
      )}
    </div>
  );
}

function Seg({
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
      className={`px-2.5 py-1 rounded border text-xs ${
        active
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}

function DateField({
  label,
  value,
  onChange,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px]">{label}</Label>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter();
        }}
        className="h-8 w-36 text-sm"
      />
    </div>
  );
}

function RangeBox({
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

function FunnelFrame({
  f,
  compare,
}: {
  f: GlobalReportFunnel;
  compare: boolean;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-zinc-100 px-4 py-2.5 flex items-center gap-2 border-b">
        <h3 className="font-semibold text-zinc-800 truncate">{f.name}</h3>
        {f.isShared && (
          <span className="text-[10px] uppercase tracking-wide text-zinc-500 border border-zinc-300 rounded px-1.5 py-0.5">
            Partagé
          </span>
        )}
      </div>

      {f.empty ? (
        <p className="px-4 py-3 text-sm text-zinc-400 italic">
          Funnel vide (aucune étape).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase text-zinc-400 border-b">
                <th className="py-2 px-4 font-medium">Ligne</th>
                {compare ? (
                  <>
                    <th className="py-2 px-3 text-right font-medium">A</th>
                    <th className="py-2 px-3 text-right font-medium">B</th>
                    <th className="py-2 px-3 text-right font-medium">Δ</th>
                    <th className="py-2 px-4 text-right font-medium">Δ %</th>
                  </>
                ) : (
                  <>
                    <th className="py-2 px-3 text-right font-medium">
                      Quantité
                    </th>
                    <th className="py-2 px-4 text-right font-medium">%</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {f.lines.map((l, i) => (
                <ReportRow key={i} line={l} compare={compare} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReportRow({
  line,
  compare,
}: {
  line: GlobalReportLine;
  compare: boolean;
}) {
  const strong = line.kind === "envois" || line.kind === "net";
  const labelClass =
    line.kind === "echec"
      ? "text-red-600"
      : line.kind === "step"
        ? "text-zinc-700 pl-8"
        : "text-zinc-900 font-medium";
  const countClass =
    line.kind === "echec"
      ? "text-red-600"
      : strong
        ? "text-zinc-900 font-medium"
        : "text-zinc-700";

  const delta = line.b == null ? null : line.a - line.b;
  const deltaColor =
    delta == null || delta === 0
      ? "text-zinc-400"
      : delta > 0
        ? "text-emerald-600"
        : "text-red-600";
  const deltaPct =
    line.b == null
      ? ""
      : line.b > 0
        ? `${delta! > 0 ? "+" : ""}${((delta! / line.b) * 100).toFixed(1)} %`
        : "n/a";

  if (!compare) {
    return (
      <tr className="border-b last:border-0">
        <td className={`py-1.5 px-4 ${labelClass}`}>{line.label}</td>
        <td className={`py-1.5 px-3 text-right tabular-nums ${countClass}`}>
          {line.a.toLocaleString("fr-FR")}
        </td>
        <td className="py-1.5 px-4 text-right tabular-nums text-xs text-zinc-400">
          {formatPct(line.pctA)}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b last:border-0 align-top">
      <td className={`py-1.5 px-4 ${labelClass}`}>{line.label}</td>
      <td className={`py-1.5 px-3 text-right ${countClass}`}>
        <div className="tabular-nums">{line.a.toLocaleString("fr-FR")}</div>
        <div className="text-[11px] text-zinc-400 tabular-nums">
          {formatPct(line.pctA)}
        </div>
      </td>
      <td className="py-1.5 px-3 text-right text-zinc-500">
        <div className="tabular-nums">
          {line.b == null ? "" : line.b.toLocaleString("fr-FR")}
        </div>
        <div className="text-[11px] text-zinc-400 tabular-nums">
          {formatPct(line.pctB)}
        </div>
      </td>
      <td
        className={`py-1.5 px-3 text-right tabular-nums font-medium ${deltaColor}`}
      >
        {delta == null
          ? ""
          : `${delta > 0 ? "+" : ""}${delta.toLocaleString("fr-FR")}`}
      </td>
      <td className={`py-1.5 px-4 text-right tabular-nums ${deltaColor}`}>
        {deltaPct}
      </td>
    </tr>
  );
}
