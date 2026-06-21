"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function ForecastChart({ forecast }: { forecast: number[] }) {
  const days = ["Today", "Tomorrow", "+2d", "+3d", "+4d", "+5d", "+6d"];
  const data = forecast.map((count, i) => ({ day: days[i], cards: count }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [v, "Cards due"]} />
        <Bar dataKey="cards" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
