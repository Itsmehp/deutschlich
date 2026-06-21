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
    const client = new OpenAI({
      apiKey: config.apiKey ?? "not-needed",
      baseURL:
        config.provider === "lmstudio"
          ? (config.baseUrl ?? "http://localhost:1234/v1")
          : "https://openrouter.ai/api/v1",
    });

    const model =
      config.model ??
      (config.provider === "lmstudio"
        ? "local-model"
        : "mistralai/mistral-7b-instruct:free");

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a German language teacher. Generate short, practical example sentences for vocabulary learning at A2/B1 level. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: `Generate exactly 3 example sentences in German using the word "${word}". Keep sentences simple and about daily life (A2/B1 level). Respond ONLY with a JSON array: [{"german": "...", "english": "..."}, ...]`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const text = response.choices[0]?.message?.content ?? "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as GeneratedSentence[];
  } catch {
    return [];
  }
}
