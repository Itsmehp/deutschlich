# German Learning App — Design Spec
**Date:** 2026-06-21  
**Status:** Approved

---

## 1. Overview

A personal web app for learning German vocabulary from A2 toward confident B1. Core mechanic: spaced-repetition flashcards with a mixed drill mode (flip → typing upgrade). Enriched with real dictionary data, images, audio, and AI-generated sentences.

**Target user:** Single user (self-hosted) who knows A2 German and wants to solidify B1 vocabulary through daily practice.

---

## 2. Architecture

```
Next.js 15 (App Router, TypeScript)
  /app          → React pages & layouts
  /app/api      → API route handlers
  /lib          → Prisma client, SM-2 algorithm, API clients
  /components   → shadcn/ui + custom components

PostgreSQL 16 (Docker)
  ↑ Prisma 5 ORM

External APIs (enrichment):
  DWDS API          → example sentences, collocations (no key)
  Wiktionary REST   → gender, plural, conjugations (no key)
  DeepL API         → translations (free tier, 500k chars/mo)
  Unsplash API      → word images, cached in DB (free tier)
  Web Speech API    → TTS audio, browser-native (de-DE)
  LM Studio / OpenRouter → AI sentence generation (user-configured)
```

**Dev setup:**
```bash
docker-compose up   # PostgreSQL on :5432
npm run dev         # Next.js on :3000
# LM Studio optional: load Qwen2.5 7B Instruct Q4_K_M on :1234
```

---

## 3. Data Model

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  image           String?
  createdAt       DateTime  @default(now())
  currentStreak   Int       @default(0)
  longestStreak   Int       @default(0)
  lastStreakDate  DateTime?
  aiProvider      String?   // "lmstudio" | "openrouter" | null
  aiBaseUrl       String?   // LM Studio URL or OpenRouter base
  aiApiKey        String?   // encrypted, OpenRouter key
  aiModel         String?   // model slug
  cards           UserCard[]
  sessions        StudySession[]
}

model Category {
  id        String  @id @default(cuid())
  name      String  // e.g. "Food & Drink"
  slug      String  @unique
  color     String  // Tailwind color token
  icon      String  // emoji or icon name
  words     Word[]
}

model Word {
  id          String    @id @default(cuid())
  german      String    @unique
  english     String
  gender      String?   // "der" | "die" | "das" | null
  plural      String?
  level       String    // "A1" | "A2" | "B1" | "B2"
  frequency   Int       // 1–1000 rank
  imageUrl    String?   // Unsplash, cached
  phonetic    String?   // IPA string
  categoryId  String
  category    Category  @relation(fields: [categoryId], references: [id])
  sentences   ExampleSentence[]
  userCards   UserCard[]
}

model ExampleSentence {
  id      String  @id @default(cuid())
  german  String
  english String
  source  String  // "DWDS" | "AI_GENERATED" | "MANUAL"
  wordId  String
  word    Word    @relation(fields: [wordId], references: [id])
}

model UserCard {
  id             String    @id @default(cuid())
  userId         String
  wordId         String
  status         String    @default("NEW") // "NEW"|"LEARNING"|"REVIEW"|"MASTERED"
  easeFactor     Float     @default(2.5)
  interval       Int       @default(0)     // days
  repetitions    Int       @default(0)
  nextReviewAt   DateTime  @default(now())
  lastReviewedAt DateTime?
  totalCorrect   Int       @default(0)
  totalWrong     Int       @default(0)
  user           User      @relation(fields: [userId], references: [id])
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
  user          User      @relation(fields: [userId], references: [id])
}
```

---

## 4. SRS Algorithm (SM-2)

Standard SM-2 implementation in TypeScript (`/lib/sm2.ts`).

**Rating scale:** Again (1) / Hard (2) / Good (3) / Easy (4)

**Status transitions:**
- NEW → LEARNING on first review
- LEARNING → REVIEW when interval ≥ 7 days
- REVIEW → MASTERED when repetitions ≥ 5 and easeFactor ≥ 2.5
- Any rating of Again → resets interval to 0, back to LEARNING

**Mode upgrade:**
- Card in NEW/LEARNING → flip mode (reveal answer)
- Card in REVIEW/MASTERED → typing mode (type the German word)

---

## 5. Pages & Routes

| Route | Description |
|-------|-------------|
| `/` | Landing — login/signup |
| `/dashboard` | Streak, heatmap, due count, accuracy chart, forecast |
| `/study` | Main study session (flashcard + typing) |
| `/study/sentences` | Sentence fill-in-the-blank drill |
| `/words` | Browse all words — filter by category, level, status |
| `/words/[id]` | Word detail — info, sentences, SRS history, AI generate |
| `/categories` | Category grid — drill by theme |
| `/settings` | Theme toggle, AI provider config, account |

---

## 6. Study Flow

```
1. Fetch due cards: UserCard where nextReviewAt ≤ now, ordered by nextReviewAt
2. For each card:
   a. NEW/LEARNING → flip mode
      Front: German word (+ gender if noun)
      Back: English, plural, image, [🔊 audio button], example sentence
      Rate: Again / Hard / Good / Easy
   b. REVIEW/MASTERED → typing mode
      Prompt: English word
      Input: user types German
      Check: exact match (trim, lowercase) → correct/wrong
      Rate derived from: correct = Good, wrong = Again
3. SM-2 update → save UserCard
4. Session end → save StudySession, update streak
```

---

## 7. Sentence Drill Mode

- Select a word (or random from due cards)
- Fetch sentences for that word (DWDS first, then AI-generated)
- Display sentence with the target word blanked: `Ich esse gerne _____.`
- User fills blank, check answer
- AI Generate button → calls `/api/ai/sentences` → LM Studio or OpenRouter
- Prompt template: *"Generate 3 example sentences in German using the word '{word}' at A2/B1 level. Include English translations. Keep sentences practical and about daily life."*

---

## 8. AI Provider Config

Stored per user in `User.aiProvider / aiBaseUrl / aiApiKey / aiModel`.

| Provider | Base URL | Auth |
|----------|----------|------|
| LM Studio | `http://localhost:1234/v1` (user-editable) | none |
| OpenRouter | `https://openrouter.ai/api/v1` | Bearer API key |
| None | — | — |

All calls use `openai` npm package. Recommended local model: **Qwen2.5 7B Instruct Q4_K_M** (~5GB VRAM, fits RTX 4060 8GB).

**Graceful fallback:** `try/catch` on every AI call. On failure: show "AI sentences unavailable — check your AI settings" in UI. No crash, no unhandled error.

---

## 9. Dashboard

- **Streak card** — current streak (days), longest streak
- **Today card** — cards reviewed today, accuracy %
- **Progress doughnut** — NEW / LEARNING / REVIEW / MASTERED counts
- **Activity heatmap** — GitHub-style, last 365 days, colored by cards reviewed
- **Accuracy line chart** — last 30 days
- **Forecast bar chart** — cards due today / tomorrow / next 7 days

Charts: Recharts library.

---

## 10. External API Usage

| API | When called | Cached? |
|-----|-------------|---------|
| Wiktionary REST | Seed time + on word-add | In DB |
| DWDS | Seed time + on word-add | In DB |
| DeepL | Seed time (translations) | In DB |
| Unsplash | Seed time + on word-add | `imageUrl` in DB |
| Web Speech API | On audio button click | No (browser) |
| LM Studio/OpenRouter | On "Generate sentences" click | Optional save to DB |

Unsplash images stored as URLs (not downloaded). DeepL and Wiktionary data stored in Word/ExampleSentence rows at seed time — no runtime calls for core study flow.

---

## 11. Auth

NextAuth.js v5 with:
- Google OAuth provider
- Credentials provider (email + bcrypt password)

Session strategy: database sessions. Prisma adapter.

---

## 12. Theming

`next-themes` + Tailwind CSS v4 dark mode (`dark:` variants). Toggle in `/settings` and header. Preference persisted in localStorage.

---

## 13. Seed Data

`/prisma/seed.ts` script:
1. Load 1000 German words from `/data/words.json` (frequency-ranked, pre-categorized)
2. For each word: call Wiktionary for gender/plural, DWDS for sentences, Unsplash for image
3. Insert Categories, Words, ExampleSentences

Words JSON sourced from Wiktionary frequency lists + manual curation for A2/B1 relevance.

---

## 14. Tech Stack Summary

| Concern | Choice |
|---------|--------|
| Framework | Next.js 15, App Router, TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui + next-themes |
| Database | PostgreSQL 16 (Docker) |
| ORM | Prisma 5 |
| Auth | NextAuth.js v5 |
| Charts | Recharts |
| AI client | openai npm pkg (LM Studio + OpenRouter compatible) |
| SRS | Custom SM-2 in TypeScript |
| Audio | Web Speech API (browser-native) |
