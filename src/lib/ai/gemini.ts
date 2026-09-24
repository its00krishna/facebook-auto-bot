const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

export class GeminiKeyMissingColumnError extends Error {
  constructor() {
    super(
      "Your database needs a small update before a Gemini key can be saved. In Supabase, open SQL Editor, paste the whole of supabase/schema.sql from the repository, and click Run. Then save the key again."
    );
  }
}

async function geminiError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null);
  const message: string = body?.error?.message ?? `Gemini API error (${res.status})`;
  if (res.status === 400 && /api key/i.test(message)) return new Error("This Gemini API key is not valid.");
  if (res.status === 403) return new Error("This Gemini API key is not allowed to use the image model.");
  if (res.status === 429) return new Error("Gemini quota exceeded for this key. Check billing or try later.");
  return new Error(message);
}

/**
 * Confirms the key works and can see the image model, without spending any
 * generation quota — a metadata lookup is free.
 */
export async function verifyGeminiKey(apiKey: string): Promise<void> {
  const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_IMAGE_MODEL}`, {
    headers: { "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw await geminiError(res);
}

export async function generateGeminiImage(apiKey: string, prompt: string): Promise<Blob> {
  const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "1:1" },
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw await geminiError(res);

  const data = await res.json();
  const parts: Array<{ inlineData?: { mimeType: string; data: string } }> =
    data?.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((p) => p.inlineData?.data)?.inlineData;
  if (!image) throw new Error("Gemini did not return an image for this prompt.");

  return new Blob([Buffer.from(image.data, "base64")], { type: image.mimeType || "image/png" });
}
