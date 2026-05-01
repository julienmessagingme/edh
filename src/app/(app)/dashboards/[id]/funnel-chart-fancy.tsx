"use client";

import {
  FunnelChart,
  FunnelSeries,
  FunnelArc,
  FunnelAxis,
  FunnelAxisLabel,
  ChartTooltip,
} from "reaviz";
import type { ComputedStep } from "@/lib/dashboards/types";

interface FunnelDataPoint {
  key: string;
  data: number;
}

/**
 * Reaviz-based funnel chart : trapezoidal shape with purple glow.
 * Labels are not rendered next to the funnel — they appear in a tooltip
 * on hover, for a cleaner visual.
 */
export function FancyFunnelChart({ steps }: { steps: ComputedStep[] }) {
  if (steps.length === 0) return null;

  const data: FunnelDataPoint[] = steps.map((s) => ({
    key: `${s.position + 1}. ${s.label}`,
    data: s.count,
  }));

  const height = Math.max(220, steps.length * 60);

  return (
    <div className="w-full" style={{ height }}>
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
                tooltip={
                  <ChartTooltip
                    content={(d: { x?: string; y?: number; data?: FunnelDataPoint }) => {
                      const label = d?.x ?? d?.data?.key ?? "";
                      const count = d?.y ?? d?.data?.data ?? 0;
                      return (
                        <div className="bg-white border rounded shadow-md px-3 py-2 text-xs text-zinc-900">
                          <div className="font-medium">{label}</div>
                          <div className="tabular-nums">
                            {count.toLocaleString("fr-FR")}
                          </div>
                        </div>
                      );
                    }}
                  />
                }
              />
            }
            axis={
              <FunnelAxis
                label={<FunnelAxisLabel fill="transparent" />}
              />
            }
          />
        }
      />
    </div>
  );
}
