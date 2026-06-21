"use client";
import { useState } from "react";
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

function blankWord(sentence: string, bare: string): string {
  return sentence.replace(new RegExp(bare, "gi"), "_____");
}

export function SentenceDrill({ word }: Props) {
  const [sentences, setSentences] = useState<Sentence[]>(word.sentences);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  const bare = word.german.replace(/^(der|die|das)\s+/i, "").trim();
  const current = sentences[currentIdx];
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
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) setSubmitted(true);
        }}
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
          <Button type="submit" className="w-full">
            Check
          </Button>
        ) : (
          <div className="space-y-2">
            <p
              className={`text-center font-medium ${
                isCorrect ? "text-green-600 dark:text-green-400" : "text-red-500"
              }`}
            >
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
      {aiMessage && (
        <p className="text-sm text-muted-foreground text-center">{aiMessage}</p>
      )}
    </div>
  );
}
