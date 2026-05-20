"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
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
    <div className="w-full" style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 24, right: 16, left: 0, bottom: 56 }}
        >
          <CartesianGrid stroke="#f4f4f5" vertical={false} />
          <XAxis
            dataKey="label"
            interval={0}
            angle={-25}
            textAnchor="end"
            height={56}
            tick={{ fontSize: 11, fill: "#52525b" }}
          />
          <YAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#52525b" }}
            width={48}
          />
          <Tooltip
            formatter={(v: unknown) => [String(v), "Volume"]}
            cursor={{ fill: "#fafafa" }}
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            label={{ position: "top", fontSize: 11, fill: "#3f3f46" }}
          >
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
