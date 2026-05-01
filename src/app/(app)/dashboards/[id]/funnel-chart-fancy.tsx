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
 * Labels axiaux invisibles (`opacity-0`) — la mise en page est conservée
 * (la zone reste réservée par reaviz) mais aucun texte ne s'affiche. Le
 * `<title>` SVG du conteneur fournit un tooltip de survol natif.
 */
export function FancyFunnelChart({ steps }: { steps: ComputedStep[] }) {
  if (steps.length === 0) return null;

  const data: FunnelDataPoint[] = steps.map((s) => ({
    key: `${s.position + 1}. ${s.label}`,
    data: s.count,
  }));

  const height = Math.max(220, steps.length * 60);

  return (
    <div
      className="w-full"
      style={{ height }}
      title={data
        .map((d) => `${d.key}: ${d.data.toLocaleString("fr-FR")}`)
        .join("\n")}
    >
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
    </div>
  );
}
