# Grammar Tracks — Design Spec
**Date:** 2026-06-21
**Status:** Approved
**Parent system:** Grammar System (sub-project 1 of 3: Grammar Tracks → The Forge → Error→SRS bridge)

---

## 1. Overview

A structured A2/B1/B2 German grammar curriculum layered onto the existing Deutschlich flashcard app. Users work through grammar topics organized into tracks, each with a curated explanation and AI-grown drill pool. Mastery is tracked per topic using the existing SM-2 spaced-repetition engine, so grammar topics decay and resurface for review alongside vocabulary.

This is the foundation of a 3-part grammar system. It defines the grammar taxonomy (track/topic/drill-type IDs) that the later **Forge** (production + AI diagnosis) and **Error→SRS bridge** (mistakes become drill cards) will both reference. `GrammarAttempt` logging is built now so those sub-projects have data to consume.

**Target user:** A2-confident learner pushing toward solid B1/B2, who wants to *produce* correct German, not just recognize vocabulary.

---

## 2. Decisions (from brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| Content source | Hybrid: curated topic list + curated short explanation + AI "explain deeper" button |
| Drill types | All four: CLOZE, MC, TRANSFORM (deterministic) + BUILD (AI-graded) |
| Progression | Recommended-but-open: all topics available, app highlights next suggested |
| Mastery | SRS-style with decay — reuse existing SM-2 engine |
| Drill storage | Cache-and-grow: AI-generated on demand, cached in DB, topped up |
| Vocab integration | Yes — cloze/build drills prefer the user's learning-status words |
| Explanation language | English rule + German examples |
| Mastery model | Reuse SM-2 on a new `GrammarTopicProgress` table (mirrors `UserCard`) |

---

## 3. Data Model

New Prisma models (additive — no changes to existing models except a back-relation on `User` and `Word`):

```prisma
model GrammarTrack {
  id          String         @id @default(cuid())
  name        String         // "Cases (Fälle)"
  slug        String         @unique
  color       String         // Tailwind token
  icon        String         // emoji
  order       Int
  description  String        // short English
  topics      GrammarTopic[]
}

model GrammarTopic {
  id              String                 @id @default(cuid())
  slug            String                 @unique
  title           String                 // "Two-Way Prepositions"
  trackId         String
  track           GrammarTrack           @relation(fields: [trackId], references: [id])
  level           String                 // "A2" | "B1" | "B2"
  order           Int                    // within track
  summary         String                 // markdown: English rule + German examples
  prerequisites   String[]               // topic slugs that should precede this
  drillTypes      String[]               // subset of ["CLOZE","MC","TRANSFORM","BUILD"]
  drills          GrammarDrill[]
  progress        GrammarTopicProgress[]
  attempts        GrammarAttempt[]
}

model GrammarDrill {
  id          String         @id @default(cuid())
  topicId     String
  topic       GrammarTopic   @relation(fields: [topicId], references: [id])
  type        String         // "CLOZE" | "MC" | "TRANSFORM" | "BUILD"
  prompt      String         // German; cloze uses "___" placeholder
  answer      String         // correct answer (deterministic types); for BUILD: a model answer
  options     String[]       // MC only (includes the correct option)
  englishHint String?        // English meaning (BUILD prompt + context)
  explanation String         // why: English + German example
  usesWordId  String?        // optional → Word (vocab integration)
  usesWord    Word?          @relation(fields: [usesWordId], references: [id])
  source      String         // "SEEDED" | "AI_GENERATED"
  createdAt   DateTime       @default(now())
}

model GrammarTopicProgress {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  topicId        String
  topic          GrammarTopic @relation(fields: [topicId], references: [id])
  status         String       @default("NEW")  // NEW|LEARNING|REVIEW|MASTERED
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

Back-relations to add: `User.grammarProgress GrammarTopicProgress[]`, `User.grammarAttempts GrammarAttempt[]`, `Word.grammarDrills GrammarDrill[]`.

**Notes:**
- `GrammarTopicProgress` deliberately mirrors `UserCard`'s SM-2 fields so it can be passed to the existing `applyReview()` from `lib/sm2.ts` with no algorithm changes.
- `GrammarAttempt` logs every answer now — the future Error→SRS bridge reads it. Not surfaced in UI yet beyond session stats.
- Cache-and-grow: a topic ships with `SEEDED` drills; AI adds `AI_GENERATED` ones over time.

---

## 4. Curriculum (seeded)

4 tracks, ~33 topics. A2 topics are prerequisite-free entry points; B1/B2 topics list prerequisites.

### Cases (Fälle)
- Nominativ & Akkusativ basics — A2
- Dativ basics — A2
- Possessive articles (mein/dein…) — A2
- Akkusativ vs Dativ — B1 (req: dativ-basics, akkusativ-basics)
- Adjective endings — definite article — B1 (req: akkusativ-vs-dativ)
- Adjective endings — indefinite article — B1 (req: adjective-endings-definite)
- Adjective endings — no article — B1 (req: adjective-endings-indefinite)
- Genitiv — B1 (req: akkusativ-vs-dativ)
- n-Deklination (weak nouns) — B1 (req: akkusativ-vs-dativ)

### Verbs (Verben)
- Modal verbs (können/müssen/wollen) — A2
- Perfekt with haben/sein — A2
- Imperative (Imperativ) — A2
- Separable verbs — present tense — A2
- Perfekt vs Präteritum — B1 (req: perfekt-haben-sein)
- Reflexive verbs — B1 (req: akkusativ-vs-dativ)
- Konjunktiv II (würde/hätte/wäre) — B1 (req: perfekt-vs-praeteritum)
- Plusquamperfekt — B2 (req: perfekt-vs-praeteritum)
- Passiv (Vorgangspassiv) — B2 (req: perfekt-vs-praeteritum)
- Konjunktiv I (indirect speech) — B2 (req: konjunktiv-ii)

### Word Order (Satzbau)
- Basic V2 / yes-no questions — A2
- Coordinating conjunctions (und/aber/denn) — A2
- Main clause V2 position — B1 (req: basic-v2)
- Subordinate clauses (weil/dass) — B1 (req: main-clause-v2)
- TeKaMoLo (adverb order) — B1 (req: main-clause-v2)
- Connectors (deshalb/trotzdem/obwohl) + position — B2 (req: subordinate-clauses)
- Relative clauses — B2 (req: subordinate-clauses)

### Prepositions (Präpositionen)
- Akkusativ prepositions (für/ohne/gegen) — A2
- Dativ prepositions (mit/bei/nach/zu) — A2
- Comparison (als/wie, -er/am -sten) — A2
- Wechselpräpositionen (two-way) — B1 (req: akkusativ-vs-dativ)
- Fixed preposition + case — B1 (req: wechselpraepositionen)
- Verb + preposition (warten auf + Akk) — B2 (req: fixed-prep-case)
- Adjective + preposition (stolz auf) — B2 (req: verb-preposition)

Each topic seeds: a curated `summary` (English rule + 2-4 German examples) and ~5 baseline `SEEDED` drills spanning its `drillTypes`. AI grows the pool.

---

## 5. Pages & Flow

```
/grammar
  Track overview. 4 track cards, each with topic progress rings.
  "Next suggested" topic highlighted. Grammar review-due count.

/grammar/[topic]
  Curated explanation (English rule + German examples, markdown).
  "Explain deeper ✨" AI button. Mastery status + accuracy. "Start Drilling".

/grammar/[topic]/drill
  Drill session — mixed types, instant deterministic check, AI grading for BUILD,
  SM-2 update per answer, session summary at end.
```

**Navbar:** add "Grammar" link beside "Study".

### Drill session loop
```
1. Load drills for topic (cached, prioritize unseen by this user).
   If pool < 8 → AI generates a batch and caches before serving.
2. Present by type:
   CLOZE     → input; check normalized exact match
   MC        → 4 option buttons
   TRANSFORM → input; check normalized exact match
   BUILD     → textarea → POST /api/grammar/grade → AI feedback
3. Rate → applyReview() on GrammarTopicProgress (correct=Good/3, wrong=Again/1).
   Log GrammarAttempt.
4. End → summary (count, accuracy, new mastery), update progress.
```

**Vocab integration:** when generating/selecting CLOZE and BUILD drills, prefer the user's words with status LEARNING or REVIEW (via `usesWordId`).

**"Next suggested topic" rule:** among topics whose prerequisites are all MASTERED or REVIEW, pick the one that is (a) due for review (nextReviewAt ≤ now) with lowest accuracy, else (b) the lowest-order NEW topic.

---

## 6. API Routes

All return `{ data?: T; error?: string }`; 401 when unauthenticated.

```
GET  /api/grammar/tracks
     → { data: { tracks: TrackWithTopicsAndProgress[], suggestedTopicSlug: string } }

GET  /api/grammar/topics/[slug]
     → { data: { topic, progress, drillPoolSize } }

POST /api/grammar/drills          body { topicSlug, count? = 10 }
     → serves cached unseen drills; if pool < 8, AI-generate + cache first.
       Prefers user's LEARNING/REVIEW words for CLOZE/BUILD.
     → { data: GrammarDrill[] }

POST /api/grammar/attempt         body { drillId, userAnswer, correct }
     → log GrammarAttempt; applyReview() on GrammarTopicProgress (upsert).
     → { data: { progress } }

POST /api/grammar/grade           body { drillId, userAnswer }   (BUILD only)
     → AI grades free-form German.
     → { data: { correct, corrected, errors: string[], explanation } } | { data: null, message }

POST /api/grammar/explain         body { topicSlug }
     → AI extended explanation.
     → { data: { markdown } } | { data: null, message }
```

---

## 7. AI Contracts (`lib/grammar-ai.ts`)

Reuses the user's provider config (`aiProvider/aiBaseUrl/aiApiKey/aiModel`) and the resilient client pattern from `lib/ai.ts` (raised max_tokens, reasoning suppression for OpenRouter, JSON extraction with shape validation, try/catch → graceful empty).

**Generate drills** — input: topic title + rule summary + requested drill type + optional vocab word. Output: JSON array of
```ts
{ type, prompt, answer, options?, englishHint?, explanation }
```
Validate each object's shape; discard malformed entries; cache the rest as `AI_GENERATED`.

**Grade BUILD** — input: english hint (target meaning) + grammar focus (topic title) + user's German sentence. Output:
```ts
{ correct: boolean, corrected: string, errors: string[], explanation: string }
```

**Explain deeper** — input: topic title + summary. Output: `{ markdown: string }` of extra examples/clarification.

---

## 8. Mastery Mapping (`lib/grammar-srs.ts`)

Thin adapter over `lib/sm2.ts`:
```ts
function drillResultToRating(correct: boolean): Rating  // true → 3 (Good), false → 1 (Again)
function applyGrammarReview(progress: GrammarTopicProgress, correct: boolean): SM2Card
```
Uses the existing `applyReview()`. No new decay algorithm. Grammar topics appear in the dashboard forecast alongside vocab (dashboard integration is a small additive change: include `GrammarTopicProgress` due counts).

---

## 9. Answer Normalization (`lib/grammar-check.ts`)

For CLOZE and TRANSFORM deterministic checks:
- trim, collapse internal whitespace, lowercase
- accept `ß`↔`ss` equivalence
- accept missing-umlaut typed forms (`ae`↔`ä`, `oe`↔`ö`, `ue`↔`ü`) as correct
- exact compare after normalization

MC: direct option-index match. BUILD: AI-graded (section 7).

---

## 10. Error Handling

- **AI off / unreachable:** CLOZE/MC/TRANSFORM fully work from cached drills. BUILD shows "AI grading unavailable — try the other drill types or enable AI in Settings." Explain button shows a message. No crash.
- **Empty pool + AI off:** friendly "No drills cached yet for this topic. Enable AI in Settings to generate some."
- **Malformed AI JSON:** discard invalid entries, fall back to cache, never throw to client.
- **BUILD ambiguity:** AI returns `correct:false` + correction; user may self-override ("I was right") — logs a corrected `GrammarAttempt` but does not error.

---

## 11. Testing

TDD where logic is non-trivial:
- `lib/grammar-srs.ts` — drill result → rating → applyReview mapping (unit)
- `lib/grammar-check.ts` — normalization: ß/ss, umlaut tolerance, whitespace, case (unit)
- "Next suggested topic" selection — prereqs met + due + accuracy ordering (unit)
- AI JSON extraction/validation for drill generation + grading — sample payloads (unit)
- API routes — auth 401, cache-then-generate fallback, attempt updates progress

---

## 12. Reuses From Existing Codebase

- `applyReview`, `Rating`, `SM2Card` from `lib/sm2.ts`
- AI client pattern + provider config from `lib/ai.ts` (and the reasoning-model fixes)
- `db` singleton, `auth()`, `{data,error}` API shape, shadcn/ui, dark mode tokens
- `Word` table for vocab integration

## 13. Out of Scope (future sub-projects)

- **The Forge** — free-form production + full AI grammar diagnosis (BUILD here is a seed of it)
- **Error→SRS bridge** — turning `GrammarAttempt` errors into standalone SRS drill cards
- Speaking/audio grading
