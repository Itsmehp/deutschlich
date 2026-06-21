// app/api/study/review/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { applyReview, type Rating } from "@/lib/sm2";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { cardId, rating } = await req.json();
  if (!cardId || ![1, 2, 3, 4].includes(rating)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const card = await db.userCard.findFirst({ where: { id: cardId, userId } });
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  const updated = applyReview(
    {
      easeFactor: card.easeFactor,
      interval: card.interval,
      repetitions: card.repetitions,
      nextReviewAt: card.nextReviewAt,
      status: card.status as "NEW" | "LEARNING" | "REVIEW" | "MASTERED",
    },
    rating as Rating
  );

  const correct = rating >= 3;
  const saved = await db.userCard.update({
    where: { id: cardId },
    data: {
      easeFactor: updated.easeFactor,
      interval: updated.interval,
      repetitions: updated.repetitions,
      nextReviewAt: updated.nextReviewAt,
      status: updated.status,
      lastReviewedAt: new Date(),
      totalCorrect: correct ? { increment: 1 } : undefined,
      totalWrong: !correct ? { increment: 1 } : undefined,
    },
  });

  return NextResponse.json({ data: saved });
}
