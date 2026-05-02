"use client";

import { useState } from "react";
import {
  FunnelChart,
  FunnelSeries,
  FunnelArc,
  FunnelAxis,
  FunnelAxisLabel,
  FunnelAxisLine,
} from "reaviz";
import type { ComputedStep } from "@/lib/dashboards/types";

interface FunnelDataPoint {
  key: string;
  data: number;
}

/**
 * Reaviz-based funnel chart : trapezoidal shape with purple glow.
 * Labels axiaux invisibles. Tooltip custom au survol via overlay HTML
 * (N bandes horizontales `flex-1` qui matchent les tranches du funnel
 * — reaviz alloue 1/N de la hauteur par étape).
 */
export function FancyFunnelChart({ steps }: { steps: ComputedStep[] }) {
  const [hovered, setHovered] = useState<
    { index: number; x: number; y: number } | null
  >(null);

  if (steps.length === 0) return null;

  const data: FunnelDataPoint[] = steps.map((s) => ({
    key: `${s.position + 1}. ${s.label}`,
    data: s.count,
  }));

  const height = Math.max(220, steps.length * 60);

  return (
    <div className="w-full relative" style={{ height }}>
      <FunnelChart
        id="dashboardFunnel"
        height={height}
        data={data}
        series={
          <FunnelSeries
            arc={
              <FunnelArc
                colorScheme={["#5B14C5"]}
                gradient={null}
                glow={{
                  blur: 30,
                  color: "#5B14C5",
                }}
              />
            }
            axis={
              <FunnelAxis
                label={<FunnelAxisLabel className="opacity-0" />}
                line={<FunnelAxisLine strokeColor="#7E7E8F75" />}
              />
            }
          />
        }
      />

      {/* Hover overlay : une bande par étape, au-dessus du SVG. */}
      <div className="absolute inset-0 flex flex-col">
        {data.map((d, i) => (
          <div
            key={`${i}-${d.key}`}
            className="flex-1"
            onMouseMove={(e) =>
              setHovered({ index: i, x: e.clientX, y: e.clientY })
            }
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </div>

      {hovered && (
        <div
          className="fixed z-50 bg-white border rounded shadow-md px-3 py-2 text-xs text-zinc-900 pointer-events-none"
          style={{ left: hovered.x + 12, top: hovered.y + 12 }}
        >
          <div className="font-medium">{data[hovered.index].key}</div>
          <div className="tabular-nums">
            {data[hovered.index].data.toLocaleString("fr-FR")}
          </div>
        </div>
      )}
    </div>
  );
}
