"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Session {
  startedAt: string;
  cardsReviewed: number;
  correctCount: number;
}

export function AccuracyChart({ sessions }: { sessions: Session[] }) {
  const data = sessions.map((s) => ({
    date: new Date(s.startedAt).toLocaleDateString("de-DE", { month: "short", day: "numeric" }),
    accuracy: s.cardsReviewed > 0 ? Math.round((s.correctCount / s.cardsReviewed) * 100) : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip formatter={(v) => [`${v}%`, "Accuracy"]} />
        <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
