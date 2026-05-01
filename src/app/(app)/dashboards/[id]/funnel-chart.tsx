"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ComputedStep } from "@/lib/dashboards/types";

const COLORS = ["#27272a", "#3f3f46", "#52525b", "#71717a", "#a1a1aa", "#d4d4d8"];

export function FunnelChart({ steps }: { steps: ComputedStep[] }) {
  if (steps.length === 0) return null;
  const data = steps.map((s, i) => ({
    label: `${i + 1}. ${s.label}`,
    count: s.count,
    available: s.available,
  }));
  return (
    <div className="w-full" style={{ height: Math.max(160, steps.length * 48) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ left: 0, right: 40 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={180}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(v: unknown) => [String(v), "Volume"]}
            cursor={{ fill: "#fafafa" }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11 }}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.available ? COLORS[Math.min(i, COLORS.length - 1)] : "#e4e4e7"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
