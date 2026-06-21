// prisma/seed.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const db = new PrismaClient({ adapter });

interface CategoryData {
  name: string;
  slug: string;
  color: string;
  icon: string;
}

interface WordData {
  german: string;
  english: string;
  gender: string | null;
  plural: string | null;
  level: string;
  frequency: number;
  categorySlug: string;
  imageUrl?: string | null;
  phonetic?: string | null;
}

async function fetchDWDSSentences(
  word: string
): Promise<Array<{ german: string; english: string }>> {
  const bare = word.replace(/^(der|die|das)\s+/i, "").trim();
  try {
    const res = await fetch(
      `https://www.dwds.de/api/wb/snippet/?q=${encodeURIComponent(bare)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const examples = (data?.examples ?? []).slice(0, 2);
    return examples.map((e: { text: string }) => ({
      german: e.text,
      english: "",
    }));
  } catch {
    return [];
  }
}

async function main() {
  console.log("Seeding database...");

  const categoriesData: CategoryData[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data/categories.json"), "utf-8")
  );

  // Use enriched file if available, fall back to base
  const wordsFile = fs.existsSync(
    path.join(process.cwd(), "data/words.enriched.json")
  )
    ? "data/words.enriched.json"
    : "data/words.json";

  const wordsData: WordData[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), wordsFile), "utf-8")
  );

  // Upsert categories
  const categoryMap: Record<string, string> = {};
  for (const cat of categoriesData) {
    const created = await db.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, color: cat.color, icon: cat.icon },
      create: cat,
    });
    categoryMap[cat.slug] = created.id;
  }
  console.log(`Seeded ${categoriesData.length} categories`);

  // Upsert words
  let wordCount = 0;
  let skipped = 0;
  for (const word of wordsData) {
    const categoryId = categoryMap[word.categorySlug];
    if (!categoryId) {
      console.warn(`  Skipping "${word.german}" — unknown category "${word.categorySlug}"`);
      skipped++;
      continue;
    }

    const created = await db.word.upsert({
      where: { german: word.german },
      update: {
        english: word.english,
        gender: word.gender,
        plural: word.plural,
        level: word.level,
        frequency: word.frequency,
        imageUrl: word.imageUrl ?? null,
        phonetic: word.phonetic ?? null,
        categoryId,
      },
      create: {
        german: word.german,
        english: word.english,
        gender: word.gender,
        plural: word.plural,
        level: word.level,
        frequency: word.frequency,
        imageUrl: word.imageUrl ?? null,
        phonetic: word.phonetic ?? null,
        categoryId,
      },
    });

    // Fetch DWDS sentences only if word has none yet
    const existingCount = await db.exampleSentence.count({
      where: { wordId: created.id },
    });
    if (existingCount === 0) {
      const sentences = await fetchDWDSSentences(word.german);
      for (const s of sentences) {
        await db.exampleSentence.create({
          data: {
            german: s.german,
            english: s.english,
            source: "DWDS",
            wordId: created.id,
          },
        });
      }
    }

    wordCount++;
    if (wordCount % 25 === 0) {
      console.log(`  ${wordCount}/${wordsData.length} words seeded...`);
    }
  }

  console.log(`\nDone. Seeded ${wordCount} words (${skipped} skipped).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
