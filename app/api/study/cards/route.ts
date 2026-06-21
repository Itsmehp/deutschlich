// app/api/study/cards/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

// Returns up to 20 cards due for review + up to 10 new cards
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const dueCards = await db.userCard.findMany({
    where: { userId, nextReviewAt: { lte: new Date() }, status: { not: "MASTERED" } },
    orderBy: { nextReviewAt: "asc" },
    take: 20,
    include: { word: { include: { sentences: true, category: true } } },
  });

  // Count existing cards to know how many new ones to add
  const existingWordIds = new Set(dueCards.map((c) => c.wordId));

  const newWords = await db.word.findMany({
    where: { userCards: { none: { userId } } },
    orderBy: { frequency: "asc" },
    take: 10,
    include: { sentences: true, category: true },
  });

  // Create UserCard rows for new words (lazy init)
  for (const word of newWords) {
    if (!existingWordIds.has(word.id)) {
      await db.userCard.upsert({
        where: { userId_wordId: { userId, wordId: word.id } },
        update: {},
        create: { userId, wordId: word.id },
      });
    }
  }

  const newCards = await db.userCard.findMany({
    where: { userId, wordId: { in: newWords.map((w) => w.id) } },
    include: { word: { include: { sentences: true, category: true } } },
  });

  const allCards = [...dueCards, ...newCards];
  return NextResponse.json({ data: allCards });
}
