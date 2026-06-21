import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const level = searchParams.get("level");
  const q = searchParams.get("q");
  const page = parseInt(searchParams.get("page") ?? "1");
  const take = 24;
  const skip = (page - 1) * take;

  const where = {
    ...(category ? { category: { slug: category } } : {}),
    ...(level ? { level } : {}),
    ...(q
      ? {
          OR: [
            { german: { contains: q, mode: "insensitive" as const } },
            { english: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [words, total] = await Promise.all([
    db.word.findMany({
      where,
      orderBy: { frequency: "asc" },
      take,
      skip,
      include: {
        category: true,
        userCards: { where: { userId }, take: 1 },
      },
    }),
    db.word.count({ where }),
  ]);

  return NextResponse.json({ data: words, total, page, pages: Math.ceil(total / take) });
}
