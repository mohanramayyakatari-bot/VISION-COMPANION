import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server-side TTS fallback via Lovable AI Gateway. Used when the browser
// has no native voice for the requested language (common for te-IN / hi-IN
// on desktop Chrome). Returns base64-encoded MP3 the client can play.
export const synthesizeSpeech = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        text: z.string().min(1).max(4000),
        language: z.enum(["en", "te", "hi"]).default("en"),
        voice: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Lovable AI key missing on server.");

    const voice = data.voice ?? "alloy";
    const langHint =
      data.language === "te"
        ? "Speak the following Telugu sentence naturally in a warm Telugu voice: "
        : data.language === "hi"
          ? "Speak the following Hindi sentence naturally in a warm Hindi voice: "
          : "";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: langHint + data.text,
        voice,
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`TTS failed [${res.status}]: ${body.slice(0, 200)}`);
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    // Convert to base64 without spreading (audio buffers are large).
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)));
    }
    const base64 = typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(buf).toString("base64");
    return { audio: base64, mime: "audio/mpeg" };
  });