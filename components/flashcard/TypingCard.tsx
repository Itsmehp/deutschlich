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
