"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface StatusCount {
  status: string;
  _count: { status: number };
}

const COLORS: Record<string, string> = {
  NEW: "#94a3b8",
  LEARNING: "#f59e0b",
  REVIEW: "#3b82f6",
  MASTERED: "#22c55e",
};

export function ProgressDoughnut({ statusCounts }: { statusCounts: StatusCount[] }) {
  const data = statusCounts.map((s) => ({
    name: s.status,
    value: s._count.status,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label>
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name] ?? "#888"} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
