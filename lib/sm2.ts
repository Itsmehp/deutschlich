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
