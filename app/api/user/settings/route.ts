import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { aiProvider, aiBaseUrl, aiApiKey, aiModel } = await req.json();

  const user = await db.user.update({
    where: { id: userId },
    data: {
      aiProvider: aiProvider ?? null,
      aiBaseUrl: aiBaseUrl ?? null,
      aiApiKey: aiApiKey ?? null,
      aiModel: aiModel ?? null,
    },
    select: { id: true, email: true, aiProvider: true, aiBaseUrl: true, aiModel: true },
  });

  return NextResponse.json({ data: user });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, aiProvider: true, aiBaseUrl: true, aiModel: true },
  });
  return NextResponse.json({ data: user });
}
