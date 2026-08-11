import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  imageBase64: z.string().min(100),
  mode: z.string(),
  language: z.enum(["en", "te", "hi"]).default("en"),
  question: z.string().optional(),
  peopleRefs: z
    .array(z.object({ name: z.string(), url: z.string().min(10) }))
    .optional(),
});

const LANG_NAME: Record<string, string> = {
  en: "English",
  te: "Telugu (తెలుగు)",
  hi: "Hindi (हिन्दी)",
};

const MODE_PROMPTS: Record<string, string> = {
  scene:
    "You are Vision Companion, guiding a visually impaired user. Describe the scene in this photo in 2-3 short spoken sentences. Mention people, key objects, layout (left/center/right), and anything unsafe. Be concrete and calm.",
  safety:
    "You are Vision Companion assisting a blind pedestrian in real time. Respond with a single line, MAX 12 words, and START it with exactly one tag:\n" +
    "HAZARD: <urgent warning naming the danger and where it is> — use this ONLY if there is a clear immediate danger (knife, fire, smoke, vehicle, bicycle, stairs edge, hole, open drain, broken glass, aggressive animal, falling object, live wire).\n" +
    "SCENE: <what is directly in front of the user right now> — use this otherwise.\n" +
    "Never add extra sentences. Never repeat prior descriptions. If nothing changed since a person would last look, still describe what is currently there.",
  object:
    "Detect every distinct, important object in this image. Output ONLY machine-readable lines, one per object, in exactly this format:\n" +
    "name|left OR center OR right|approximate distance in metres as a number\n" +
    "Use at most 8 lines, nearest first. Use a single common noun for the name (person, chair, car, motorcycle, dog, table, door, stairs). No headings, no numbering, no extra words. If nothing is visible output: none|center|0",
  read:
    "You are performing OCR on a document, book, notice, photocopy or a page shown on a screen.\n" +
    "FIRST line must be exactly one quality tag: QUALITY: ok | QUALITY: too_far | QUALITY: blurry | QUALITY: tilted | QUALITY: partial. Use 'ok' only when the text is clearly legible.\n" +
    "AFTER that line, transcribe ALL visible text EXACTLY, in correct human reading order (headings first, then columns left to right, then paragraphs top to bottom). Keep paragraph breaks as blank lines. Do not summarise, translate, comment, or add anything that is not printed. If there is no text at all, output only: QUALITY: ok\\n(no text)",
  currency:
    "Identify every Indian rupee note or coin visible. State each denomination and then the total in words. If none, say 'I don't see any currency.'",
  color:
    "Name the dominant colors of the main objects in the image in one short sentence.",
  hazard:
    "Look for hazards for a blind pedestrian: stairs, vehicles, wet floor, fire, holes, glass, obstacles. If none, reassure the user in one sentence. Otherwise warn urgently and say where.",
  navigate:
    "Give one short walking instruction based on this image: direction, distance in meters, and any obstacle to avoid.",
  face:
    "You are given one or more REFERENCE photos of known trusted people (labelled with their name), followed by a LIVE camera photo. For EVERY person visible in the LIVE photo, independently compare their face with each reference person: align the face, judge facial structure, and give an honest match confidence. Output ONLY machine-readable lines, one per visible person, in exactly this format:\n" +
    "name|left OR center OR right|confidence between 0 and 1\n" +
    "Use the exact reference name when it matches, otherwise use the literal word unknown. Never inflate confidence: a blurry, partial, distant or side-on face must score below 0.5. Report every person, not just the first. No headings, no extra words. If no person is visible output: none|center|0",
  product:
    "Read the product name, brand, and any dosage or expiry visible on the label in one short sentence.",
  ask: "Answer the user's question about the image briefly and clearly.",
};

export const analyzeFrame = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const modePrompt = MODE_PROMPTS[data.mode] ?? MODE_PROMPTS.scene;
    const system = `You are Vision Companion, a real-time AI assistant for a visually impaired user. Always answer in ${LANG_NAME[data.language]}. Speak in short, natural spoken sentences suitable for text-to-speech. Never use markdown, bullet points, or emojis.`;
    const userText = data.question ? `${modePrompt}\n\nUser question: ${data.question}` : modePrompt;

    const userContent: Array<Record<string, unknown>> = [{ type: "text", text: userText }];
    if (data.mode === "face" && data.peopleRefs?.length) {
      for (const p of data.peopleRefs) {
        userContent.push({ type: "text", text: `Reference photo — this person is ${p.name}:` });
        userContent.push({ type: "image_url", image_url: { url: p.url } });
      }
      userContent.push({ type: "text", text: "LIVE camera photo — identify people here:" });
    }
    userContent.push({ type: "image_url", image_url: { url: data.imageBase64 } });

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit — please wait a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
      throw new Error(`Vision AI failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content?.trim() ?? "";
    return { text: content };
  });