import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const word = await db.word.findUnique({
    where: { id },
    include: {
      category: true,
      sentences: true,
      userCards: { where: { userId: session.user.id }, take: 1 },
    },
  });
  if (!word) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: word });
}
