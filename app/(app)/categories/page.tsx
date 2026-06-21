import { db } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export default async function CategoriesPage() {
  const categories = await db.category.findMany({
    include: { _count: { select: { words: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Categories</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <Link key={cat.id} href={`/words?category=${cat.slug}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 text-center space-y-2">
                <p className="text-3xl">{cat.icon}</p>
                <p className="font-semibold text-sm">{cat.name}</p>
                <p className="text-xs text-muted-foreground">{cat._count.words} words</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
