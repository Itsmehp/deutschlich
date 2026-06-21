"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const OPENROUTER_MODELS = [
  { label: "GPT-OSS 120B (free)", value: "openai/gpt-oss-120b:free" },
  { label: "Mistral 7B (free)", value: "mistralai/mistral-7b-instruct:free" },
  { label: "Llama 3.1 8B (free)", value: "meta-llama/llama-3.1-8b-instruct:free" },
  { label: "Qwen2.5 7B (free)", value: "qwen/qwen-2.5-7b-instruct:free" },
];

export default function SettingsPage() {
  const [provider, setProvider] = useState<"lmstudio" | "openrouter" | "">("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((json) => {
        const u = json.data;
        if (u) {
          setProvider((u.aiProvider as "lmstudio" | "openrouter" | "") ?? "");
          setBaseUrl(u.aiBaseUrl ?? "http://localhost:1234/v1");
          setModel(u.aiModel ?? "");
        }
        setLoading(false);
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aiProvider: provider || null,
        aiBaseUrl: provider === "lmstudio" ? baseUrl : null,
        aiApiKey: provider === "openrouter" ? apiKey : null,
        aiModel: model || null,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label>Theme</Label>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <p className="text-sm text-muted-foreground">
            Used to generate example sentences. Optional — app works without it.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex gap-2">
              {(["", "lmstudio", "openrouter"] as const).map((p) => (
                <Button
                  key={p || "none"}
                  type="button"
                  variant={provider === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setProvider(p)}
                >
                  {p === "" ? "None" : p === "lmstudio" ? "LM Studio" : "OpenRouter"}
                </Button>
              ))}
            </div>

            {provider === "lmstudio" && (
              <div className="space-y-2">
                <Label>LM Studio URL</Label>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://localhost:1234/v1" />
                <Label>Model name (from LM Studio)</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. qwen2.5-7b-instruct" />
                <p className="text-xs text-muted-foreground">
                  Recommended: Qwen2.5 7B Instruct Q4_K_M (~5GB VRAM, fits RTX 4060)
                </p>
              </div>
            )}

            {provider === "openrouter" && (
              <div className="space-y-2">
                <Label>OpenRouter API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-..."
                />
                <Label>Model</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="">Select model...</option>
                  {OPENROUTER_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            <Button type="submit" className="w-full">
              {saved ? "Saved ✓" : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
