import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { ProgressDoughnut } from "@/components/dashboard/ProgressDoughnut";
import { AccuracyChart } from "@/components/dashboard/AccuracyChart";
import { ForecastChart } from "@/components/dashboard/ForecastChart";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { db } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const yearAgo = new Date(Date.now() - 365 * 86400000);

  const [user, statusCounts, sessions, activity] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.userCard.groupBy({ by: ["status"], where: { userId }, _count: { status: true } }),
    db.studySession.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: { startedAt: true, cardsReviewed: true, correctCount: true },
    }),
    db.studySession.groupBy({
      by: ["startedAt"],
      where: { userId, startedAt: { gte: yearAgo } },
      _sum: { cardsReviewed: true },
    }),
  ]);

  const forecast = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const start = new Date();
      start.setDate(start.getDate() + i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return db.userCard.count({
        where: { userId, nextReviewAt: { gte: start, lte: end }, status: { not: "MASTERED" } },
      });
    })
  );

  const sessionsForChart = sessions
    .reverse()
    .map((s) => ({ ...s, startedAt: s.startedAt.toISOString() }));

  const activityForHeatmap = activity.map((a) => ({
    startedAt: a.startedAt.toISOString(),
    _sum: a._sum,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/study" className={cn(buttonVariants())}>Study Now →</Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <StreakCard current={user?.currentStreak ?? 0} longest={user?.longestStreak ?? 0} />
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Cards due today</p>
            <p className="text-4xl font-bold">{forecast[0]}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressDoughnut statusCounts={statusCounts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Accuracy (last 30 sessions)</CardTitle>
          </CardHeader>
          <CardContent>
            <AccuracyChart sessions={sessionsForChart} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <ForecastChart forecast={forecast} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityHeatmap activity={activityForHeatmap} />
        </CardContent>
      </Card>
    </div>
  );
}
