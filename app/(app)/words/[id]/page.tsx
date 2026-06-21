import { db } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AudioButton } from "@/components/flashcard/AudioButton";
import { SentenceDrill } from "@/components/sentences/SentenceDrill";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function WordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;

  const word = await db.word.findUnique({
    where: { id },
    include: {
      category: true,
      sentences: true,
      userCards: { where: { userId: session.user.id }, take: 1 },
    },
  });
  if (!word) notFound();

  const card = word.userCards[0];
  const displayGerman = word.gender
    ? `${word.gender} ${word.german.replace(/^(der|die|das)\s+/i, "")}`
    : word.german;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{displayGerman}</h1>
            <AudioButton text={displayGerman} />
          </div>
          <p className="text-xl text-muted-foreground">{word.english}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge>{word.level}</Badge>
        <Badge variant="outline">{word.category.name}</Badge>
        {word.plural && <Badge variant="outline">Plural: {word.plural}</Badge>}
        {card && <Badge variant="secondary">{card.status}</Badge>}
      </div>

      {word.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={word.imageUrl} alt={word.english} className="rounded-xl h-48 object-cover w-full" />
      )}

      {card && (
        <Card>
          <CardHeader><CardTitle className="text-base">Your Progress</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-bold">{card.totalCorrect}</p><p className="text-xs text-muted-foreground">Correct</p></div>
            <div><p className="text-2xl font-bold">{card.totalWrong}</p><p className="text-xs text-muted-foreground">Wrong</p></div>
            <div><p className="text-2xl font-bold">{card.interval}d</p><p className="text-xs text-muted-foreground">Interval</p></div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Sentence Drill</h2>
        <SentenceDrill word={word} />
      </div>

      <Link href="/words">
        <Button variant="outline">← Back to Words</Button>
      </Link>
    </div>
  );
}
