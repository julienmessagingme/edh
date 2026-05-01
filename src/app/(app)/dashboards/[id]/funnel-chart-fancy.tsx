"use client";

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
 * Drop-in alternative to <FunnelChart> (the bar chart) — same props.
 *
 * Reaviz expects `data: { key: string, data: number }[]`. Empty steps
 * (count = 0) are kept so the funnel keeps its shape ; reaviz collapses
 * zero-data segments to a single line gracefully.
 */
export function FancyFunnelChart({ steps }: { steps: ComputedStep[] }) {
  if (steps.length === 0) return null;

  const data: FunnelDataPoint[] = steps.map((s) => ({
    key: `${s.position + 1}. ${s.label}`,
    data: s.count,
  }));

  return (
    <div className="w-full" style={{ height: Math.max(220, steps.length * 60) }}>
      <FunnelChart
        id="dashboardFunnel"
        height={Math.max(220, steps.length * 60)}
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
                label={
                  <FunnelAxisLabel className="font-medium text-xs fill-zinc-700" />
                }
                line={<FunnelAxisLine strokeColor="#7E7E8F75" />}
              />
            }
          />
        }
      />
    </div>
  );
}
