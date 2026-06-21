"use client";

interface ActivityDay {
  startedAt: string;
  _sum: { cardsReviewed: number | null };
}

interface Props {
  activity: ActivityDay[];
}

function getIntensity(count: number): string {
  if (count === 0) return "bg-muted";
  if (count < 10) return "bg-blue-200 dark:bg-blue-900";
  if (count < 25) return "bg-blue-400 dark:bg-blue-700";
  if (count < 50) return "bg-blue-600 dark:bg-blue-500";
  return "bg-blue-800 dark:bg-blue-300";
}

export function ActivityHeatmap({ activity }: Props) {
  const countByDay: Record<string, number> = {};
  for (const a of activity) {
    const key = new Date(a.startedAt).toDateString();
    countByDay[key] = (countByDay[key] ?? 0) + (a._sum.cardsReviewed ?? 0);
  }

  const days = Array.from({ length: 365 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (364 - i));
    return d;
  });

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {Array.from({ length: 53 }, (_, week) => (
          <div key={week} className="flex flex-col gap-1">
            {days.slice(week * 7, week * 7 + 7).map((day) => {
              const count = countByDay[day.toDateString()] ?? 0;
              return (
                <div
                  key={day.toISOString()}
                  className={`w-3 h-3 rounded-sm ${getIntensity(count)}`}
                  title={`${day.toLocaleDateString()} — ${count} cards`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
