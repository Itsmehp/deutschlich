# Grammar Tracks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured A2/B1/B2 German grammar curriculum to Deutschlich — tracks of topics, each with a curated explanation and an AI-grown drill pool, with per-topic mastery tracked by the existing SM-2 engine.

**Architecture:** Additive Prisma models (GrammarTrack/Topic/Drill/TopicProgress/Attempt). Pure-logic libs (grammar-srs, grammar-check, grammar-ai) built TDD. API routes follow the existing `{data,error}` + `auth()` patterns. React pages under `app/(app)/grammar/` reuse shadcn/ui + dark-mode tokens. Mastery reuses `applyReview()` from `lib/sm2.ts` unchanged.

**Tech Stack:** Next.js 16 (App Router, TS strict), Prisma 7 + @prisma/adapter-pg, PostgreSQL 16, NextAuth v5 (JWT), shadcn/ui, Tailwind v4, openai SDK (LM Studio / OpenRouter), Jest + ts-jest.

## Global Constraints

- TypeScript strict mode — no `any`
- All API routes return `{ data?: T; error?: string }`; 401 when unauthenticated
- Prisma singleton `db` from `@/lib/prisma` only — never `new PrismaClient()` elsewhere
- Auth via `auth()` from `@/lib/auth`; user id at `session.user.id`
- Reuse `applyReview`, `Rating`, `SM2Card` from `@/lib/sm2` — do NOT write a new SRS algorithm
- AI calls always wrapped in try/catch — never throw to client; AI-off returns `{ data, message }` not an error status
- Dark mode on every component via design tokens / Tailwind `dark:` variants
- Drill types: `"CLOZE" | "MC" | "TRANSFORM" | "BUILD"`; statuses `"NEW" | "LEARNING" | "REVIEW" | "MASTERED"`; levels `"A2" | "B1" | "B2"`
- Deterministic checks (CLOZE/TRANSFORM) use `normalizeAnswer()` from `@/lib/grammar-check` (ß↔ss, umlaut tolerance)
- Node 20+, follow existing file/casing conventions

---

## File Structure

```
prisma/
  schema.prisma                         ← MODIFY: add 5 grammar models + back-relations
  seed-grammar.ts                       ← NEW: seed tracks/topics/baseline drills
data/
  grammar.json                          ← NEW: curriculum content (tracks, topics, drills)
lib/
  grammar-check.ts                      ← NEW: answer normalization
  grammar-srs.ts                        ← NEW: drill result → SM-2 adapter
  grammar-ai.ts                         ← NEW: AI drill generation + BUILD grading + explain
  grammar-suggest.ts                    ← NEW: "next suggested topic" selection
app/api/grammar/
  tracks/route.ts                       ← NEW: GET overview + suggestion
  topics/[slug]/route.ts                ← NEW: GET topic detail
  drills/route.ts                       ← NEW: POST serve/generate drills
  attempt/route.ts                      ← NEW: POST log + SM-2 update
  grade/route.ts                        ← NEW: POST AI-grade BUILD
  explain/route.ts                      ← NEW: POST AI explain-deeper
components/grammar/
  TrackCard.tsx                         ← NEW: track overview card
  TopicProgressRing.tsx                 ← NEW: small mastery ring
  DrillCloze.tsx                        ← NEW: cloze + transform input drill
  DrillMultipleChoice.tsx               ← NEW: MC drill
  DrillBuild.tsx                        ← NEW: AI-graded build drill
  GrammarDrillSession.tsx               ← NEW: orchestrates a drill session
  ExplainDeeper.tsx                     ← NEW: AI explain button + panel
app/(app)/grammar/
  page.tsx                              ← NEW: track overview
  [topic]/page.tsx                      ← NEW: topic detail
  [topic]/drill/page.tsx                ← NEW: drill session host
components/layout/Navbar.tsx            ← MODIFY: add "Grammar" link
__tests__/lib/
  grammar-check.test.ts                 ← NEW
  grammar-srs.test.ts                   ← NEW
  grammar-suggest.test.ts               ← NEW
  grammar-ai.test.ts                    ← NEW
```

---

## Task 1: Grammar Prisma Models

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma models `GrammarTrack`, `GrammarTopic`, `GrammarDrill`, `GrammarTopicProgress`, `GrammarAttempt` and their generated TS types from `@prisma/client`.

- [ ] **Step 1: Append grammar models to schema.prisma**

Add at the end of `prisma/schema.prisma`:

```prisma
model GrammarTrack {
  id          String         @id @default(cuid())
  name        String
  slug        String         @unique
  color       String
  icon        String
  order       Int
  description String
  topics      GrammarTopic[]
}

model GrammarTopic {
  id            String                 @id @default(cuid())
  slug          String                 @unique
  title         String
  trackId       String
  track         GrammarTrack           @relation(fields: [trackId], references: [id])
  level         String
  order         Int
  summary       String
  prerequisites String[]
  drillTypes    String[]
  drills        GrammarDrill[]
  progress      GrammarTopicProgress[]
  attempts      GrammarAttempt[]
}

model GrammarDrill {
  id          String       @id @default(cuid())
  topicId     String
  topic       GrammarTopic @relation(fields: [topicId], references: [id])
  type        String
  prompt      String
  answer      String
  options     String[]
  englishHint String?
  explanation String
  usesWordId  String?
  usesWord    Word?        @relation(fields: [usesWordId], references: [id])
  source      String
  createdAt   DateTime     @default(now())
}

model GrammarTopicProgress {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  topicId        String
  topic          GrammarTopic @relation(fields: [topicId], references: [id])
  status         String       @default("NEW")
  easeFactor     Float        @default(2.5)
  interval       Int          @default(0)
  repetitions    Int          @default(0)
  nextReviewAt   DateTime     @default(now())
  lastReviewedAt DateTime?
  totalCorrect   Int          @default(0)
  totalWrong     Int          @default(0)
  @@unique([userId, topicId])
}

model GrammarAttempt {
  id         String       @id @default(cuid())
  userId     String
  user       User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  drillId    String
  topicId    String
  topic      GrammarTopic @relation(fields: [topicId], references: [id])
  correct    Boolean
  userAnswer String
  createdAt  DateTime     @default(now())
}
```

- [ ] **Step 2: Add back-relations to existing models**

In `prisma/schema.prisma`, add these relation fields.

To `model User { ... }` add:
```prisma
  grammarProgress GrammarTopicProgress[]
  grammarAttempts GrammarAttempt[]
```

To `model Word { ... }` add:
```prisma
  grammarDrills GrammarDrill[]
```

- [ ] **Step 3: Create and apply migration**

Ensure Docker Postgres is running (`docker-compose up -d`), then:
```bash
npx prisma migrate dev --name add_grammar_models
```
Expected: migration `add_grammar_models` created and applied; `npx prisma generate` runs automatically. No errors.

- [ ] **Step 4: Verify types generated**

```bash
npx prisma studio
```
Expected: the 5 new tables (GrammarTrack, GrammarTopic, GrammarDrill, GrammarTopicProgress, GrammarAttempt) appear, all empty. Close studio.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add grammar Prisma models (tracks, topics, drills, progress, attempts)"
```

---

## Task 2: Answer Normalization (`lib/grammar-check.ts`)

**Files:**
- Create: `lib/grammar-check.ts`
- Test: `__tests__/lib/grammar-check.test.ts`

**Interfaces:**
- Produces:
  - `normalizeAnswer(input: string): string`
  - `isCorrect(userAnswer: string, expected: string): boolean`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/grammar-check.test.ts`:

```ts
import { normalizeAnswer, isCorrect } from "@/lib/grammar-check";

describe("normalizeAnswer", () => {
  it("trims and lowercases", () => {
    expect(normalizeAnswer("  Dem  ")).toBe("dem");
  });
  it("collapses internal whitespace", () => {
    expect(normalizeAnswer("in  die   Schule")).toBe("in die schule");
  });
  it("converts ß to ss", () => {
    expect(normalizeAnswer("Straße")).toBe("strasse");
  });
  it("converts umlauts to ae/oe/ue", () => {
    expect(normalizeAnswer("Tür")).toBe("tuer");
    expect(normalizeAnswer("schön")).toBe("schoen");
    expect(normalizeAnswer("Äpfel")).toBe("aepfel");
  });
});

describe("isCorrect", () => {
  it("matches exact after normalization", () => {
    expect(isCorrect("dem", "dem")).toBe(true);
  });
  it("accepts ß typed as ss", () => {
    expect(isCorrect("strasse", "Straße")).toBe(true);
  });
  it("accepts umlaut typed as ue", () => {
    expect(isCorrect("Tuer", "Tür")).toBe(true);
  });
  it("accepts umlaut form on both sides", () => {
    expect(isCorrect("schön", "schoen")).toBe(true);
  });
  it("rejects wrong answer", () => {
    expect(isCorrect("den", "dem")).toBe(false);
  });
  it("rejects empty input", () => {
    expect(isCorrect("", "dem")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- grammar-check
```
Expected: FAIL — "Cannot find module '@/lib/grammar-check'".

- [ ] **Step 3: Implement `lib/grammar-check.ts`**

```ts
// lib/grammar-check.ts
// Normalize a German answer for deterministic comparison.
// Tolerates ß↔ss and umlaut↔ae/oe/ue so typed answers without special
// characters still count as correct.
export function normalizeAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue");
}

export function isCorrect(userAnswer: string, expected: string): boolean {
  const a = normalizeAnswer(userAnswer);
  if (a.length === 0) return false;
  return a === normalizeAnswer(expected);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- grammar-check
```
Expected: PASS (10/10).

- [ ] **Step 5: Commit**

```bash
git add lib/grammar-check.ts __tests__/lib/grammar-check.test.ts
git commit -m "feat: grammar answer normalization with ß/umlaut tolerance"
```

---

## Task 3: Grammar SRS Adapter (`lib/grammar-srs.ts`)

**Files:**
- Create: `lib/grammar-srs.ts`
- Test: `__tests__/lib/grammar-srs.test.ts`

**Interfaces:**
- Consumes: `applyReview`, `Rating`, `SM2Card` from `@/lib/sm2`
- Produces:
  - `drillResultToRating(correct: boolean): Rating`
  - `applyGrammarReview(card: SM2Card, correct: boolean): SM2Card`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/grammar-srs.test.ts`:

```ts
import { drillResultToRating, applyGrammarReview } from "@/lib/grammar-srs";
import type { SM2Card } from "@/lib/sm2";

const base: SM2Card = {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
  nextReviewAt: new Date(),
  status: "NEW",
};

describe("drillResultToRating", () => {
  it("maps correct to 3 (Good)", () => {
    expect(drillResultToRating(true)).toBe(3);
  });
  it("maps wrong to 1 (Again)", () => {
    expect(drillResultToRating(false)).toBe(1);
  });
});

describe("applyGrammarReview", () => {
  it("correct advances repetitions and interval", () => {
    const r = applyGrammarReview(base, true);
    expect(r.repetitions).toBe(1);
    expect(r.interval).toBe(1);
  });
  it("wrong resets interval and repetitions", () => {
    const r = applyGrammarReview({ ...base, repetitions: 3, interval: 10 }, false);
    expect(r.interval).toBe(0);
    expect(r.repetitions).toBe(0);
    expect(r.status).toBe("LEARNING");
  });
  it("sets nextReviewAt in the future on correct", () => {
    const r = applyGrammarReview(base, true);
    expect(r.nextReviewAt.getTime()).toBeGreaterThan(Date.now());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- grammar-srs
```
Expected: FAIL — "Cannot find module '@/lib/grammar-srs'".

- [ ] **Step 3: Implement `lib/grammar-srs.ts`**

```ts
// lib/grammar-srs.ts
// Adapter that maps a grammar-drill result onto the existing SM-2 engine.
// Correct answers behave like a "Good" rating; wrong answers like "Again".
import { applyReview, type Rating, type SM2Card } from "@/lib/sm2";

export function drillResultToRating(correct: boolean): Rating {
  return correct ? 3 : 1;
}

export function applyGrammarReview(card: SM2Card, correct: boolean): SM2Card {
  return applyReview(card, drillResultToRating(correct));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- grammar-srs
```
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add lib/grammar-srs.ts __tests__/lib/grammar-srs.test.ts
git commit -m "feat: grammar SRS adapter over existing SM-2 engine"
```

---

## Task 4: Next-Topic Suggestion (`lib/grammar-suggest.ts`)

**Files:**
- Create: `lib/grammar-suggest.ts`
- Test: `__tests__/lib/grammar-suggest.test.ts`

**Interfaces:**
- Produces:
  - types `SuggestTopic` and `SuggestProgress`
  - `suggestNextTopic(topics: SuggestTopic[], progressByTopicId: Record<string, SuggestProgress>): string | null` — returns the slug of the next topic, or null.

Selection rule (from spec §5): among topics whose prerequisites are all MASTERED or REVIEW (topics with no prerequisites always qualify), pick:
(a) a topic that is due (nextReviewAt ≤ now) with the lowest accuracy; else
(b) the lowest-`order` topic with no progress (NEW / no row).
Accuracy = totalCorrect / (totalCorrect + totalWrong); treat no attempts as accuracy 1 (not weak).

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/grammar-suggest.test.ts`:

```ts
import { suggestNextTopic, type SuggestTopic, type SuggestProgress } from "@/lib/grammar-suggest";

const topics: SuggestTopic[] = [
  { id: "t1", slug: "a", order: 1, prerequisites: [] },
  { id: "t2", slug: "b", order: 2, prerequisites: ["a"] },
  { id: "t3", slug: "c", order: 3, prerequisites: ["a"] },
];

function prog(p: Partial<SuggestProgress>): SuggestProgress {
  return {
    status: "NEW",
    nextReviewAt: new Date(Date.now() + 86400000),
    totalCorrect: 0,
    totalWrong: 0,
    ...p,
  };
}

describe("suggestNextTopic", () => {
  it("suggests the lowest-order unstarted topic when nothing is due", () => {
    expect(suggestNextTopic(topics, {})).toBe("a");
  });

  it("does not suggest a topic with unmet prerequisites", () => {
    // 'a' has progress but is only LEARNING (not REVIEW/MASTERED),
    // so 'b' and 'c' are locked; 'a' itself is unstarted-elsewhere -> still 'a'
    const byId = { t1: prog({ status: "LEARNING" }) };
    expect(suggestNextTopic(topics, byId)).toBe("a");
  });

  it("unlocks dependents once prerequisite is MASTERED", () => {
    const byId = { t1: prog({ status: "MASTERED" }) };
    // a done; next unstarted lowest-order among unlocked is 'b'
    expect(suggestNextTopic(topics, byId)).toBe("b");
  });

  it("prefers a due topic with lowest accuracy over an unstarted one", () => {
    const byId = {
      t1: prog({ status: "MASTERED" }),
      t2: prog({
        status: "REVIEW",
        nextReviewAt: new Date(Date.now() - 1000),
        totalCorrect: 2,
        totalWrong: 8, // 20% accuracy, due
      }),
    };
    // 'b' is due and weak -> beats unstarted 'c'
    expect(suggestNextTopic(topics, byId)).toBe("b");
  });

  it("returns null when all topics are mastered and none due", () => {
    const byId = {
      t1: prog({ status: "MASTERED" }),
      t2: prog({ status: "MASTERED" }),
      t3: prog({ status: "MASTERED" }),
    };
    expect(suggestNextTopic(topics, byId)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- grammar-suggest
```
Expected: FAIL — "Cannot find module '@/lib/grammar-suggest'".

- [ ] **Step 3: Implement `lib/grammar-suggest.ts`**

```ts
// lib/grammar-suggest.ts
// Pick the next grammar topic to study: prefer a due, weak, unlocked topic;
// otherwise the lowest-order unlocked topic the user has not started.
export interface SuggestTopic {
  id: string;
  slug: string;
  order: number;
  prerequisites: string[]; // slugs
}

export interface SuggestProgress {
  status: string; // NEW|LEARNING|REVIEW|MASTERED
  nextReviewAt: Date;
  totalCorrect: number;
  totalWrong: number;
}

function accuracy(p: SuggestProgress): number {
  const total = p.totalCorrect + p.totalWrong;
  if (total === 0) return 1; // no attempts -> not "weak"
  return p.totalCorrect / total;
}

export function suggestNextTopic(
  topics: SuggestTopic[],
  progressByTopicId: Record<string, SuggestProgress>
): string | null {
  const slugStatus = new Map<string, string>();
  for (const t of topics) {
    const pr = progressByTopicId[t.id];
    slugStatus.set(t.slug, pr?.status ?? "NEW");
  }

  const prereqsMet = (t: SuggestTopic) =>
    t.prerequisites.every((slug) => {
      const s = slugStatus.get(slug);
      return s === "MASTERED" || s === "REVIEW";
    });

  const unlocked = topics.filter(prereqsMet);
  const now = Date.now();

  // (a) due + unlocked, lowest accuracy (tie -> lowest order)
  const due = unlocked
    .map((t) => ({ t, pr: progressByTopicId[t.id] }))
    .filter(({ pr }) => pr && pr.nextReviewAt.getTime() <= now && pr.status !== "MASTERED")
    .sort((x, y) => {
      const ax = accuracy(x.pr!);
      const ay = accuracy(y.pr!);
      if (ax !== ay) return ax - ay;
      return x.t.order - y.t.order;
    });
  if (due.length > 0) return due[0].t.slug;

  // (b) lowest-order unlocked topic with no progress / NEW
  const unstarted = unlocked
    .filter((t) => {
      const pr = progressByTopicId[t.id];
      return !pr || pr.status === "NEW";
    })
    .sort((x, y) => x.order - y.order);
  if (unstarted.length > 0) return unstarted[0].slug;

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- grammar-suggest
```
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add lib/grammar-suggest.ts __tests__/lib/grammar-suggest.test.ts
git commit -m "feat: next grammar topic suggestion logic"
```

---

## Task 5: Grammar AI Lib (`lib/grammar-ai.ts`)

**Files:**
- Create: `lib/grammar-ai.ts`
- Test: `__tests__/lib/grammar-ai.test.ts`

**Interfaces:**
- Consumes: provider config shape `{ provider, baseUrl, apiKey, model }` (same as `lib/ai.ts`)
- Produces:
  - types `AiConfig`, `GeneratedDrill`, `BuildGrade`
  - `parseGeneratedDrills(text: string): GeneratedDrill[]` (pure — tested)
  - `parseBuildGrade(text: string): BuildGrade | null` (pure — tested)
  - `generateDrills(opts, config): Promise<GeneratedDrill[]>`
  - `gradeBuild(opts, config): Promise<BuildGrade | null>`
  - `explainDeeper(opts, config): Promise<string | null>`

The pure parsers carry the tested logic; the async functions wrap the OpenAI client (same construction as `lib/ai.ts`) in try/catch and delegate to the parsers. Only the parsers are unit-tested.

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/grammar-ai.test.ts`:

```ts
import { parseGeneratedDrills, parseBuildGrade } from "@/lib/grammar-ai";

describe("parseGeneratedDrills", () => {
  it("parses a valid drill array", () => {
    const text = `Here you go:
    [{"type":"CLOZE","prompt":"Ich gehe ___ Schule","answer":"zur","englishHint":"to school","explanation":"zu + der = zur"}]`;
    const drills = parseGeneratedDrills(text);
    expect(drills).toHaveLength(1);
    expect(drills[0].type).toBe("CLOZE");
    expect(drills[0].answer).toBe("zur");
  });

  it("keeps only objects with required string fields", () => {
    const text = `[
      {"type":"MC","prompt":"x","answer":"a","options":["a","b"],"explanation":"e"},
      {"type":"CLOZE","answer":"missing prompt","explanation":"e"},
      {"prompt":"no type","answer":"a","explanation":"e"}
    ]`;
    const drills = parseGeneratedDrills(text);
    expect(drills).toHaveLength(1);
    expect(drills[0].type).toBe("MC");
  });

  it("rejects unknown drill types", () => {
    const text = `[{"type":"ESSAY","prompt":"x","answer":"a","explanation":"e"}]`;
    expect(parseGeneratedDrills(text)).toHaveLength(0);
  });

  it("returns [] when no JSON array present", () => {
    expect(parseGeneratedDrills("sorry, no idea")).toHaveLength(0);
  });

  it("returns [] on malformed JSON", () => {
    expect(parseGeneratedDrills("[{type:CLOZE,}]")).toHaveLength(0);
  });
});

describe("parseBuildGrade", () => {
  it("parses a valid grade object", () => {
    const text = `{"correct":false,"corrected":"Ich bin müde","errors":["wrong verb"],"explanation":"sein not haben"}`;
    const g = parseBuildGrade(text);
    expect(g).not.toBeNull();
    expect(g!.correct).toBe(false);
    expect(g!.errors).toEqual(["wrong verb"]);
  });

  it("coerces missing errors to empty array", () => {
    const text = `{"correct":true,"corrected":"Ich bin müde","explanation":"ok"}`;
    const g = parseBuildGrade(text);
    expect(g!.errors).toEqual([]);
  });

  it("returns null when no JSON object present", () => {
    expect(parseBuildGrade("hmm")).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    expect(parseBuildGrade("{correct:true}")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- grammar-ai
```
Expected: FAIL — "Cannot find module '@/lib/grammar-ai'".

- [ ] **Step 3: Implement `lib/grammar-ai.ts`**

```ts
// lib/grammar-ai.ts
import OpenAI from "openai";

export interface AiConfig {
  provider: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
}

const DRILL_TYPES = ["CLOZE", "MC", "TRANSFORM", "BUILD"] as const;
type DrillType = (typeof DRILL_TYPES)[number];

export interface GeneratedDrill {
  type: DrillType;
  prompt: string;
  answer: string;
  options?: string[];
  englishHint?: string;
  explanation: string;
}

export interface BuildGrade {
  correct: boolean;
  corrected: string;
  errors: string[];
  explanation: string;
}

// ---- Pure parsers (unit-tested) ----

export function parseGeneratedDrills(text: string): GeneratedDrill[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidDrill);
}

function isValidDrill(d: unknown): d is GeneratedDrill {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  if (typeof o.type !== "string" || !DRILL_TYPES.includes(o.type as DrillType)) return false;
  if (typeof o.prompt !== "string" || o.prompt.length === 0) return false;
  if (typeof o.answer !== "string") return false;
  if (typeof o.explanation !== "string") return false;
  if (o.options !== undefined && !Array.isArray(o.options)) return false;
  return true;
}

export function parseBuildGrade(text: string): BuildGrade | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.correct !== "boolean") return null;
  if (typeof o.corrected !== "string") return null;
  if (typeof o.explanation !== "string") return null;
  const errors = Array.isArray(o.errors) ? o.errors.filter((e) => typeof e === "string") : [];
  return {
    correct: o.correct,
    corrected: o.corrected,
    errors: errors as string[],
    explanation: o.explanation,
  };
}

// ---- Client construction (mirrors lib/ai.ts) ----

function makeClient(config: AiConfig): { client: OpenAI; model: string; isOpenRouter: boolean } | null {
  if (!config.provider) return null;
  const isOpenRouter = config.provider === "openrouter";
  const client = new OpenAI({
    apiKey: config.apiKey ?? "not-needed",
    baseURL: isOpenRouter
      ? "https://openrouter.ai/api/v1"
      : (config.baseUrl ?? "http://localhost:1234/v1"),
    defaultHeaders: isOpenRouter
      ? { "HTTP-Referer": "http://localhost:3000", "X-Title": "Deutschlich" }
      : undefined,
  });
  const model = config.model ?? (isOpenRouter ? "openai/gpt-oss-120b:free" : "local-model");
  return { client, model, isOpenRouter };
}

async function chat(
  config: AiConfig,
  system: string,
  user: string
): Promise<string> {
  const made = makeClient(config);
  if (!made) return "";
  const { client, model, isOpenRouter } = made;
  const request = {
    model,
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ],
    temperature: 0.7,
    max_tokens: 1500,
    ...(isOpenRouter ? { reasoning: { effort: "low", exclude: true } } : {}),
  };
  const response = await client.chat.completions.create(
    request as Parameters<typeof client.chat.completions.create>[0]
  );
  const message = (
    response as {
      choices?: Array<{ message?: { content?: string | null; reasoning_content?: string | null } }>;
    }
  ).choices?.[0]?.message;
  return message?.content || message?.reasoning_content || "";
}

// ---- Async API ----

export async function generateDrills(
  opts: { topicTitle: string; summary: string; type: DrillType; word?: string | null },
  config: AiConfig
): Promise<GeneratedDrill[]> {
  try {
    const wordClause = opts.word
      ? ` Where natural, use the German word "${opts.word}".`
      : "";
    const text = await chat(
      config,
      "You are a German grammar exercise generator. Respond with ONLY a valid JSON array — no prose, no markdown fences.",
      `Topic: "${opts.topicTitle}".\nRule: ${opts.summary}\nGenerate exactly 4 drills of type ${opts.type} for A2-B2 learners.${wordClause}\n` +
        `Each item: {"type":"${opts.type}","prompt":"<German; use ___ for a blank in CLOZE>","answer":"<correct answer>",` +
        `${opts.type === "MC" ? `"options":["<4 options incl. the answer>"],` : ""}"englishHint":"<English meaning>","explanation":"<English why + German example>"}\n` +
        `Respond ONLY with the JSON array.`
    );
    return parseGeneratedDrills(text);
  } catch {
    return [];
  }
}

export async function gradeBuild(
  opts: { englishHint: string; topicTitle: string; userSentence: string },
  config: AiConfig
): Promise<BuildGrade | null> {
  try {
    const text = await chat(
      config,
      "You are a German grammar examiner. Respond with ONLY a valid JSON object — no prose, no markdown fences.",
      `The learner is practicing: "${opts.topicTitle}".\nIntended meaning (English): "${opts.englishHint}".\n` +
        `Learner's German sentence: "${opts.userSentence}".\n` +
        `Judge grammar correctness. Respond ONLY with: {"correct":<bool>,"corrected":"<corrected German>","errors":["<short English error>"],"explanation":"<English explanation>"}`
    );
    return parseBuildGrade(text);
  } catch {
    return null;
  }
}

export async function explainDeeper(
  opts: { topicTitle: string; summary: string },
  config: AiConfig
): Promise<string | null> {
  try {
    const text = await chat(
      config,
      "You are a German grammar teacher. Explain clearly in English with German examples. Use short markdown.",
      `Explain the topic "${opts.topicTitle}" in more depth than this summary:\n${opts.summary}\n` +
        `Give 3 extra example sentences (German + English) and one common mistake to avoid.`
    );
    return text.trim().length > 0 ? text.trim() : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- grammar-ai
```
Expected: PASS (9/9).

- [ ] **Step 5: Commit**

```bash
git add lib/grammar-ai.ts __tests__/lib/grammar-ai.test.ts
git commit -m "feat: grammar AI lib — drill generation, BUILD grading, explain (with tested parsers)"
```

---

## Task 6: Curriculum Data + Seed Script

**Files:**
- Create: `data/grammar.json`
- Create: `prisma/seed-grammar.ts`
- Modify: `package.json` (add a script entry)

**Interfaces:**
- Produces: seeded `GrammarTrack`, `GrammarTopic`, and baseline `SEEDED` `GrammarDrill` rows.

- [ ] **Step 1: Create `data/grammar.json`**

Structure: an array of tracks; each track has `topics`; each topic has `drills`. Include all 4 tracks and all ~33 topics from spec §4. For brevity here, the file MUST contain every topic listed in the spec; below is the exact shape plus a fully-worked sample for the first topic of each track. Author the remaining topics following the same shape, each with a `summary` (English rule + 2-4 German examples) and at least 4 baseline drills spanning the topic's `drillTypes`.

```json
[
  {
    "name": "Cases (Fälle)",
    "slug": "cases",
    "color": "blue",
    "icon": "🎯",
    "order": 1,
    "description": "German's four cases and the endings they trigger.",
    "topics": [
      {
        "slug": "nominativ-akkusativ-basics",
        "title": "Nominativ & Akkusativ basics",
        "level": "A2",
        "order": 1,
        "prerequisites": [],
        "drillTypes": ["CLOZE", "MC"],
        "summary": "The **Nominativ** is the subject (who does the action); the **Akkusativ** is the direct object. Only masculine articles change in the Akkusativ: `der → den`, `ein → einen`. Feminine, neuter, and plural stay the same.\n\n- _Der Mann liest ein Buch._ (Nom: der Mann, Akk: ein Buch)\n- _Ich sehe **den** Hund._ (Akk masculine)\n- _Sie kauft **eine** Tasche._ (Akk feminine unchanged)",
        "drills": [
          { "type": "MC", "prompt": "Ich sehe ___ Hund.", "answer": "den", "options": ["der", "den", "dem", "des"], "englishHint": "I see the dog.", "explanation": "Masculine Akkusativ: der → den." },
          { "type": "CLOZE", "prompt": "Der Mann kauft ___ Apfel. (ein)", "answer": "einen", "englishHint": "The man buys an apple.", "explanation": "Masculine Akkusativ: ein → einen." },
          { "type": "CLOZE", "prompt": "Ich trinke ___ Wasser. (das)", "answer": "das", "englishHint": "I drink the water.", "explanation": "Neuter is unchanged in the Akkusativ." },
          { "type": "MC", "prompt": "___ Frau liest. (subject)", "answer": "Die", "options": ["Die", "Den", "Dem", "Der"], "englishHint": "The woman reads.", "explanation": "Subject = Nominativ; feminine = die." }
        ]
      }
    ]
  }
]
```

Author the rest using the spec §4 list. Required topics per track (slugs):
- **cases:** nominativ-akkusativ-basics, dativ-basics, possessive-articles, akkusativ-vs-dativ, adjective-endings-definite, adjective-endings-indefinite, adjective-endings-no-article, genitiv, n-deklination
- **verbs:** modal-verbs, perfekt-haben-sein, imperativ, separable-verbs-present, perfekt-vs-praeteritum, reflexive-verbs, konjunktiv-ii, plusquamperfekt, passiv, konjunktiv-i
- **word-order:** basic-v2, coordinating-conjunctions, main-clause-v2, subordinate-clauses, tekamolo, connectors, relative-clauses
- **prepositions:** akkusativ-prepositions, dativ-prepositions, comparison, wechselpraepositionen, fixed-prep-case, verb-preposition, adjective-preposition

Use the exact prerequisites from spec §4. Each topic: `summary` + ≥4 drills.

- [ ] **Step 2: Create `prisma/seed-grammar.ts`**

```ts
// prisma/seed-grammar.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

interface DrillData {
  type: string;
  prompt: string;
  answer: string;
  options?: string[];
  englishHint?: string;
  explanation: string;
}
interface TopicData {
  slug: string;
  title: string;
  level: string;
  order: number;
  prerequisites: string[];
  drillTypes: string[];
  summary: string;
  drills: DrillData[];
}
interface TrackData {
  name: string;
  slug: string;
  color: string;
  icon: string;
  order: number;
  description: string;
  topics: TopicData[];
}

async function main() {
  const tracks: TrackData[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data/grammar.json"), "utf-8")
  );

  for (const track of tracks) {
    const createdTrack = await db.grammarTrack.upsert({
      where: { slug: track.slug },
      update: { name: track.name, color: track.color, icon: track.icon, order: track.order, description: track.description },
      create: {
        name: track.name, slug: track.slug, color: track.color,
        icon: track.icon, order: track.order, description: track.description,
      },
    });

    for (const topic of track.topics) {
      const createdTopic = await db.grammarTopic.upsert({
        where: { slug: topic.slug },
        update: {
          title: topic.title, level: topic.level, order: topic.order,
          summary: topic.summary, prerequisites: topic.prerequisites,
          drillTypes: topic.drillTypes, trackId: createdTrack.id,
        },
        create: {
          slug: topic.slug, title: topic.title, level: topic.level,
          order: topic.order, summary: topic.summary,
          prerequisites: topic.prerequisites, drillTypes: topic.drillTypes,
          trackId: createdTrack.id,
        },
      });

      // Seed baseline drills only if this topic has none yet (idempotent).
      const existing = await db.grammarDrill.count({
        where: { topicId: createdTopic.id, source: "SEEDED" },
      });
      if (existing === 0) {
        for (const d of topic.drills) {
          await db.grammarDrill.create({
            data: {
              topicId: createdTopic.id,
              type: d.type,
              prompt: d.prompt,
              answer: d.answer,
              options: d.options ?? [],
              englishHint: d.englishHint ?? null,
              explanation: d.explanation,
              source: "SEEDED",
            },
          });
        }
      }
    }
  }

  const trackCount = await db.grammarTrack.count();
  const topicCount = await db.grammarTopic.count();
  const drillCount = await db.grammarDrill.count();
  console.log(`Grammar seeded: ${trackCount} tracks, ${topicCount} topics, ${drillCount} drills.`);
}

main().catch(console.error).finally(() => db.$disconnect());
```

- [ ] **Step 3: Add a script entry to `package.json`**

In `package.json` `"scripts"`, add:
```json
"seed:grammar": "tsx prisma/seed-grammar.ts"
```

- [ ] **Step 4: Run the grammar seed**

```bash
npm run seed:grammar
```
Expected: prints `Grammar seeded: 4 tracks, 33 topics, N drills.` (N ≥ 132). Re-running does not duplicate drills (idempotent).

- [ ] **Step 5: Commit**

```bash
git add data/grammar.json prisma/seed-grammar.ts package.json
git commit -m "feat: grammar curriculum data + idempotent seed script"
```

---

## Task 7: Tracks Overview + Topic Detail API

**Files:**
- Create: `app/api/grammar/tracks/route.ts`
- Create: `app/api/grammar/topics/[slug]/route.ts`

**Interfaces:**
- Consumes: `db`, `auth()`, `suggestNextTopic` + types from `@/lib/grammar-suggest`
- Produces:
  - `GET /api/grammar/tracks` → `{ data: { tracks, suggestedTopicSlug } }`
  - `GET /api/grammar/topics/[slug]` → `{ data: { topic, progress, drillPoolSize } }`

- [ ] **Step 1: Create `app/api/grammar/tracks/route.ts`**

```ts
// app/api/grammar/tracks/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { suggestNextTopic, type SuggestTopic, type SuggestProgress } from "@/lib/grammar-suggest";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const tracks = await db.grammarTrack.findMany({
    orderBy: { order: "asc" },
    include: {
      topics: {
        orderBy: { order: "asc" },
        include: { progress: { where: { userId }, take: 1 } },
      },
    },
  });

  const allTopics: SuggestTopic[] = [];
  const progressByTopicId: Record<string, SuggestProgress> = {};
  for (const track of tracks) {
    for (const topic of track.topics) {
      allTopics.push({
        id: topic.id,
        slug: topic.slug,
        order: topic.order,
        prerequisites: topic.prerequisites,
      });
      const pr = topic.progress[0];
      if (pr) {
        progressByTopicId[topic.id] = {
          status: pr.status,
          nextReviewAt: pr.nextReviewAt,
          totalCorrect: pr.totalCorrect,
          totalWrong: pr.totalWrong,
        };
      }
    }
  }

  const suggestedTopicSlug = suggestNextTopic(allTopics, progressByTopicId);

  return NextResponse.json({ data: { tracks, suggestedTopicSlug } });
}
```

- [ ] **Step 2: Create `app/api/grammar/topics/[slug]/route.ts`**

```ts
// app/api/grammar/topics/[slug]/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { slug } = await params;

  const topic = await db.grammarTopic.findUnique({
    where: { slug },
    include: {
      track: true,
      progress: { where: { userId }, take: 1 },
    },
  });
  if (!topic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const drillPoolSize = await db.grammarDrill.count({ where: { topicId: topic.id } });

  return NextResponse.json({
    data: { topic, progress: topic.progress[0] ?? null, drillPoolSize },
  });
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: compiles; routes `/api/grammar/tracks` and `/api/grammar/topics/[slug]` appear in the manifest.

- [ ] **Step 4: Commit**

```bash
git add app/api/grammar/tracks/ app/api/grammar/topics/
git commit -m "feat: grammar tracks overview + topic detail API"
```

---

## Task 8: Drills + Attempt API

**Files:**
- Create: `app/api/grammar/drills/route.ts`
- Create: `app/api/grammar/attempt/route.ts`

**Interfaces:**
- Consumes: `db`, `auth()`, `generateDrills` + `AiConfig` from `@/lib/grammar-ai`, `applyGrammarReview` from `@/lib/grammar-srs`
- Produces:
  - `POST /api/grammar/drills` body `{ topicSlug, count? }` → `{ data: GrammarDrill[] }`
  - `POST /api/grammar/attempt` body `{ drillId, userAnswer, correct }` → `{ data: { progress } }`

- [ ] **Step 1: Create `app/api/grammar/drills/route.ts`**

```ts
// app/api/grammar/drills/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { generateDrills, type AiConfig } from "@/lib/grammar-ai";

const MIN_POOL = 8;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { topicSlug, count = 10 } = await req.json();

  const topic = await db.grammarTopic.findUnique({ where: { slug: topicSlug } });
  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  const poolSize = await db.grammarDrill.count({ where: { topicId: topic.id } });

  // Cache-and-grow: if the pool is thin, try to generate more (best-effort).
  if (poolSize < MIN_POOL) {
    const user = await db.user.findUnique({ where: { id: userId } });
    const config: AiConfig = {
      provider: user?.aiProvider ?? null,
      baseUrl: user?.aiBaseUrl ?? null,
      apiKey: user?.aiApiKey ?? null,
      model: user?.aiModel ?? null,
    };

    // Prefer one of the user's LEARNING/REVIEW words for contextual drills.
    const userWord = await db.userCard.findFirst({
      where: { userId, status: { in: ["LEARNING", "REVIEW"] } },
      orderBy: { nextReviewAt: "asc" },
      include: { word: true },
    });

    const types = (topic.drillTypes.length > 0 ? topic.drillTypes : ["CLOZE"]) as Array<
      "CLOZE" | "MC" | "TRANSFORM" | "BUILD"
    >;
    const genType = types[Math.floor(Math.random() * types.length)];

    const generated = await generateDrills(
      {
        topicTitle: topic.title,
        summary: topic.summary,
        type: genType,
        word: userWord?.word.german ?? null,
      },
      config
    );

    if (generated.length > 0) {
      await db.grammarDrill.createMany({
        data: generated.map((g) => ({
          topicId: topic.id,
          type: g.type,
          prompt: g.prompt,
          answer: g.answer,
          options: g.options ?? [],
          englishHint: g.englishHint ?? null,
          explanation: g.explanation,
          usesWordId: userWord?.wordId ?? null,
          source: "AI_GENERATED",
        })),
      });
    }
  }

  const drills = await db.grammarDrill.findMany({
    where: { topicId: topic.id },
    orderBy: { createdAt: "desc" },
    take: count,
  });

  if (drills.length === 0) {
    return NextResponse.json({
      data: [],
      message: "No drills cached yet for this topic. Enable AI in Settings to generate some.",
    });
  }

  return NextResponse.json({ data: drills });
}
```

- [ ] **Step 2: Create `app/api/grammar/attempt/route.ts`**

```ts
// app/api/grammar/attempt/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { applyGrammarReview } from "@/lib/grammar-srs";
import type { SM2Card } from "@/lib/sm2";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { drillId, userAnswer, correct } = await req.json();
  if (typeof drillId !== "string" || typeof correct !== "boolean") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const drill = await db.grammarDrill.findUnique({ where: { id: drillId } });
  if (!drill) return NextResponse.json({ error: "Drill not found" }, { status: 404 });

  await db.grammarAttempt.create({
    data: {
      userId,
      drillId,
      topicId: drill.topicId,
      correct,
      userAnswer: typeof userAnswer === "string" ? userAnswer : "",
    },
  });

  const existing = await db.grammarTopicProgress.findUnique({
    where: { userId_topicId: { userId, topicId: drill.topicId } },
  });

  const currentCard: SM2Card = {
    easeFactor: existing?.easeFactor ?? 2.5,
    interval: existing?.interval ?? 0,
    repetitions: existing?.repetitions ?? 0,
    nextReviewAt: existing?.nextReviewAt ?? new Date(),
    status: (existing?.status ?? "NEW") as SM2Card["status"],
  };

  const updated = applyGrammarReview(currentCard, correct);

  const progress = await db.grammarTopicProgress.upsert({
    where: { userId_topicId: { userId, topicId: drill.topicId } },
    update: {
      status: updated.status,
      easeFactor: updated.easeFactor,
      interval: updated.interval,
      repetitions: updated.repetitions,
      nextReviewAt: updated.nextReviewAt,
      lastReviewedAt: new Date(),
      totalCorrect: correct ? { increment: 1 } : undefined,
      totalWrong: !correct ? { increment: 1 } : undefined,
    },
    create: {
      userId,
      topicId: drill.topicId,
      status: updated.status,
      easeFactor: updated.easeFactor,
      interval: updated.interval,
      repetitions: updated.repetitions,
      nextReviewAt: updated.nextReviewAt,
      lastReviewedAt: new Date(),
      totalCorrect: correct ? 1 : 0,
      totalWrong: correct ? 0 : 1,
    },
  });

  return NextResponse.json({ data: { progress } });
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: compiles; `/api/grammar/drills` and `/api/grammar/attempt` in the route manifest.

- [ ] **Step 4: Commit**

```bash
git add app/api/grammar/drills/ app/api/grammar/attempt/
git commit -m "feat: grammar drills (cache-and-grow) + attempt logging with SM-2 update"
```

---

## Task 9: BUILD Grade + Explain API

**Files:**
- Create: `app/api/grammar/grade/route.ts`
- Create: `app/api/grammar/explain/route.ts`

**Interfaces:**
- Consumes: `db`, `auth()`, `gradeBuild`, `explainDeeper`, `AiConfig` from `@/lib/grammar-ai`
- Produces:
  - `POST /api/grammar/grade` body `{ drillId, userAnswer }` → `{ data: BuildGrade } | { data: null, message }`
  - `POST /api/grammar/explain` body `{ topicSlug }` → `{ data: { markdown } } | { data: null, message }`

- [ ] **Step 1: Create `app/api/grammar/grade/route.ts`**

```ts
// app/api/grammar/grade/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { gradeBuild, type AiConfig } from "@/lib/grammar-ai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { drillId, userAnswer } = await req.json();
  if (typeof drillId !== "string" || typeof userAnswer !== "string") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const drill = await db.grammarDrill.findUnique({
    where: { id: drillId },
    include: { topic: true },
  });
  if (!drill) return NextResponse.json({ error: "Drill not found" }, { status: 404 });

  const user = await db.user.findUnique({ where: { id: userId } });
  const config: AiConfig = {
    provider: user?.aiProvider ?? null,
    baseUrl: user?.aiBaseUrl ?? null,
    apiKey: user?.aiApiKey ?? null,
    model: user?.aiModel ?? null,
  };

  const grade = await gradeBuild(
    {
      englishHint: drill.englishHint ?? drill.prompt,
      topicTitle: drill.topic.title,
      userSentence: userAnswer,
    },
    config
  );

  if (!grade) {
    return NextResponse.json({
      data: null,
      message: user?.aiProvider
        ? "AI grading unavailable — try the other drill types or check AI settings."
        : "No AI provider configured — add one in Settings to grade build drills.",
    });
  }

  return NextResponse.json({ data: grade });
}
```

- [ ] **Step 2: Create `app/api/grammar/explain/route.ts`**

```ts
// app/api/grammar/explain/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { explainDeeper, type AiConfig } from "@/lib/grammar-ai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const { topicSlug } = await req.json();
  if (typeof topicSlug !== "string") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const topic = await db.grammarTopic.findUnique({ where: { slug: topicSlug } });
  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  const user = await db.user.findUnique({ where: { id: userId } });
  const config: AiConfig = {
    provider: user?.aiProvider ?? null,
    baseUrl: user?.aiBaseUrl ?? null,
    apiKey: user?.aiApiKey ?? null,
    model: user?.aiModel ?? null,
  };

  const markdown = await explainDeeper(
    { topicTitle: topic.title, summary: topic.summary },
    config
  );

  if (!markdown) {
    return NextResponse.json({
      data: null,
      message: user?.aiProvider
        ? "AI explanation unavailable — check your AI settings."
        : "No AI provider configured — add one in Settings.",
    });
  }

  return NextResponse.json({ data: { markdown } });
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: compiles; `/api/grammar/grade` and `/api/grammar/explain` in the manifest.

- [ ] **Step 4: Commit**

```bash
git add app/api/grammar/grade/ app/api/grammar/explain/
git commit -m "feat: grammar BUILD grading + explain-deeper API (graceful AI fallback)"
```

---

## Task 10: Drill Components

**Files:**
- Create: `components/grammar/DrillCloze.tsx`
- Create: `components/grammar/DrillMultipleChoice.tsx`
- Create: `components/grammar/DrillBuild.tsx`

**Interfaces:**
- Consumes: `isCorrect` from `@/lib/grammar-check`
- Produces (props contracts used by Task 11):
  - `DrillCloze({ drill, onResult }: { drill: DrillVM; onResult: (correct: boolean, userAnswer: string) => void })` — handles both `CLOZE` and `TRANSFORM`.
  - `DrillMultipleChoice({ drill, onResult }: { drill: DrillVM; onResult: (correct: boolean, userAnswer: string) => void })`
  - `DrillBuild({ drill, onResult }: { drill: DrillVM; onResult: (correct: boolean, userAnswer: string) => void })`
  - shared view-model type `DrillVM` (declared in Task 11's session file and imported; for these components, define a matching local interface as shown).

Each component renders the drill, lets the user answer, reveals correctness + explanation, then calls `onResult` when the user clicks "Next".

- [ ] **Step 1: Create `components/grammar/DrillCloze.tsx`**

```tsx
// components/grammar/DrillCloze.tsx
"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isCorrect } from "@/lib/grammar-check";

export interface DrillVM {
  id: string;
  type: "CLOZE" | "MC" | "TRANSFORM" | "BUILD";
  prompt: string;
  answer: string;
  options: string[];
  englishHint?: string | null;
  explanation: string;
}

interface Props {
  drill: DrillVM;
  onResult: (correct: boolean, userAnswer: string) => void;
}

export function DrillCloze({ drill, onResult }: Props) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const correct = submitted && isCorrect(input, drill.answer);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Card>
        <CardContent className="p-6 space-y-3">
          <Badge variant="outline">{drill.type === "TRANSFORM" ? "Transform" : "Fill the blank"}</Badge>
          <p className="text-xl font-medium">{drill.prompt}</p>
          {drill.englishHint && <p className="text-sm text-muted-foreground">{drill.englishHint}</p>}
        </CardContent>
      </Card>

      <form
        onSubmit={(e) => { e.preventDefault(); if (input.trim()) setSubmitted(true); }}
        className="space-y-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Your answer..."
          disabled={submitted}
          autoFocus
          className={submitted ? (correct ? "border-green-500" : "border-red-500") : ""}
        />
        {!submitted ? (
          <Button type="submit" className="w-full">Check</Button>
        ) : (
          <div className="space-y-2">
            <p className={`text-center font-medium ${correct ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
              {correct ? "Correct! ✓" : `Answer: ${drill.answer}`}
            </p>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{drill.explanation}</p>
            <Button className="w-full" onClick={() => onResult(correct, input)}>Next</Button>
          </div>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/grammar/DrillMultipleChoice.tsx`**

```tsx
// components/grammar/DrillMultipleChoice.tsx
"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DrillVM } from "./DrillCloze";

interface Props {
  drill: DrillVM;
  onResult: (correct: boolean, userAnswer: string) => void;
}

export function DrillMultipleChoice({ drill, onResult }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const correct = picked !== null && picked === drill.answer;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Card>
        <CardContent className="p-6 space-y-3">
          <Badge variant="outline">Choose the correct form</Badge>
          <p className="text-xl font-medium">{drill.prompt}</p>
          {drill.englishHint && <p className="text-sm text-muted-foreground">{drill.englishHint}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {drill.options.map((opt) => {
          const isAnswer = opt === drill.answer;
          const isPicked = picked === opt;
          const showState = picked !== null;
          const cls = showState
            ? isAnswer
              ? "border-green-500 text-green-600 dark:text-green-400"
              : isPicked
                ? "border-red-500 text-red-500"
                : ""
            : "";
          return (
            <Button
              key={opt}
              variant="outline"
              className={cls}
              disabled={picked !== null}
              onClick={() => setPicked(opt)}
            >
              {opt}
            </Button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{drill.explanation}</p>
          <Button className="w-full" onClick={() => onResult(correct, picked)}>Next</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/grammar/DrillBuild.tsx`**

```tsx
// components/grammar/DrillBuild.tsx
"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DrillVM } from "./DrillCloze";

interface BuildGrade {
  correct: boolean;
  corrected: string;
  errors: string[];
  explanation: string;
}

interface Props {
  drill: DrillVM;
  onResult: (correct: boolean, userAnswer: string) => void;
}

export function DrillBuild({ drill, onResult }: Props) {
  const [input, setInput] = useState("");
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<BuildGrade | null>(null);
  const [message, setMessage] = useState("");
  const [override, setOverride] = useState(false);

  async function handleGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setGrading(true);
    setMessage("");
    const res = await fetch("/api/grammar/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drillId: drill.id, userAnswer: input }),
    }).catch(() => null);
    const json = res ? await res.json() : { data: null, message: "Network error." };
    if (json.data) setGrade(json.data as BuildGrade);
    else setMessage(json.message ?? "AI grading unavailable.");
    setGrading(false);
  }

  const effectiveCorrect = grade ? grade.correct || override : false;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Card>
        <CardContent className="p-6 space-y-3">
          <Badge variant="outline">Build a sentence</Badge>
          <p className="text-xl font-medium">{drill.prompt}</p>
          {drill.englishHint && <p className="text-sm text-muted-foreground">Meaning: {drill.englishHint}</p>}
        </CardContent>
      </Card>

      {!grade ? (
        <form onSubmit={handleGrade} className="space-y-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write your German sentence..."
            disabled={grading}
            autoFocus
            rows={3}
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
          />
          <Button type="submit" className="w-full" disabled={grading}>
            {grading ? "Grading..." : "Check with AI ✨"}
          </Button>
          {message && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">{message}</p>
              <Button variant="outline" className="w-full" onClick={() => onResult(false, input)}>
                Skip
              </Button>
            </div>
          )}
        </form>
      ) : (
        <div className="space-y-2">
          <p className={`text-center font-medium ${effectiveCorrect ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
            {effectiveCorrect ? "Correct! ✓" : "Needs work"}
          </p>
          {!grade.correct && (
            <p className="text-sm"><span className="text-muted-foreground">Corrected: </span>{grade.corrected}</p>
          )}
          {grade.errors.length > 0 && (
            <ul className="text-sm text-red-500 list-disc pl-5">
              {grade.errors.map((er, i) => <li key={i}>{er}</li>)}
            </ul>
          )}
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{grade.explanation}</p>
          {!grade.correct && !override && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setOverride(true)}>
              I was actually right
            </Button>
          )}
          <Button className="w-full" onClick={() => onResult(effectiveCorrect, input)}>Next</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: compiles cleanly.

- [ ] **Step 5: Commit**

```bash
git add components/grammar/DrillCloze.tsx components/grammar/DrillMultipleChoice.tsx components/grammar/DrillBuild.tsx
git commit -m "feat: grammar drill components (cloze/transform, MC, build)"
```

---

## Task 11: Drill Session + Drill Page

**Files:**
- Create: `components/grammar/GrammarDrillSession.tsx`
- Create: `app/(app)/grammar/[topic]/drill/page.tsx`

**Interfaces:**
- Consumes: `DrillCloze`, `DrillMultipleChoice`, `DrillBuild`, `DrillVM` from `@/components/grammar/*`; APIs `/api/grammar/drills`, `/api/grammar/attempt`
- Produces: client component `GrammarDrillSession({ topicSlug, topicTitle }: { topicSlug: string; topicTitle: string })`

- [ ] **Step 1: Create `components/grammar/GrammarDrillSession.tsx`**

```tsx
// components/grammar/GrammarDrillSession.tsx
"use client";
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DrillCloze, type DrillVM } from "./DrillCloze";
import { DrillMultipleChoice } from "./DrillMultipleChoice";
import { DrillBuild } from "./DrillBuild";

interface Props {
  topicSlug: string;
  topicTitle: string;
}

export function GrammarDrillSession({ topicSlug, topicTitle }: Props) {
  const [drills, setDrills] = useState<DrillVM[]>([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/grammar/drills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicSlug, count: 10 }),
    })
      .then((r) => r.json())
      .then((json) => {
        setDrills(json.data ?? []);
        if (json.message) setMessage(json.message);
        setLoading(false);
      })
      .catch(() => { setDrills([]); setLoading(false); });
  }, [topicSlug]);

  async function handleResult(correct: boolean, userAnswer: string) {
    const drill = drills[index];
    await fetch("/api/grammar/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drillId: drill.id, userAnswer, correct }),
    }).catch(() => null);

    const newCorrect = correctCount + (correct ? 1 : 0);
    setCorrectCount(newCorrect);

    if (index + 1 >= drills.length) setDone(true);
    else setIndex(index + 1);
  }

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading drills...</div>;

  if (drills.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-muted-foreground">{message || "No drills available yet."}</p>
        <Button variant="outline" asChild><Link href={`/grammar/${topicSlug}`}>Back to topic</Link></Button>
      </div>
    );
  }

  if (done) {
    const accuracy = Math.round((correctCount / drills.length) * 100);
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <p className="text-xl font-semibold">Session complete 🎉</p>
            <div className="grid grid-cols-3 gap-4">
              <div><p className="text-3xl font-bold">{drills.length}</p><p className="text-xs text-muted-foreground">Drills</p></div>
              <div><p className="text-3xl font-bold">{correctCount}</p><p className="text-xs text-muted-foreground">Correct</p></div>
              <div><p className="text-3xl font-bold">{accuracy}%</p><p className="text-xs text-muted-foreground">Accuracy</p></div>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => { setIndex(0); setCorrectCount(0); setDone(false); }}>
                Again
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/grammar">Grammar home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const drill = drills[index];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{topicTitle}</span>
          <span>{index + 1} / {drills.length}</span>
        </div>
        <Progress value={(index / drills.length) * 100} />
      </div>

      {drill.type === "MC" ? (
        <DrillMultipleChoice drill={drill} onResult={handleResult} />
      ) : drill.type === "BUILD" ? (
        <DrillBuild drill={drill} onResult={handleResult} />
      ) : (
        <DrillCloze drill={drill} onResult={handleResult} />
      )}
    </div>
  );
}
```

Note: `Button asChild` is not supported by this project's Button — the session uses `<Button variant="outline" asChild>` above ONLY via a Link child will fail. Use the established workaround: replace each `<Button asChild><Link/></Button>` with `<Link className={buttonVariants({ variant: "outline" })}>…</Link>`, importing `buttonVariants` from `@/components/ui/button`. Apply this in both places in this file.

- [ ] **Step 2: Fix the Button/Link usage**

Replace the two `<Button ... asChild><Link .../></Button>` blocks with `buttonVariants`:

```tsx
import { Button, buttonVariants } from "@/components/ui/button";
```
- "Back to topic": `<Link className={buttonVariants({ variant: "outline" })} href={`/grammar/${topicSlug}`}>Back to topic</Link>`
- "Grammar home": `<Link className={buttonVariants({ variant: "outline" })} href="/grammar">Grammar home</Link>`

- [ ] **Step 3: Create `app/(app)/grammar/[topic]/drill/page.tsx`**

```tsx
// app/(app)/grammar/[topic]/drill/page.tsx
import { db } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { GrammarDrillSession } from "@/components/grammar/GrammarDrillSession";

export default async function GrammarDrillPage({ params }: { params: Promise<{ topic: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { topic: slug } = await params;

  const topic = await db.grammarTopic.findUnique({ where: { slug } });
  if (!topic) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Drill: {topic.title}</h1>
      <GrammarDrillSession topicSlug={topic.slug} topicTitle={topic.title} />
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: compiles; `/grammar/[topic]/drill` present.

- [ ] **Step 5: Commit**

```bash
git add components/grammar/GrammarDrillSession.tsx "app/(app)/grammar/[topic]/drill/page.tsx"
git commit -m "feat: grammar drill session orchestrator + drill page"
```

---

## Task 12: Overview Page, Topic Page, Navbar

**Files:**
- Create: `components/grammar/TrackCard.tsx`
- Create: `components/grammar/TopicProgressRing.tsx`
- Create: `components/grammar/ExplainDeeper.tsx`
- Create: `app/(app)/grammar/page.tsx`
- Create: `app/(app)/grammar/[topic]/page.tsx`
- Modify: `components/layout/Navbar.tsx`

**Interfaces:**
- Consumes: `GET /api/grammar/tracks`, `POST /api/grammar/explain`
- Produces: `/grammar` overview, `/grammar/[topic]` detail, Navbar link.

- [ ] **Step 1: Create `components/grammar/TopicProgressRing.tsx`**

```tsx
// components/grammar/TopicProgressRing.tsx
const STATUS_COLOR: Record<string, string> = {
  NEW: "text-muted-foreground",
  LEARNING: "text-yellow-500",
  REVIEW: "text-blue-500",
  MASTERED: "text-green-500",
};

export function TopicProgressRing({ status }: { status: string }) {
  const pct = status === "MASTERED" ? 100 : status === "REVIEW" ? 66 : status === "LEARNING" ? 33 : 8;
  return (
    <div className="relative h-9 w-9 shrink-0">
      <svg viewBox="0 0 36 36" className={STATUS_COLOR[status] ?? "text-muted-foreground"}>
        <circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
          strokeDasharray={`${(pct / 100) * 94.2} 94.2`} strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/grammar/TrackCard.tsx`**

```tsx
// components/grammar/TrackCard.tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopicProgressRing } from "./TopicProgressRing";

interface TopicVM {
  slug: string;
  title: string;
  level: string;
  progress: Array<{ status: string }>;
}
interface TrackVM {
  name: string;
  icon: string;
  description: string;
  topics: TopicVM[];
}

export function TrackCard({ track, suggestedSlug }: { track: TrackVM; suggestedSlug: string | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{track.icon}</span> {track.name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{track.description}</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {track.topics.map((t) => {
          const status = t.progress[0]?.status ?? "NEW";
          const suggested = t.slug === suggestedSlug;
          return (
            <Link
              key={t.slug}
              href={`/grammar/${t.slug}`}
              className={`flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted ${suggested ? "ring-1 ring-primary" : ""}`}
            >
              <TopicProgressRing status={status} />
              <span className="flex-1 text-sm font-medium">{t.title}</span>
              {suggested && <Badge>Next</Badge>}
              <Badge variant="outline" className="text-xs">{t.level}</Badge>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `components/grammar/ExplainDeeper.tsx`**

```tsx
// components/grammar/ExplainDeeper.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ExplainDeeper({ topicSlug }: { topicSlug: string }) {
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [message, setMessage] = useState("");

  async function handleClick() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/grammar/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicSlug }),
    }).catch(() => null);
    const json = res ? await res.json() : { data: null, message: "Network error." };
    if (json.data?.markdown) setMarkdown(json.data.markdown);
    else setMessage(json.message ?? "AI unavailable.");
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? "Thinking..." : "Explain deeper ✨"}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {markdown && (
        <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg font-sans">{markdown}</pre>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `app/(app)/grammar/page.tsx`**

```tsx
// app/(app)/grammar/page.tsx
"use client";
import { useEffect, useState } from "react";
import { TrackCard } from "@/components/grammar/TrackCard";

interface ApiTrack {
  id: string;
  name: string;
  icon: string;
  description: string;
  topics: Array<{ slug: string; title: string; level: string; progress: Array<{ status: string }> }>;
}

export default function GrammarPage() {
  const [tracks, setTracks] = useState<ApiTrack[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/grammar/tracks")
      .then((r) => r.json())
      .then((json) => {
        setTracks(json.data?.tracks ?? []);
        setSuggested(json.data?.suggestedTopicSlug ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading grammar...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Grammar</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {tracks.map((track) => (
          <TrackCard key={track.id} track={track} suggestedSlug={suggested} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `app/(app)/grammar/[topic]/page.tsx`**

```tsx
// app/(app)/grammar/[topic]/page.tsx
import { db } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { ExplainDeeper } from "@/components/grammar/ExplainDeeper";

export default async function GrammarTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { topic: slug } = await params;

  const topic = await db.grammarTopic.findUnique({
    where: { slug },
    include: {
      track: true,
      progress: { where: { userId: session.user.id }, take: 1 },
    },
  });
  if (!topic) notFound();

  const progress = topic.progress[0];
  const drillPoolSize = await db.grammarDrill.count({ where: { topicId: topic.id } });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{topic.title}</h1>
          <Badge variant="outline">{topic.level}</Badge>
          {progress && <Badge variant="secondary">{progress.status}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{topic.track.name}</p>
      </div>

      <Card>
        <CardContent className="p-6 prose dark:prose-invert max-w-none">
          <pre className="text-sm whitespace-pre-wrap bg-transparent p-0 font-sans">{topic.summary}</pre>
        </CardContent>
      </Card>

      <ExplainDeeper topicSlug={topic.slug} />

      {progress && (
        <Card>
          <CardContent className="p-6 grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-bold">{progress.totalCorrect}</p><p className="text-xs text-muted-foreground">Correct</p></div>
            <div><p className="text-2xl font-bold">{progress.totalWrong}</p><p className="text-xs text-muted-foreground">Wrong</p></div>
            <div><p className="text-2xl font-bold">{progress.interval}d</p><p className="text-xs text-muted-foreground">Interval</p></div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Link className={buttonVariants()} href={`/grammar/${topic.slug}/drill`}>
          Start Drilling ({drillPoolSize} cached)
        </Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/grammar">Back</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Add "Grammar" link to `components/layout/Navbar.tsx`**

In `components/layout/Navbar.tsx`, add a Grammar link next to the existing Study link. Insert this line immediately after the `Study` `<Link>`:

```tsx
          <Link href="/grammar" className="text-sm font-medium hover:text-primary">Grammar</Link>
```

- [ ] **Step 7: Verify build + manual smoke**

```bash
npm run build
```
Expected: compiles. Then `npm run dev`, log in, visit `/grammar` → tracks render with rings, "Next" badge on suggested topic; open a topic → summary + Explain deeper + Start Drilling; run a drill session (CLOZE/MC work without AI; BUILD shows graceful message if AI off).

- [ ] **Step 8: Commit**

```bash
git add components/grammar/ "app/(app)/grammar/page.tsx" "app/(app)/grammar/[topic]/page.tsx" components/layout/Navbar.tsx
git commit -m "feat: grammar overview, topic detail, explain-deeper, navbar link"
```

---

## Task 13: Dashboard Integration + Final Build

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`
- Push branch

**Interfaces:**
- Consumes: `db`, existing dashboard query structure
- Produces: a "Grammar due" count card on the dashboard.

- [ ] **Step 1: Add grammar-due count to the dashboard**

In `app/(app)/dashboard/page.tsx`, add a query alongside the existing `Promise.all` block (use the same `userId` and `db` already in scope):

```ts
  const grammarDue = await db.grammarTopicProgress.count({
    where: { userId, nextReviewAt: { lte: new Date() }, status: { not: "MASTERED" } },
  });
```

Then add a card next to the existing "Cards due today" card (inside the same grid):

```tsx
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Grammar topics due</p>
            <p className="text-4xl font-bold">{grammarDue}</p>
          </CardContent>
        </Card>
```

- [ ] **Step 2: Full build + test suite**

```bash
npm run build
npm test
```
Expected: build clean; all tests pass (existing SM-2 11 + grammar-check 10 + grammar-srs 5 + grammar-suggest 5 + grammar-ai 9).

- [ ] **Step 3: Commit and push**

```bash
git add "app/(app)/dashboard/page.tsx"
git commit -m "feat: surface grammar review-due count on dashboard"
git push origin main
```

---

## Quick Reference

```bash
docker-compose up -d
npm run dev
npx prisma migrate dev --name add_grammar_models   # task 1
npm run seed:grammar                                # task 6
npm test -- grammar                                 # run grammar unit tests
```
