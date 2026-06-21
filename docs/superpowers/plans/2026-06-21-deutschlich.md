# Deutschlich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack German vocabulary learning web app with SRS flashcards, typing drills, sentence fill-in-the-blank, AI sentence generation, and a rich progress dashboard.

**Architecture:** Next.js 15 App Router (TypeScript), PostgreSQL 16 via Docker, Prisma 5 ORM, NextAuth v5 for auth. SM-2 spaced-repetition runs server-side. All AI calls go through `openai` npm package (compatible with LM Studio and OpenRouter). External enrichment APIs (DWDS, Wiktionary, Unsplash, DeepL) called at seed time only — results cached in DB.

**Tech Stack:** Next.js 15, TypeScript (strict), Prisma 5, PostgreSQL 16, NextAuth v5, shadcn/ui, Tailwind CSS v4, next-themes, Recharts, openai, bcryptjs

## Global Constraints

- TypeScript strict mode — no `any`
- All API routes return `{ data?: T; error?: string }` shape
- Dark mode on every component via Tailwind `dark:` variants + `next-themes`
- AI calls always in `try/catch` — never throw to client on AI failure
- Prisma singleton in `lib/prisma.ts` only — never `new PrismaClient()` elsewhere
- Node 20+, Next.js 15.x, Prisma 5.x, PostgreSQL 16
- No `console.log` in production paths — use `console.error` for errors only
- API keys stored in `.env.local` — never committed

---

## File Structure

```
deutschlich/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              ← authenticated layout with navbar
│   │   ├── dashboard/page.tsx
│   │   ├── study/page.tsx
│   │   ├── study/sentences/page.tsx
│   │   ├── words/page.tsx
│   │   ├── words/[id]/page.tsx
│   │   ├── categories/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── study/cards/route.ts
│   │   ├── study/review/route.ts
│   │   ├── study/session/route.ts
│   │   ├── ai/sentences/route.ts
│   │   ├── words/route.ts
│   │   ├── words/[id]/route.ts
│   │   ├── dashboard/stats/route.ts
│   │   └── user/settings/route.ts
│   ├── layout.tsx                  ← root layout, ThemeProvider
│   └── page.tsx                    ← landing / redirect
├── components/
│   ├── ui/                         ← shadcn generated
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   └── ThemeToggle.tsx
│   ├── flashcard/
│   │   ├── FlashCard.tsx           ← flip animation card
│   │   ├── TypingCard.tsx          ← type-the-german card
│   │   ├── RatingButtons.tsx       ← Again/Hard/Good/Easy
│   │   └── AudioButton.tsx         ← Web Speech API TTS
│   ├── study/
│   │   ├── StudySession.tsx        ← orchestrates flip→typing flow
│   │   └── SessionSummary.tsx      ← end-of-session results
│   ├── sentences/
│   │   └── SentenceDrill.tsx       ← fill-in-the-blank
│   └── dashboard/
│       ├── StreakCard.tsx
│       ├── ProgressDoughnut.tsx
│       ├── ActivityHeatmap.tsx
│       ├── AccuracyChart.tsx
│       └── ForecastChart.tsx
├── lib/
│   ├── prisma.ts                   ← singleton PrismaClient
│   ├── auth.ts                     ← NextAuth config
│   ├── sm2.ts                      ← SM-2 algorithm
│   ├── ai.ts                       ← LM Studio / OpenRouter client
│   └── tts.ts                      ← Web Speech API helper (client-side)
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── data/
│   └── words.json                  ← 1000 pre-curated German words
├── scripts/
│   └── fetch-enrichment.ts         ← calls DWDS/Wiktionary/Unsplash/DeepL
├── docker-compose.yml
├── .env.example
└── __tests__/
    └── lib/
        └── sm2.test.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `app/layout.tsx`
- Create: `components/layout/ThemeToggle.tsx`
- Create: `components/layout/Navbar.tsx`

**Interfaces:**
- Produces: Running Next.js dev server at `:3000`, PostgreSQL at `:5432`, dark/light toggle working

- [ ] **Step 1: Bootstrap Next.js app**

```bash
cd "D:\Personal\learn-german"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"
```

Expected: Project files created, `npm run dev` works at localhost:3000.

- [ ] **Step 2: Install dependencies**

```bash
npm install @prisma/client prisma
npm install next-auth@beta @auth/prisma-adapter
npm install next-themes
npm install recharts
npm install openai
npm install bcryptjs
npm install -D @types/bcryptjs
npm install @radix-ui/react-slot class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 3: Init shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted: TypeScript yes, style Default, base color Slate, CSS variables yes.

Then add components used throughout the app:

```bash
npx shadcn@latest add button card badge input label progress tabs dialog toast
```

- [ ] **Step 4: Create docker-compose.yml**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: deutschlich
      POSTGRES_PASSWORD: deutschlich
      POSTGRES_DB: deutschlich
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 5: Create .env.example**

```bash
# .env.example
DATABASE_URL="postgresql://deutschlich:deutschlich@localhost:5432/deutschlich"
NEXTAUTH_SECRET="replace-with-random-secret"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Unsplash (optional, for seed enrichment)
UNSPLASH_ACCESS_KEY=""

# DeepL (optional, for seed enrichment)
DEEPL_API_KEY=""
```

Copy to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

Generate `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

- [ ] **Step 6: Create root layout with ThemeProvider**

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Deutschlich",
  description: "Learn German vocabulary with spaced repetition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Create ThemeToggle component**

```tsx
// components/layout/ThemeToggle.tsx
"use client";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
```

- [ ] **Step 8: Create Navbar**

```tsx
// components/layout/Navbar.tsx
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  return (
    <nav className="border-b bg-background">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-xl tracking-tight">
          Deutschlich 🇩🇪
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/study" className="text-sm font-medium hover:text-primary">Study</Link>
          <Link href="/words" className="text-sm font-medium hover:text-primary">Words</Link>
          <Link href="/categories" className="text-sm font-medium hover:text-primary">Categories</Link>
          <Link href="/dashboard" className="text-sm font-medium hover:text-primary">Dashboard</Link>
          <Link href="/settings" className="text-sm font-medium hover:text-primary">Settings</Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 9: Verify app runs**

```bash
docker-compose up -d
npm run dev
```

Open http://localhost:3000 — should render Next.js default page. Dark/light toggle not wired yet (done in Task 4 after auth).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 app with shadcn, Tailwind, next-themes"
```

---

## Task 2: Prisma Schema + Database

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`

**Interfaces:**
- Produces: `db` singleton from `lib/prisma.ts` — import as `import { db } from "@/lib/prisma"`
- Produces: All Prisma types (User, Word, UserCard, etc.) importable from `@prisma/client`

- [ ] **Step 1: Init Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write schema.prisma**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

model User {
  id             String        @id @default(cuid())
  email          String        @unique
  name           String?
  image          String?
  password       String?
  emailVerified  DateTime?
  createdAt      DateTime      @default(now())
  currentStreak  Int           @default(0)
  longestStreak  Int           @default(0)
  lastStreakDate DateTime?
  aiProvider     String?       // "lmstudio" | "openrouter" | null
  aiBaseUrl      String?
  aiApiKey       String?
  aiModel        String?
  accounts       Account[]
  sessions       Session[]
  cards          UserCard[]
  studySessions  StudySession[]
}

model Category {
  id    String  @id @default(cuid())
  name  String
  slug  String  @unique
  color String
  icon  String
  words Word[]
}

model Word {
  id         String            @id @default(cuid())
  german     String            @unique
  english    String
  gender     String?
  plural     String?
  level      String
  frequency  Int
  imageUrl   String?
  phonetic   String?
  categoryId String
  category   Category          @relation(fields: [categoryId], references: [id])
  sentences  ExampleSentence[]
  userCards  UserCard[]
}

model ExampleSentence {
  id      String @id @default(cuid())
  german  String
  english String
  source  String // "DWDS" | "AI_GENERATED" | "MANUAL"
  wordId  String
  word    Word   @relation(fields: [wordId], references: [id])
}

model UserCard {
  id             String    @id @default(cuid())
  userId         String
  wordId         String
  status         String    @default("NEW")
  easeFactor     Float     @default(2.5)
  interval       Int       @default(0)
  repetitions    Int       @default(0)
  nextReviewAt   DateTime  @default(now())
  lastReviewedAt DateTime?
  totalCorrect   Int       @default(0)
  totalWrong     Int       @default(0)
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  word           Word      @relation(fields: [wordId], references: [id])
  @@unique([userId, wordId])
}

model StudySession {
  id            String    @id @default(cuid())
  userId        String
  startedAt     DateTime  @default(now())
  endedAt       DateTime?
  cardsReviewed Int       @default(0)
  correctCount  Int       @default(0)
  mode          String    // "FLASHCARD" | "TYPING" | "SENTENCES"
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 3: Create Prisma singleton**

```ts
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration created and applied. `npx prisma studio` should open browser showing all empty tables.

- [ ] **Step 5: Commit**

```bash
git add prisma/ lib/prisma.ts
git commit -m "feat: add Prisma schema and db singleton"
```

---

## Task 3: Seed Data — Words + Categories

**Files:**
- Create: `data/words.json`
- Create: `data/categories.json`
- Create: `prisma/seed.ts`
- Create: `scripts/fetch-enrichment.ts`

**Interfaces:**
- Produces: DB populated with ~20 categories and 1000 words, each with gender/plural from Wiktionary, example sentences from DWDS, images from Unsplash

- [ ] **Step 1: Create categories.json**

```json
// data/categories.json
[
  { "name": "Food & Drink", "slug": "food-drink", "color": "orange", "icon": "🍎" },
  { "name": "Travel & Transport", "slug": "travel", "color": "blue", "icon": "✈️" },
  { "name": "Body & Health", "slug": "health", "color": "red", "icon": "❤️" },
  { "name": "Home & Living", "slug": "home", "color": "green", "icon": "🏠" },
  { "name": "Work & Business", "slug": "work", "color": "purple", "icon": "💼" },
  { "name": "Nature & Weather", "slug": "nature", "color": "teal", "icon": "🌿" },
  { "name": "Time & Calendar", "slug": "time", "color": "yellow", "icon": "⏰" },
  { "name": "Shopping", "slug": "shopping", "color": "pink", "icon": "🛍️" },
  { "name": "Emotions & Feelings", "slug": "emotions", "color": "indigo", "icon": "😊" },
  { "name": "People & Family", "slug": "people", "color": "amber", "icon": "👨‍👩‍👧" },
  { "name": "Numbers & Quantities", "slug": "numbers", "color": "cyan", "icon": "🔢" },
  { "name": "Colors & Shapes", "slug": "colors", "color": "lime", "icon": "🎨" },
  { "name": "Technology", "slug": "technology", "color": "slate", "icon": "💻" },
  { "name": "Education", "slug": "education", "color": "violet", "icon": "📚" },
  { "name": "Sports & Leisure", "slug": "sports", "color": "emerald", "icon": "⚽" },
  { "name": "Animals", "slug": "animals", "color": "brown", "icon": "🐾" },
  { "name": "Clothing", "slug": "clothing", "color": "rose", "icon": "👕" },
  { "name": "City & Places", "slug": "city", "color": "zinc", "icon": "🏙️" },
  { "name": "Verbs (Common)", "slug": "verbs", "color": "sky", "icon": "⚡" },
  { "name": "Adjectives (Common)", "slug": "adjectives", "color": "fuchsia", "icon": "✨" }
]
```

- [ ] **Step 2: Create words.json (representative structure + 50-word sample)**

The full 1000-word list is too large to enumerate here. Create `data/words.json` as an array of objects with this shape:

```json
[
  {
    "german": "essen",
    "english": "to eat",
    "gender": null,
    "plural": null,
    "level": "A1",
    "frequency": 12,
    "categorySlug": "food-drink"
  },
  {
    "german": "das Wasser",
    "english": "water",
    "gender": "das",
    "plural": "die Wässer",
    "level": "A1",
    "frequency": 8,
    "categorySlug": "food-drink"
  },
  {
    "german": "das Brot",
    "english": "bread",
    "gender": "das",
    "plural": "die Brote",
    "level": "A1",
    "frequency": 45,
    "categorySlug": "food-drink"
  },
  {
    "german": "trinken",
    "english": "to drink",
    "gender": null,
    "plural": null,
    "level": "A1",
    "frequency": 23,
    "categorySlug": "food-drink"
  },
  {
    "german": "der Zug",
    "english": "train",
    "gender": "der",
    "plural": "die Züge",
    "level": "A1",
    "frequency": 67,
    "categorySlug": "travel"
  },
  {
    "german": "der Bahnhof",
    "english": "train station",
    "gender": "der",
    "plural": "die Bahnhöfe",
    "level": "A2",
    "frequency": 89,
    "categorySlug": "travel"
  },
  {
    "german": "das Krankenhaus",
    "english": "hospital",
    "gender": "das",
    "plural": "die Krankenhäuser",
    "level": "A2",
    "frequency": 134,
    "categorySlug": "health"
  },
  {
    "german": "der Arzt",
    "english": "doctor (male)",
    "gender": "der",
    "plural": "die Ärzte",
    "level": "A2",
    "frequency": 112,
    "categorySlug": "health"
  },
  {
    "german": "die Wohnung",
    "english": "apartment",
    "gender": "die",
    "plural": "die Wohnungen",
    "level": "A1",
    "frequency": 78,
    "categorySlug": "home"
  },
  {
    "german": "die Küche",
    "english": "kitchen",
    "gender": "die",
    "plural": "die Küchen",
    "level": "A1",
    "frequency": 91,
    "categorySlug": "home"
  }
]
```

**Important:** Populate the full 1000 words before running the seed. A good source: export from https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/German_words_1-10000 and filter for A1-B1 level, then categorize. The seed script handles enrichment automatically.

- [ ] **Step 3: Create fetch-enrichment script**

```ts
// scripts/fetch-enrichment.ts
// Run ONCE to enrich words.json with Wiktionary data before seeding.
// Usage: npx tsx scripts/fetch-enrichment.ts
import * as fs from "fs";

const WIKTIONARY_BASE = "https://en.wiktionary.org/api/rest_v1/page/definition";

async function getWiktionaryData(word: string) {
  const bare = word.replace(/^(der|die|das)\s+/i, "").trim();
  try {
    const res = await fetch(`${WIKTIONARY_BASE}/${encodeURIComponent(bare)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

async function getUnsplashImage(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    const data = await res.json();
    return data.results?.[0]?.urls?.small ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const words = JSON.parse(fs.readFileSync("data/words.json", "utf-8"));
  const enriched = [];
  for (const word of words) {
    const image = await getUnsplashImage(word.english);
    enriched.push({ ...word, imageUrl: image });
    await new Promise((r) => setTimeout(r, 100)); // rate limit
  }
  fs.writeFileSync("data/words.enriched.json", JSON.stringify(enriched, null, 2));
  console.log(`Enriched ${enriched.length} words`);
}

main();
```

Run when Unsplash key is available:
```bash
npx tsx scripts/fetch-enrichment.ts
```

- [ ] **Step 4: Create prisma/seed.ts**

```ts
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const db = new PrismaClient();

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

async function fetchDWDSSentences(word: string): Promise<Array<{ german: string; english: string }>> {
  const bare = word.replace(/^(der|die|das)\s+/i, "").trim();
  try {
    const res = await fetch(`https://www.dwds.de/api/wb/snippet/?q=${encodeURIComponent(bare)}`);
    if (!res.ok) return [];
    const data = await res.json();
    const examples = data?.examples?.slice(0, 2) ?? [];
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
  const wordsFile = fs.existsSync("data/words.enriched.json")
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
      update: {},
      create: cat,
    });
    categoryMap[cat.slug] = created.id;
  }
  console.log(`Seeded ${categoriesData.length} categories`);

  // Upsert words
  let wordCount = 0;
  for (const word of wordsData) {
    const categoryId = categoryMap[word.categorySlug];
    if (!categoryId) continue;

    const created = await db.word.upsert({
      where: { german: word.german },
      update: {},
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

    // Fetch DWDS sentences (skip if already has sentences)
    const existing = await db.exampleSentence.count({ where: { wordId: created.id } });
    if (existing === 0) {
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
    if (wordCount % 50 === 0) console.log(`  ${wordCount}/${wordsData.length} words seeded`);
  }

  console.log(`Seeded ${wordCount} words. Done.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
```

- [ ] **Step 5: Add seed script to package.json**

Add to `package.json`:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Install tsx:
```bash
npm install -D tsx
```

- [ ] **Step 6: Run seed**

```bash
npx prisma db seed
```

Expected: Categories and words inserted. Check with `npx prisma studio`.

- [ ] **Step 7: Commit**

```bash
git add data/ prisma/seed.ts scripts/ package.json
git commit -m "feat: add seed data — categories and German words"
```

---

## Task 4: Authentication

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Create: `app/(app)/layout.tsx`
- Modify: `app/page.tsx` (redirect to /dashboard if logged in)

**Interfaces:**
- Produces: `auth()` from `lib/auth.ts` — call in server components/API routes to get session
- Produces: `GET/POST /api/auth/[...nextauth]` — NextAuth endpoints

- [ ] **Step 1: Install NextAuth Prisma adapter**

```bash
npm install @auth/prisma-adapter
```

- [ ] **Step 2: Create lib/auth.ts**

```ts
// lib/auth.ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user?.password) return null;
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;
        return user;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
});
```

- [ ] **Step 3: Create auth route**

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 4: Create login page**

```tsx
// app/(auth)/login/page.tsx
"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Deutschlich 🇩🇪</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full">Sign In</Button>
          </form>
          {process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true" && (
            <Button variant="outline" className="w-full mt-3" onClick={() => signIn("google")}>
              Sign in with Google
            </Button>
          )}
          <p className="text-sm text-center mt-4 text-muted-foreground">
            No account? <a href="/register" className="underline">Register</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Create register page**

```tsx
// app/(auth)/register/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
    } else {
      router.push("/login");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full">Register</Button>
          </form>
          <p className="text-sm text-center mt-4 text-muted-foreground">
            Have an account? <a href="/login" className="underline">Sign in</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Create register API route**

```ts
// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { email, name, password } = await req.json();
    if (!email || !password || password.length < 8) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
    const hashed = await bcrypt.hash(password, 12);
    await db.user.create({ data: { email, name, password: hashed } });
    return NextResponse.json({ data: "ok" });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 7: Create authenticated app layout**

```tsx
// app/(app)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 8: Update root page.tsx**

```tsx
// app/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/dashboard");
  redirect("/login");
}
```

- [ ] **Step 9: Test auth flow**

```bash
npm run dev
```

1. Go to http://localhost:3000 → redirects to `/login`
2. Register at `/register`
3. Login at `/login` → redirects to `/dashboard` (404 for now)
4. Verify user in `npx prisma studio`

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add NextAuth v5 with credentials + Google OAuth"
```

---

## Task 5: SM-2 Algorithm

**Files:**
- Create: `lib/sm2.ts`
- Create: `__tests__/lib/sm2.test.ts`

**Interfaces:**
- Produces: `applyReview(card: SM2Card, rating: Rating): SM2Card`
- Produces: `getCardStatus(card: SM2Card): CardStatus`
- Produces: types `SM2Card`, `Rating`, `CardStatus`

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D jest @types/jest ts-jest
```

Add to `package.json`:
```json
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/$1"
  }
},
"scripts": {
  "test": "jest"
}
```

- [ ] **Step 2: Write failing tests**

```ts
// __tests__/lib/sm2.test.ts
import { applyReview, getCardStatus } from "@/lib/sm2";

const baseCard = {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
  nextReviewAt: new Date(),
  status: "NEW" as const,
};

describe("applyReview", () => {
  it("Again resets interval to 0 and keeps status LEARNING", () => {
    const result = applyReview({ ...baseCard, repetitions: 3, interval: 5 }, 1);
    expect(result.interval).toBe(0);
    expect(result.repetitions).toBe(0);
    expect(result.status).toBe("LEARNING");
  });

  it("Good on first rep sets interval to 1", () => {
    const result = applyReview(baseCard, 3);
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
    expect(result.status).toBe("LEARNING");
  });

  it("Good on second rep sets interval to 6", () => {
    const card = applyReview(baseCard, 3);
    const result = applyReview(card, 3);
    expect(result.interval).toBe(6);
    expect(result.repetitions).toBe(2);
  });

  it("After rep 2 interval grows by easeFactor", () => {
    let card = applyReview(baseCard, 3);
    card = applyReview(card, 3);
    const result = applyReview(card, 3);
    expect(result.interval).toBe(Math.round(6 * 2.5));
  });

  it("Easy increases easeFactor", () => {
    const result = applyReview(baseCard, 4);
    expect(result.easeFactor).toBeGreaterThan(2.5);
  });

  it("Hard decreases easeFactor", () => {
    const result = applyReview(baseCard, 2);
    expect(result.easeFactor).toBeLessThan(2.5);
  });

  it("easeFactor never drops below 1.3", () => {
    let card = { ...baseCard };
    for (let i = 0; i < 10; i++) card = applyReview(card, 2);
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("nextReviewAt is in the future after Good", () => {
    const result = applyReview(baseCard, 3);
    expect(result.nextReviewAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("status becomes REVIEW when interval >= 7", () => {
    let card = applyReview(baseCard, 3); // interval 1
    card = applyReview(card, 3);          // interval 6
    card = applyReview(card, 3);          // interval 15
    expect(card.status).toBe("REVIEW");
  });

  it("status becomes MASTERED when reps >= 5 and easeFactor >= 2.5", () => {
    let card = { ...baseCard };
    for (let i = 0; i < 5; i++) card = applyReview(card, 4);
    expect(card.status).toBe("MASTERED");
  });
});

describe("getCardStatus", () => {
  it("returns NEW for untouched card", () => {
    expect(getCardStatus(baseCard)).toBe("NEW");
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm test
```

Expected: All tests FAIL with "Cannot find module '@/lib/sm2'".

- [ ] **Step 4: Implement sm2.ts**

```ts
// lib/sm2.ts
export type Rating = 1 | 2 | 3 | 4; // Again | Hard | Good | Easy
export type CardStatus = "NEW" | "LEARNING" | "REVIEW" | "MASTERED";

export interface SM2Card {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
  status: CardStatus;
}

export function applyReview(card: SM2Card, rating: Rating): SM2Card {
  let { easeFactor, interval, repetitions } = card;

  if (rating === 1) {
    // Again — reset
    repetitions = 0;
    interval = 0;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    // Adjust easeFactor: Hard(-0.15), Good(0), Easy(+0.1)
    if (rating === 2) easeFactor = Math.max(1.3, easeFactor - 0.15);
    if (rating === 4) easeFactor = easeFactor + 0.1;

    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + Math.max(1, interval));

  const status = computeStatus(repetitions, interval, easeFactor, rating);

  return { easeFactor, interval, repetitions, nextReviewAt, status };
}

function computeStatus(
  repetitions: number,
  interval: number,
  easeFactor: number,
  rating: Rating
): CardStatus {
  if (rating === 1) return "LEARNING";
  if (repetitions >= 5 && easeFactor >= 2.5) return "MASTERED";
  if (interval >= 7) return "REVIEW";
  return "LEARNING";
}

export function getCardStatus(card: SM2Card): CardStatus {
  return card.status;
}
```

- [ ] **Step 5: Run tests — confirm pass**

```bash
npm test
```

Expected: All 10 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/sm2.ts __tests__/
git commit -m "feat: SM-2 spaced repetition algorithm with tests"
```

---

## Task 6: Study API Routes

**Files:**
- Create: `app/api/study/cards/route.ts`
- Create: `app/api/study/review/route.ts`
- Create: `app/api/study/session/route.ts`

**Interfaces:**
- Consumes: `applyReview` from `lib/sm2.ts`, `auth()` from `lib/auth.ts`, `db` from `lib/prisma.ts`
- Produces:
  - `GET /api/study/cards` → `{ data: UserCardWithWord[] }`
  - `POST /api/study/review` body `{ cardId, rating }` → `{ data: UserCard }`
  - `POST /api/study/session` body `{ cardsReviewed, correctCount, mode }` → `{ data: StudySession }`

- [ ] **Step 1: Create GET /api/study/cards**

```ts
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
```

- [ ] **Step 2: Create POST /api/study/review**

```ts
// app/api/study/review/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { applyReview, type Rating } from "@/lib/sm2";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { cardId, rating } = await req.json();
  if (!cardId || ![1, 2, 3, 4].includes(rating)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const card = await db.userCard.findFirst({ where: { id: cardId, userId } });
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  const updated = applyReview(
    {
      easeFactor: card.easeFactor,
      interval: card.interval,
      repetitions: card.repetitions,
      nextReviewAt: card.nextReviewAt,
      status: card.status as "NEW" | "LEARNING" | "REVIEW" | "MASTERED",
    },
    rating as Rating
  );

  const correct = rating >= 3;
  const saved = await db.userCard.update({
    where: { id: cardId },
    data: {
      easeFactor: updated.easeFactor,
      interval: updated.interval,
      repetitions: updated.repetitions,
      nextReviewAt: updated.nextReviewAt,
      status: updated.status,
      lastReviewedAt: new Date(),
      totalCorrect: correct ? { increment: 1 } : undefined,
      totalWrong: !correct ? { increment: 1 } : undefined,
    },
  });

  return NextResponse.json({ data: saved });
}
```

- [ ] **Step 3: Create POST /api/study/session**

```ts
// app/api/study/session/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { cardsReviewed, correctCount, mode } = await req.json();

  const studySession = await db.studySession.create({
    data: {
      userId,
      endedAt: new Date(),
      cardsReviewed,
      correctCount,
      mode,
    },
  });

  // Update streak
  const user = await db.user.findUnique({ where: { id: userId } });
  if (user) {
    const today = new Date().toDateString();
    const lastDate = user.lastStreakDate?.toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    let newStreak = user.currentStreak;
    if (lastDate === today) {
      // Already studied today — no change
    } else if (lastDate === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }

    await db.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(user.longestStreak, newStreak),
        lastStreakDate: new Date(),
      },
    });
  }

  return NextResponse.json({ data: studySession });
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/study/
git commit -m "feat: study API routes — cards, review, session + streak"
```

---

## Task 7: Flashcard Study UI

**Files:**
- Create: `components/flashcard/FlashCard.tsx`
- Create: `components/flashcard/TypingCard.tsx`
- Create: `components/flashcard/RatingButtons.tsx`
- Create: `components/flashcard/AudioButton.tsx`
- Create: `components/study/StudySession.tsx`
- Create: `components/study/SessionSummary.tsx`
- Create: `app/(app)/study/page.tsx`

**Interfaces:**
- Consumes: `GET /api/study/cards`, `POST /api/study/review`, `POST /api/study/session`
- Produces: Full study loop — flip cards for NEW/LEARNING, typing for REVIEW/MASTERED

- [ ] **Step 1: Create AudioButton**

```tsx
// components/flashcard/AudioButton.tsx
"use client";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";

export function AudioButton({ text }: { text: string }) {
  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "de-DE";
    utt.rate = 0.9;
    window.speechSynthesis.speak(utt);
  }
  return (
    <Button variant="ghost" size="icon" onClick={speak} title="Listen">
      <Volume2 className="h-5 w-5" />
    </Button>
  );
}
```

- [ ] **Step 2: Create RatingButtons**

```tsx
// components/flashcard/RatingButtons.tsx
import { Button } from "@/components/ui/button";

interface Props {
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  disabled?: boolean;
}

const RATINGS = [
  { label: "Again", value: 1 as const, className: "border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950" },
  { label: "Hard", value: 2 as const, className: "border-orange-500 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950" },
  { label: "Good", value: 3 as const, className: "border-green-500 text-green-500 hover:bg-green-50 dark:hover:bg-green-950" },
  { label: "Easy", value: 4 as const, className: "border-blue-500 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950" },
];

export function RatingButtons({ onRate, disabled }: Props) {
  return (
    <div className="flex gap-3 justify-center">
      {RATINGS.map((r) => (
        <Button
          key={r.value}
          variant="outline"
          className={r.className}
          onClick={() => onRate(r.value)}
          disabled={disabled}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create FlashCard component**

```tsx
// components/flashcard/FlashCard.tsx
"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudioButton } from "./AudioButton";
import { RatingButtons } from "./RatingButtons";

interface Word {
  german: string;
  english: string;
  gender: string | null;
  plural: string | null;
  imageUrl: string | null;
  sentences: Array<{ german: string; english: string }>;
}

interface Props {
  word: Word;
  onRate: (rating: 1 | 2 | 3 | 4) => void;
}

export function FlashCard({ word, onRate }: Props) {
  const [flipped, setFlipped] = useState(false);

  const displayGerman = word.gender ? `${word.gender} ${word.german.replace(/^(der|die|das)\s+/i, "")}` : word.german;

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      <Card
        className="min-h-64 cursor-pointer select-none transition-all duration-200 hover:shadow-lg"
        onClick={() => !flipped && setFlipped(true)}
      >
        <CardContent className="flex flex-col items-center justify-center min-h-64 gap-4 p-8">
          {!flipped ? (
            <>
              <p className="text-4xl font-bold text-center">{displayGerman}</p>
              <p className="text-sm text-muted-foreground">Click to reveal</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-semibold">{word.english}</p>
                <AudioButton text={displayGerman} />
              </div>
              {word.plural && (
                <p className="text-sm text-muted-foreground">Plural: {word.plural}</p>
              )}
              {word.imageUrl && (
                <img src={word.imageUrl} alt={word.english} className="h-32 object-cover rounded-lg" />
              )}
              {word.sentences[0] && (
                <div className="text-sm text-center bg-muted p-3 rounded-lg">
                  <p className="font-medium">{word.sentences[0].german}</p>
                  {word.sentences[0].english && (
                    <p className="text-muted-foreground mt-1">{word.sentences[0].english}</p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {!flipped ? (
        <Button variant="outline" className="w-full" onClick={() => setFlipped(true)}>
          Show Answer
        </Button>
      ) : (
        <RatingButtons onRate={(r) => { setFlipped(false); onRate(r); }} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create TypingCard component**

```tsx
// components/flashcard/TypingCard.tsx
"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AudioButton } from "./AudioButton";

interface Word {
  german: string;
  english: string;
  gender: string | null;
  plural: string | null;
}

interface Props {
  word: Word;
  onResult: (correct: boolean) => void;
}

export function TypingCard({ word, onResult }: Props) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const expectedBase = word.german.replace(/^(der|die|das)\s+/i, "").trim().toLowerCase();
  const isCorrect = input.trim().toLowerCase() === expectedBase;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setSubmitted(true);
  }

  function handleNext() {
    setInput("");
    setSubmitted(false);
    onResult(isCorrect);
  }

  const displayGerman = word.gender ? `${word.gender} ${word.german.replace(/^(der|die|das)\s+/i, "")}` : word.german;

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      <Card className="min-h-48">
        <CardContent className="flex flex-col items-center justify-center min-h-48 gap-4 p-8">
          <p className="text-2xl font-semibold text-center">{word.english}</p>
          {word.gender && (
            <p className="text-sm text-muted-foreground">({word.gender}...)</p>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type the German word..."
          disabled={submitted}
          autoFocus
          className={submitted ? (isCorrect ? "border-green-500" : "border-red-500") : ""}
        />
        {!submitted ? (
          <Button type="submit" className="w-full">Check</Button>
        ) : (
          <div className="space-y-2">
            {isCorrect ? (
              <p className="text-green-600 dark:text-green-400 text-center font-medium">Correct! ✓</p>
            ) : (
              <div className="text-center">
                <p className="text-red-500 font-medium">Incorrect</p>
                <p className="text-sm text-muted-foreground">
                  Answer: <span className="font-bold flex items-center gap-1 justify-center">
                    {displayGerman} <AudioButton text={displayGerman} />
                  </span>
                </p>
              </div>
            )}
            <Button onClick={handleNext} className="w-full">Next</Button>
          </div>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Create SessionSummary**

```tsx
// components/study/SessionSummary.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Props {
  cardsReviewed: number;
  correctCount: number;
  onStudyMore: () => void;
}

export function SessionSummary({ cardsReviewed, correctCount, onStudyMore }: Props) {
  const accuracy = cardsReviewed > 0 ? Math.round((correctCount / cardsReviewed) * 100) : 0;
  return (
    <div className="max-w-md mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Session Complete 🎉</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-3xl font-bold">{cardsReviewed}</p>
              <p className="text-sm text-muted-foreground">Cards</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{correctCount}</p>
              <p className="text-sm text-muted-foreground">Correct</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{accuracy}%</p>
              <p className="text-sm text-muted-foreground">Accuracy</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={onStudyMore} className="flex-1">Study More</Button>
            <Button variant="outline" asChild className="flex-1">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Create StudySession orchestrator**

```tsx
// components/study/StudySession.tsx
"use client";
import { useEffect, useState } from "react";
import { FlashCard } from "@/components/flashcard/FlashCard";
import { TypingCard } from "@/components/flashcard/TypingCard";
import { SessionSummary } from "./SessionSummary";
import { Progress } from "@/components/ui/progress";

interface UserCard {
  id: string;
  status: string;
  word: {
    german: string;
    english: string;
    gender: string | null;
    plural: string | null;
    imageUrl: string | null;
    sentences: Array<{ german: string; english: string }>;
  };
}

export function StudySession() {
  const [cards, setCards] = useState<UserCard[]>([]);
  const [index, setIndex] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/study/cards")
      .then((r) => r.json())
      .then((json) => {
        setCards(json.data ?? []);
        setLoading(false);
      });
  }, []);

  async function handleRate(rating: 1 | 2 | 3 | 4) {
    const card = cards[index];
    await fetch("/api/study/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: card.id, rating }),
    });
    const isCorrect = rating >= 3;
    const newReviewed = reviewed + 1;
    const newCorrect = correct + (isCorrect ? 1 : 0);
    setReviewed(newReviewed);
    setCorrect(newCorrect);

    if (index + 1 >= cards.length) {
      await fetch("/api/study/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardsReviewed: newReviewed, correctCount: newCorrect, mode: "FLASHCARD" }),
      });
      setDone(true);
    } else {
      setIndex(index + 1);
    }
  }

  async function handleTypingResult(isCorrect: boolean) {
    await handleRate(isCorrect ? 3 : 1);
  }

  function restart() {
    setIndex(0);
    setReviewed(0);
    setCorrect(0);
    setDone(false);
    setLoading(true);
    fetch("/api/study/cards")
      .then((r) => r.json())
      .then((json) => { setCards(json.data ?? []); setLoading(false); });
  }

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading cards...</div>;
  if (cards.length === 0) return <div className="text-center py-20 text-muted-foreground">No cards due! Check back later. 🎉</div>;
  if (done) return <SessionSummary cardsReviewed={reviewed} correctCount={correct} onStudyMore={restart} />;

  const card = cards[index];
  const useTyping = card.status === "REVIEW" || card.status === "MASTERED";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{index + 1} / {cards.length}</span>
          <span>{card.status}</span>
        </div>
        <Progress value={((index) / cards.length) * 100} />
      </div>
      {useTyping ? (
        <TypingCard word={card.word} onResult={handleTypingResult} />
      ) : (
        <FlashCard word={card.word} onRate={handleRate} />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create study page**

```tsx
// app/(app)/study/page.tsx
import { StudySession } from "@/components/study/StudySession";

export default function StudyPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Study</h1>
      <StudySession />
    </div>
  );
}
```

- [ ] **Step 8: Verify study flow**

```bash
npm run dev
```

1. Login → go to `/study`
2. Cards load (may be empty until seed runs)
3. Click card to flip
4. Rate with Again/Hard/Good/Easy
5. Session summary appears after last card

- [ ] **Step 9: Commit**

```bash
git add components/ app/\(app\)/study/
git commit -m "feat: flashcard + typing study UI with SM-2 integration"
```

---

## Task 8: AI Sentence Generation

**Files:**
- Create: `lib/ai.ts`
- Create: `app/api/ai/sentences/route.ts`
- Create: `components/sentences/SentenceDrill.tsx`
- Create: `app/(app)/study/sentences/page.tsx`

**Interfaces:**
- Consumes: User's `aiProvider`, `aiBaseUrl`, `aiApiKey`, `aiModel` from DB
- Produces: `POST /api/ai/sentences` body `{ wordId }` → `{ data: Array<{german, english}> }`
- Produces: Sentence fill-in-the-blank drill at `/study/sentences`

- [ ] **Step 1: Create lib/ai.ts**

```ts
// lib/ai.ts
import OpenAI from "openai";

interface AiConfig {
  provider: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
}

export interface GeneratedSentence {
  german: string;
  english: string;
}

export async function generateSentences(
  word: string,
  config: AiConfig
): Promise<GeneratedSentence[]> {
  if (!config.provider) return [];

  try {
    const client = new OpenAI({
      apiKey: config.apiKey ?? "not-needed",
      baseURL:
        config.provider === "lmstudio"
          ? (config.baseUrl ?? "http://localhost:1234/v1")
          : "https://openrouter.ai/api/v1",
    });

    const model =
      config.model ??
      (config.provider === "lmstudio" ? "local-model" : "mistralai/mistral-7b-instruct:free");

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a German language teacher. Generate short, practical example sentences for vocabulary learning at A2/B1 level. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Generate exactly 3 example sentences in German using the word "${word}". Keep sentences simple and about daily life (A2/B1 level). Respond ONLY with a JSON array: [{"german": "...", "english": "..."}, ...]`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const text = response.choices[0]?.message?.content ?? "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as GeneratedSentence[];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Create AI sentences API route**

```ts
// app/api/ai/sentences/route.ts
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

  // Save generated sentences to DB
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
```

- [ ] **Step 3: Create SentenceDrill component**

```tsx
// components/sentences/SentenceDrill.tsx
"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Sentence {
  id?: string;
  german: string;
  english: string;
  wordId?: string;
}

interface Word {
  id: string;
  german: string;
  english: string;
  sentences: Sentence[];
}

interface Props {
  word: Word;
}

function blankWord(sentence: string, word: string): string {
  const bare = word.replace(/^(der|die|das)\s+/i, "").trim();
  return sentence.replace(new RegExp(bare, "gi"), "_____");
}

export function SentenceDrill({ word }: Props) {
  const [sentences, setSentences] = useState<Sentence[]>(word.sentences);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  const current = sentences[currentIdx];
  const bare = word.german.replace(/^(der|die|das)\s+/i, "").trim();
  const isCorrect =
    submitted && input.trim().toLowerCase() === bare.toLowerCase();

  async function handleGenerate() {
    setGenerating(true);
    setAiMessage("");
    const res = await fetch("/api/ai/sentences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wordId: word.id }),
    });
    const json = await res.json();
    if (json.data?.length > 0) {
      setSentences((prev) => [...prev, ...json.data]);
    }
    if (json.message) setAiMessage(json.message);
    setGenerating(false);
  }

  if (!current) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">No sentences yet for this word.</p>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "Generate with AI ✨"}
        </Button>
        {aiMessage && <p className="text-sm text-muted-foreground">{aiMessage}</p>}
      </div>
    );
  }

  const blanked = blankWord(current.german, bare);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Card>
        <CardContent className="p-6 space-y-3">
          <Badge variant="outline">{word.german} — {word.english}</Badge>
          <p className="text-xl font-medium">{blanked}</p>
          <p className="text-sm text-muted-foreground">{current.english}</p>
        </CardContent>
      </Card>

      <form
        onSubmit={(e) => { e.preventDefault(); if (input.trim()) setSubmitted(true); }}
        className="space-y-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Fill in the blank (${bare.length} letters)...`}
          disabled={submitted}
          className={submitted ? (isCorrect ? "border-green-500" : "border-red-500") : ""}
          autoFocus
        />
        {!submitted ? (
          <Button type="submit" className="w-full">Check</Button>
        ) : (
          <div className="space-y-2">
            <p className={`text-center font-medium ${isCorrect ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {isCorrect ? "Correct! ✓" : `Incorrect — answer: ${bare}`}
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setInput("");
                setSubmitted(false);
                setCurrentIdx((i) => (i + 1) % sentences.length);
              }}
            >
              Next Sentence
            </Button>
          </div>
        )}
      </form>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {currentIdx + 1} / {sentences.length} sentences
        </p>
        <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "Generate more ✨"}
        </Button>
      </div>
      {aiMessage && <p className="text-sm text-muted-foreground text-center">{aiMessage}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Create sentences page**

```tsx
// app/(app)/study/sentences/page.tsx
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

  // Default to a random word if none specified
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
```

- [ ] **Step 5: Commit**

```bash
git add lib/ai.ts app/api/ai/ components/sentences/ app/\(app\)/study/sentences/
git commit -m "feat: AI sentence generation (LM Studio / OpenRouter) + sentence drill"
```

---

## Task 9: Words Browser + Word Detail

**Files:**
- Create: `app/api/words/route.ts`
- Create: `app/api/words/[id]/route.ts`
- Create: `app/(app)/words/page.tsx`
- Create: `app/(app)/words/[id]/page.tsx`
- Create: `app/(app)/categories/page.tsx`

**Interfaces:**
- Produces: `GET /api/words?category=&level=&status=&q=` → paginated word list
- Produces: `GET /api/words/[id]` → word with sentences and user card state

- [ ] **Step 1: Create GET /api/words**

```ts
// app/api/words/route.ts
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
    ...(q ? { OR: [{ german: { contains: q, mode: "insensitive" as const } }, { english: { contains: q, mode: "insensitive" as const } }] } : {}),
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
```

- [ ] **Step 2: Create GET /api/words/[id]**

```ts
// app/api/words/[id]/route.ts
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
```

- [ ] **Step 3: Create words browser page**

```tsx
// app/(app)/words/page.tsx
"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const LEVELS = ["A1", "A2", "B1", "B2"];
const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-200 dark:bg-gray-700",
  LEARNING: "bg-yellow-200 dark:bg-yellow-800",
  REVIEW: "bg-blue-200 dark:bg-blue-800",
  MASTERED: "bg-green-200 dark:bg-green-800",
};

interface Word {
  id: string;
  german: string;
  english: string;
  gender: string | null;
  level: string;
  userCards: Array<{ status: string }>;
}

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (level) params.set("level", level);
    params.set("page", String(page));
    fetch(`/api/words?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setWords(json.data ?? []);
        setTotal(json.total ?? 0);
        setPages(json.pages ?? 1);
      });
  }, [q, level, page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Words ({total})</h1>
      </div>
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
        <div className="flex gap-2">
          {LEVELS.map((l) => (
            <Button
              key={l}
              variant={level === l ? "default" : "outline"}
              size="sm"
              onClick={() => { setLevel(level === l ? "" : l); setPage(1); }}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {words.map((word) => {
          const status = word.userCards[0]?.status ?? "NEW";
          return (
            <Link key={word.id} href={`/words/${word.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm">{word.german}</p>
                    <Badge variant="outline" className="text-xs shrink-0">{word.level}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{word.english}</p>
                  <div className={`h-1.5 rounded-full ${STATUS_COLORS[status]}`} title={status} />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      <div className="flex justify-center gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
        <span className="py-2 px-3 text-sm">{page} / {pages}</span>
        <Button variant="outline" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create word detail page**

```tsx
// app/(app)/words/[id]/page.tsx
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

      <Button asChild variant="outline">
        <Link href="/words">← Back to Words</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Create categories page**

```tsx
// app/(app)/categories/page.tsx
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
```

- [ ] **Step 6: Commit**

```bash
git add app/api/words/ app/\(app\)/words/ app/\(app\)/categories/
git commit -m "feat: words browser, word detail, categories page"
```

---

## Task 10: Dashboard

**Files:**
- Create: `app/api/dashboard/stats/route.ts`
- Create: `components/dashboard/StreakCard.tsx`
- Create: `components/dashboard/ProgressDoughnut.tsx`
- Create: `components/dashboard/ActivityHeatmap.tsx`
- Create: `components/dashboard/AccuracyChart.tsx`
- Create: `components/dashboard/ForecastChart.tsx`
- Create: `app/(app)/dashboard/page.tsx`

**Interfaces:**
- Produces: `GET /api/dashboard/stats` → full stats payload
- Produces: `/dashboard` page with all 5 chart components

- [ ] **Step 1: Create dashboard stats API**

```ts
// app/api/dashboard/stats/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [user, statusCounts, sessions, forecast] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),

    // Progress doughnut: count by status
    db.userCard.groupBy({
      by: ["status"],
      where: { userId },
      _count: { status: true },
    }),

    // Accuracy chart: last 30 sessions
    db.studySession.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: { startedAt: true, cardsReviewed: true, correctCount: true },
    }),

    // Forecast: cards due in next 7 days
    Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const start = new Date();
        start.setDate(start.getDate() + i);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setHours(23, 59, 59, 999);
        return db.userCard.count({
          where: { userId, nextReviewAt: { gte: start, lte: end }, status: { not: "MASTERED" } },
        });
      })
    ),
  ]);

  // Activity heatmap: sessions per day for last 365 days
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const activity = await db.studySession.groupBy({
    by: ["startedAt"],
    where: { userId, startedAt: { gte: yearAgo } },
    _sum: { cardsReviewed: true },
  });

  return NextResponse.json({
    data: {
      streak: { current: user?.currentStreak ?? 0, longest: user?.longestStreak ?? 0 },
      statusCounts,
      sessions: sessions.reverse(),
      forecast,
      activity,
    },
  });
}
```

- [ ] **Step 2: Create StreakCard**

```tsx
// components/dashboard/StreakCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Flame } from "lucide-react";

export function StreakCard({ current, longest }: { current: number; longest: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <Flame className="h-10 w-10 text-orange-500" />
        <div>
          <p className="text-4xl font-bold">{current}</p>
          <p className="text-sm text-muted-foreground">day streak · best: {longest}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create ProgressDoughnut**

```tsx
// components/dashboard/ProgressDoughnut.tsx
"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface StatusCount {
  status: string;
  _count: { status: number };
}

const COLORS: Record<string, string> = {
  NEW: "#94a3b8",
  LEARNING: "#f59e0b",
  REVIEW: "#3b82f6",
  MASTERED: "#22c55e",
};

export function ProgressDoughnut({ statusCounts }: { statusCounts: StatusCount[] }) {
  const data = statusCounts.map((s) => ({
    name: s.status,
    value: s._count.status,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label>
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name] ?? "#888"} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Create AccuracyChart**

```tsx
// components/dashboard/AccuracyChart.tsx
"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Session {
  startedAt: string;
  cardsReviewed: number;
  correctCount: number;
}

export function AccuracyChart({ sessions }: { sessions: Session[] }) {
  const data = sessions.map((s) => ({
    date: new Date(s.startedAt).toLocaleDateString("de-DE", { month: "short", day: "numeric" }),
    accuracy: s.cardsReviewed > 0 ? Math.round((s.correctCount / s.cardsReviewed) * 100) : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip formatter={(v) => [`${v}%`, "Accuracy"]} />
        <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 5: Create ForecastChart**

```tsx
// components/dashboard/ForecastChart.tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function ForecastChart({ forecast }: { forecast: number[] }) {
  const days = ["Today", "Tomorrow", "+2d", "+3d", "+4d", "+5d", "+6d"];
  const data = forecast.map((count, i) => ({ day: days[i], cards: count }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [v, "Cards due"]} />
        <Bar dataKey="cards" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 6: Create ActivityHeatmap**

```tsx
// components/dashboard/ActivityHeatmap.tsx
"use client";

interface ActivityDay {
  startedAt: string;
  _sum: { cardsReviewed: number | null };
}

interface Props {
  activity: ActivityDay[];
}

function getIntensity(count: number): string {
  if (count === 0) return "bg-muted";
  if (count < 10) return "bg-blue-200 dark:bg-blue-900";
  if (count < 25) return "bg-blue-400 dark:bg-blue-700";
  if (count < 50) return "bg-blue-600 dark:bg-blue-500";
  return "bg-blue-800 dark:bg-blue-300";
}

export function ActivityHeatmap({ activity }: Props) {
  const countByDay: Record<string, number> = {};
  for (const a of activity) {
    const key = new Date(a.startedAt).toDateString();
    countByDay[key] = (countByDay[key] ?? 0) + (a._sum.cardsReviewed ?? 0);
  }

  const days = Array.from({ length: 365 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (364 - i));
    return d;
  });

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {Array.from({ length: 53 }, (_, week) => (
          <div key={week} className="flex flex-col gap-1">
            {days.slice(week * 7, week * 7 + 7).map((day) => {
              const count = countByDay[day.toDateString()] ?? 0;
              return (
                <div
                  key={day.toISOString()}
                  className={`w-3 h-3 rounded-sm ${getIntensity(count)}`}
                  title={`${day.toLocaleDateString()} — ${count} cards`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create dashboard page**

```tsx
// app/(app)/dashboard/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { ProgressDoughnut } from "@/components/dashboard/ProgressDoughnut";
import { AccuracyChart } from "@/components/dashboard/AccuracyChart";
import { ForecastChart } from "@/components/dashboard/ForecastChart";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import Link from "next/link";

async function getStats() {
  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/dashboard/stats`, {
    cache: "no-store",
    headers: { cookie: "" }, // will use server-side auth
  });
  return res.json();
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Fetch directly from DB instead of internal fetch
  const { db } = await import("@/lib/prisma");
  const userId = session.user.id;

  const [user, statusCounts, sessions, activity] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.userCard.groupBy({ by: ["status"], where: { userId }, _count: { status: true } }),
    db.studySession.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 30,
      select: { startedAt: true, cardsReviewed: true, correctCount: true },
    }),
    db.studySession.groupBy({
      by: ["startedAt"],
      where: { userId, startedAt: { gte: new Date(Date.now() - 365 * 86400000) } },
      _sum: { cardsReviewed: true },
    }),
  ]);

  const forecast = await Promise.all(
    Array.from({ length: 7 }, (_, i) => {
      const start = new Date();
      start.setDate(start.getDate() + i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return db.userCard.count({
        where: { userId, nextReviewAt: { gte: start, lte: end }, status: { not: "MASTERED" } },
      });
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button asChild><Link href="/study">Study Now →</Link></Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <StreakCard current={user?.currentStreak ?? 0} longest={user?.longestStreak ?? 0} />
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Cards due today</p>
            <p className="text-4xl font-bold">{forecast[0]}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
          <CardContent>
            <ProgressDoughnut statusCounts={statusCounts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Accuracy (last 30 sessions)</CardTitle></CardHeader>
          <CardContent>
            <AccuracyChart sessions={sessions.reverse().map(s => ({ ...s, startedAt: s.startedAt.toISOString() }))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Review Forecast</CardTitle></CardHeader>
        <CardContent>
          <ForecastChart forecast={forecast} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
        <CardContent>
          <ActivityHeatmap activity={activity.map(a => ({ startedAt: a.startedAt.toISOString(), _sum: a._sum }))} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add app/api/dashboard/ components/dashboard/ app/\(app\)/dashboard/
git commit -m "feat: dashboard — streak, heatmap, accuracy chart, forecast"
```

---

## Task 11: Settings Page

**Files:**
- Create: `app/api/user/settings/route.ts`
- Create: `app/(app)/settings/page.tsx`

**Interfaces:**
- Produces: `PATCH /api/user/settings` body `{ aiProvider, aiBaseUrl, aiApiKey, aiModel }` → `{ data: User }`
- Produces: `/settings` page with theme toggle + AI provider config form

- [ ] **Step 1: Create PATCH /api/user/settings**

```ts
// app/api/user/settings/route.ts
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
```

- [ ] **Step 2: Create settings page**

```tsx
// app/(app)/settings/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const OPENROUTER_MODELS = [
  { label: "Mistral 7B (free)", value: "mistralai/mistral-7b-instruct:free" },
  { label: "Llama 3.1 8B (free)", value: "meta-llama/llama-3.1-8b-instruct:free" },
  { label: "Qwen2.5 7B (free)", value: "qwen/qwen-2.5-7b-instruct:free" },
];

export default function SettingsPage() {
  const [provider, setProvider] = useState<"lmstudio" | "openrouter" | "">("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((json) => {
        const u = json.data;
        if (u) {
          setProvider((u.aiProvider as "lmstudio" | "openrouter" | "") ?? "");
          setBaseUrl(u.aiBaseUrl ?? "http://localhost:1234/v1");
          setModel(u.aiModel ?? "");
        }
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aiProvider: provider || null,
        aiBaseUrl: provider === "lmstudio" ? baseUrl : null,
        aiApiKey: provider === "openrouter" ? apiKey : null,
        aiModel: model || null,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label>Theme</Label>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <p className="text-sm text-muted-foreground">
            Used to generate example sentences. Optional — app works without it.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex gap-2">
              {(["", "lmstudio", "openrouter"] as const).map((p) => (
                <Button
                  key={p || "none"}
                  type="button"
                  variant={provider === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setProvider(p)}
                >
                  {p === "" ? "None" : p === "lmstudio" ? "LM Studio" : "OpenRouter"}
                </Button>
              ))}
            </div>

            {provider === "lmstudio" && (
              <div className="space-y-2">
                <Label>LM Studio URL</Label>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:1234/v1" />
                <Label>Model name (from LM Studio)</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. qwen2.5-7b-instruct" />
                <p className="text-xs text-muted-foreground">
                  Recommended: Qwen2.5 7B Instruct Q4_K_M (~5GB VRAM, fits RTX 4060)
                </p>
              </div>
            )}

            {provider === "openrouter" && (
              <div className="space-y-2">
                <Label>OpenRouter API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-..."
                />
                <Label>Model</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="">Select model...</option>
                  {OPENROUTER_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            <Button type="submit" className="w-full">
              {saved ? "Saved ✓" : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/user/ app/\(app\)/settings/
git commit -m "feat: settings page — theme toggle + AI provider config"
```

---

## Task 12: Final Polish + Production Readiness

**Files:**
- Modify: `app/layout.tsx` (add Toaster)
- Create: `app/(app)/dashboard/page.tsx` placeholder if `/dashboard` 404s
- Modify: `next.config.ts` (image domains for Unsplash)

**Interfaces:**
- Produces: Fully working app — all routes reachable, no 404s, images load

- [ ] **Step 1: Configure Next.js image domains**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.unsplash.com" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Add middleware for auth redirect**

```ts
// middleware.ts
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|register).*)"],
};
```

- [ ] **Step 3: Add toast notifications**

```bash
npx shadcn@latest add sonner
```

Add to `app/layout.tsx`:
```tsx
import { Toaster } from "@/components/ui/sonner";
// inside <body>:
<Toaster />
```

- [ ] **Step 4: Final smoke test**

```bash
docker-compose up -d
npx prisma db push
npx prisma db seed
npm run build
npm run start
```

Visit each route and verify:
- `/` → redirects to `/login`
- `/login` → login form works
- `/register` → creates account
- `/dashboard` → streak + charts render
- `/study` → cards load, flip/type works, rating updates
- `/study/sentences` → sentence drill works
- `/words` → grid loads, filter works
- `/words/[id]` → detail with audio button
- `/categories` → grid with counts
- `/settings` → theme toggle, AI form saves

- [ ] **Step 5: Push final commit**

```bash
git add -A
git commit -m "feat: final polish — middleware, image config, toasts"
git push origin main
```

---

## Quick Reference

```bash
# Start dev
docker-compose up -d && npm run dev

# Reset and reseed DB
npx prisma migrate reset && npx prisma db seed

# Run tests
npm test

# Enrich words (needs UNSPLASH_ACCESS_KEY in .env.local)
npx tsx scripts/fetch-enrichment.ts

# Open DB GUI
npx prisma studio
```
