"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const [words, setWords] = useState<Word[]>([]);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const categoryParam = searchParams.get("category") ?? "";

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (level) params.set("level", level);
    if (categoryParam) params.set("category", categoryParam);
    params.set("page", String(page));
    fetch(`/api/words?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setWords(json.data ?? []);
        setTotal(json.total ?? 0);
        setPages(json.pages ?? 1);
      })
      .catch(() => { setWords([]); });
  }, [q, level, page, categoryParam]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Words ({total})
          {categoryParam && (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              in &quot;{categoryParam}&quot;
            </span>
          )}
        </h1>
        <Link href="/categories">
          <Button variant="outline" size="sm">Browse Categories</Button>
        </Link>
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
