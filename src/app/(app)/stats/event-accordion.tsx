"use client";

import { useEffect, useRef, useState } from "react";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

interface DailyPoint {
  day: string;
  count: number;
}

interface RedirectOption {
  id: string;
  name: string;
}

export function EventAccordion({
  ev,
  from,
  to,
}: {
  ev: { event_ns: string; name: string; count: number };
  from: string;
  to: string;
}) {
  const [series, setSeries] = useState<DailyPoint[] | null>(null);
  const [redirects, setRedirects] = useState<RedirectOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clickSeries, setClickSeries] = useState<DailyPoint[] | null>(null);
  const [opened, setOpened] = useState(false);

  // Separate monotonic tokens for the two series so that selecting a
  // redirect doesn't invalidate an in-flight occurrences fetch (and vice
  // versa). Each fetch captures the current value and only writes back if
  // it still matches when the response arrives, preventing a stale
  // selectRedirect response from clobbering fresh data after a range change.
  const seriesToken = useRef(0);
  const clickToken = useRef(0);

  // Initial load when first opened.
  async function loadOnOpen() {
    if (opened) return;
    setOpened(true);
    const [a, b] = await Promise.all([
      fetch(
        `/api/stats/custom-events/${encodeURIComponent(ev.event_ns)}/daily?from=${from}&to=${to}`
      ).then((r) => r.json()),
      fetch("/api/events").then((r) => r.json()),
    ]);
    setSeries(a.series ?? []);
    setRedirects(
      (b.events ?? []).map((e: { id: string; name: string }) => ({
        id: e.id,
        name: e.name,
      }))
    );
  }

  // Reload when range changes (only if already opened).
  useEffect(() => {
    if (!opened) return;
    const sToken = ++seriesToken.current;
    const cToken = ++clickToken.current;
    setSeries(null);
    setClickSeries(null);
    fetch(
      `/api/stats/custom-events/${encodeURIComponent(ev.event_ns)}/daily?from=${from}&to=${to}`
    )
      .then((r) => r.json())
      .then((j) => {
        if (seriesToken.current === sToken) setSeries(j.series ?? []);
      });
    if (selectedId) {
      fetch(
        `/api/stats/clicks/${selectedId}/daily?from=${from}&to=${to}`
      )
        .then((r) => r.json())
        .then((j) => {
          if (clickToken.current === cToken) setClickSeries(j.series ?? []);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function selectRedirect(id: string | null) {
    if (!id) return;
    setSelectedId(id);
    const cToken = ++clickToken.current;
    const j = await fetch(
      `/api/stats/clicks/${id}/daily?from=${from}&to=${to}`
    ).then((r) => r.json());
    if (clickToken.current === cToken) setClickSeries(j.series ?? []);
  }

  const merged = (series ?? []).map((p, i) => ({
    day: p.day,
    occurrences: p.count,
    clicks: clickSeries?.[i]?.count ?? 0,
    ratio:
      clickSeries && p.count > 0
        ? Number((clickSeries[i].count / p.count).toFixed(4))
        : null,
  }));

  const totalOcc = (series ?? []).reduce((s, p) => s + p.count, 0);
  const totalClicks = (clickSeries ?? []).reduce((s, p) => s + p.count, 0);
  const globalRate = totalOcc > 0 ? totalClicks / totalOcc : null;
  const dailyRates = merged
    .map((m) => m.ratio)
    .filter((r): r is number => r != null);
  const avgRate =
    dailyRates.length > 0
      ? dailyRates.reduce((s, r) => s + r, 0) / dailyRates.length
      : null;

  return (
    <AccordionItem
      value={ev.event_ns}
      className="border rounded bg-white"
    >
      <AccordionTrigger
        onClick={loadOnOpen}
        className="px-4 hover:no-underline"
      >
        <div className="flex justify-between w-full pr-2">
          <span className="font-medium">{ev.name}</span>
          <span className="text-zinc-500 text-sm">
            {ev.count} occurrence{ev.count !== 1 ? "s" : ""}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        {!series ? (
          <p className="text-sm text-zinc-500">Chargement…</p>
        ) : series.length === 0 || totalOcc === 0 ? (
          <p className="text-sm text-zinc-500">
            Aucune occurrence sur la période.
          </p>
        ) : (
          <>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={merged}>
                  <XAxis dataKey="day" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="occurrences"
                    fill="#3b82f6"
                    name="Occurrences"
                  />
                  {selectedId && (
                    <Bar dataKey="clicks" fill="#10b981" name="Clics" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-zinc-600">Comparer avec :</span>
              <Select
                value={selectedId ?? ""}
                onValueChange={selectRedirect}
              >
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Sélectionner une URL trackée">
                    {(v: string | null) =>
                      v
                        ? (redirects.find((r) => r.id === v)?.name ?? v)
                        : "Sélectionner une URL trackée"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {redirects.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-zinc-500">
                      Aucune URL trackée pour cette école.
                    </div>
                  ) : (
                    redirects.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedId && clickSeries && (
              <div className="mt-3 space-y-3">
                <div className="text-sm flex gap-4 flex-wrap">
                  <span>
                    Total occurrences : <strong>{totalOcc}</strong>
                  </span>
                  <span>
                    Total clics : <strong>{totalClicks}</strong>
                  </span>
                  <span>
                    Taux global :{" "}
                    <strong>
                      {globalRate != null
                        ? (globalRate * 100).toFixed(1) + "%"
                        : "—"}
                    </strong>
                  </span>
                  <span>
                    Taux moyen quotidien :{" "}
                    <strong>
                      {avgRate != null
                        ? (avgRate * 100).toFixed(1) + "%"
                        : "—"}
                    </strong>
                  </span>
                </div>
                <div className="h-32">
                  <ResponsiveContainer>
                    <LineChart data={merged}>
                      <XAxis dataKey="day" fontSize={10} />
                      <YAxis
                        tickFormatter={(v) =>
                          typeof v === "number"
                            ? `${(v * 100).toFixed(0)}%`
                            : ""
                        }
                        fontSize={10}
                      />
                      <Tooltip
                        formatter={(v) =>
                          typeof v === "number"
                            ? `${(v * 100).toFixed(1)}%`
                            : "—"
                        }
                      />
                      <Line
                        dataKey="ratio"
                        stroke="#a855f7"
                        name="Taux quotidien"
                        connectNulls
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
