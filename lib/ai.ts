import OpenAI from "openai";

interface AiConfig {
  provider: string | null;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
}

export interface GeneratedSentence {
  german: string;
  english: string;
}

export async function generateSentences(
  word: string,
  config: AiConfig
): Promise<GeneratedSentence[]> {
  if (!config.provider) return [];

  try {
    const isOpenRouter = config.provider === "openrouter";

    const client = new OpenAI({
      apiKey: config.apiKey ?? "not-needed",
      baseURL: isOpenRouter
        ? "https://openrouter.ai/api/v1"
        : (config.baseUrl ?? "http://localhost:1234/v1"),
      // OpenRouter ranking headers (optional, harmless for LM Studio)
      defaultHeaders: isOpenRouter
        ? {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Deutschlich",
          }
        : undefined,
    });

    const model =
      config.model ??
      (isOpenRouter ? "openai/gpt-oss-120b:free" : "local-model");

    // Reasoning models (DeepSeek-R1, gpt-oss, Qwen3-thinking) spend tokens on
    // hidden chain-of-thought before the answer. Two defenses:
    //   1. a generous max_tokens so the answer survives the reasoning budget
    //   2. ask the provider to minimize reasoning where supported
    const request = {
      model,
      messages: [
        {
          role: "system" as const,
          content:
            "You are a German language teacher. Generate short, practical example sentences for vocabulary learning at A2/B1 level. Respond with ONLY a valid JSON array — no prose, no explanation, no markdown fences.",
        },
        {
          role: "user" as const,
          content: `Generate exactly 3 example sentences in German using the word "${word}". Keep sentences simple and about daily life (A2/B1 level). Respond ONLY with a JSON array: [{"german": "...", "english": "..."}, ...]`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      // OpenRouter-specific: keep reasoning short and out of the response.
      // Ignored by providers that don't support it (e.g. plain LM Studio).
      ...(isOpenRouter ? { reasoning: { effort: "low", exclude: true } } : {}),
    };

    // `reasoning` is an OpenRouter extension not in the OpenAI type — cast.
    const response = await client.chat.completions.create(
      request as Parameters<typeof client.chat.completions.create>[0]
    );

    const message = (
      response as {
        choices?: Array<{
          message?: { content?: string | null; reasoning_content?: string | null };
        }>;
      }
    ).choices?.[0]?.message;

    // Prefer the real answer; fall back to reasoning_content for thinking
    // models that put the JSON there (or got cut off mid-thought).
    const text = message?.content || message?.reasoning_content || "";

    const sentences = extractSentences(text);
    return sentences;
  } catch {
    return [];
  }
}

// Pull the first JSON array of {german, english} objects out of arbitrary
// model text. Tolerates markdown fences, leading prose, and trailing junk.
function extractSentences(text: string): GeneratedSentence[] {
  if (!text) return [];
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is GeneratedSentence =>
          s && typeof s.german === "string" && typeof s.english === "string"
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}
