import { db } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SentenceDrill } from "@/components/sentences/SentenceDrill";

export default async function SentencesPage({
  searchParams,
}: {
  searchParams: Promise<{ wordId?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { wordId } = await searchParams;

  const word = wordId
    ? await db.word.findUnique({
        where: { id: wordId },
        include: { sentences: true },
      })
    : await db.word.findFirst({
        orderBy: { frequency: "asc" },
        include: { sentences: true },
      });

  if (!word) return <p>No words found.</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Sentence Drill</h1>
      <SentenceDrill word={word} />
    </div>
  );
}
