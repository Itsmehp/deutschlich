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
