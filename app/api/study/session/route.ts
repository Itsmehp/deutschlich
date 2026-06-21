// app/api/study/session/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { cardsReviewed, correctCount, mode } = await req.json();

  const studySession = await db.studySession.create({
    data: {
      userId,
      endedAt: new Date(),
      cardsReviewed,
      correctCount,
      mode,
    },
  });

  // Update streak
  const user = await db.user.findUnique({ where: { id: userId } });
  if (user) {
    const toUTCDate = (d: Date) => d.toISOString().slice(0, 10);
    const today = toUTCDate(new Date());
    const lastDate = user.lastStreakDate ? toUTCDate(user.lastStreakDate) : null;
    const yesterday = toUTCDate(new Date(Date.now() - 86400000));

    let newStreak = user.currentStreak;
    if (lastDate === today) {
      // Already studied today — no change
    } else if (lastDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }

    await db.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(user.longestStreak, newStreak),
        lastStreakDate: new Date(),
      },
    });
  }

  return NextResponse.json({ data: studySession });
}
