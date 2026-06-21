import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { generateSentences } from "@/lib/ai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { wordId } = await req.json();

  const [user, word] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.word.findUnique({ where: { id: wordId } }),
  ]);

  if (!word) return NextResponse.json({ error: "Word not found" }, { status: 404 });

  const sentences = await generateSentences(word.german, {
    provider: user?.aiProvider ?? null,
    baseUrl: user?.aiBaseUrl ?? null,
    apiKey: user?.aiApiKey ?? null,
    model: user?.aiModel ?? null,
  });

  if (sentences.length === 0) {
    return NextResponse.json({
      data: [],
      message: user?.aiProvider
        ? "AI unavailable — check your AI settings"
        : "No AI provider configured — add one in Settings",
    });
  }

  await db.exampleSentence.createMany({
    data: sentences.map((s) => ({
      german: s.german,
      english: s.english,
      source: "AI_GENERATED",
      wordId: word.id,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ data: sentences });
}
