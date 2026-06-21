"use client";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";

export function AudioButton({ text }: { text: string }) {
  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "de-DE";
    utt.rate = 0.9;
    window.speechSynthesis.speak(utt);
  }
  return (
    <Button variant="ghost" size="icon" onClick={speak} title="Listen">
      <Volume2 className="h-5 w-5" />
    </Button>
  );
}
