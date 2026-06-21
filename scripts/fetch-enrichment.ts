// scripts/fetch-enrichment.ts
// Run ONCE to enrich words.json with Unsplash image URLs before seeding.
// Requires: UNSPLASH_ACCESS_KEY environment variable
// Usage: npx tsx scripts/fetch-enrichment.ts
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

const UNSPLASH_BASE = "https://api.unsplash.com/search/photos";

async function getUnsplashImage(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    console.warn("UNSPLASH_ACCESS_KEY not set — skipping image fetch");
    return null;
  }
  try {
    const res = await fetch(
      `${UNSPLASH_BASE}?query=${encodeURIComponent(query)}&per_page=1`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.results?.[0]?.urls?.small as string) ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const wordsPath = path.join(process.cwd(), "data/words.json");
  const words = JSON.parse(fs.readFileSync(wordsPath, "utf-8")) as Array<{
    german: string;
    english: string;
    [key: string]: unknown;
  }>;

  console.log(`Enriching ${words.length} words with Unsplash images...`);

  const enriched = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const image = await getUnsplashImage(word.english);
    enriched.push({ ...word, imageUrl: image });
    if ((i + 1) % 10 === 0) {
      console.log(`  ${i + 1}/${words.length} processed`);
    }
    // Rate limit: Unsplash free tier is 50 req/hour
    await new Promise((r) => setTimeout(r, 100));
  }

  const outPath = path.join(process.cwd(), "data/words.enriched.json");
  fs.writeFileSync(outPath, JSON.stringify(enriched, null, 2), "utf-8");
  console.log(`\nWrote enriched data to ${outPath}`);
  console.log(`Enriched ${enriched.length} words.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
