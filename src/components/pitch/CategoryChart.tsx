"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { CategoryBreakdown } from "@/server/actions/pitch-stats";

const COLORS = ["#38BDF8", "#818CF8", "#34D399", "#FBBF24", "#F87171", "#A78BFA", "#FB923C", "#60A5FA"];

interface CategoryChartProps {
  data: CategoryBreakdown[];
}

export function CategoryChart({ data }: CategoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm" style={{ color: "#64748B" }}>
        No project data loaded yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -22 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: "#64748B", fontSize: 9 }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fill: "#64748B", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "#0D1B35",
            border: "1px solid #1E3460",
            borderRadius: 8,
            color: "#F1F5F9",
            fontSize: 12,
            padding: "8px 12px",
          }}
          cursor={{ fill: "#1E3460" }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
