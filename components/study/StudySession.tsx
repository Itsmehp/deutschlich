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
