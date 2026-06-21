"use client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
