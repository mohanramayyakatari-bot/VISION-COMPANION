// Universal TTS with native-first + Lovable AI Gateway fallback.
// Web Speech API is used when a matching voice exists (best latency);
// otherwise we call the server function that generates MP3 via the
// Lovable AI Gateway. This makes Telugu (te-IN) and Hindi (hi-IN) speak
// aloud even on browsers/OSes that ship no native voice for those tags.

import { synthesizeSpeech } from "@/lib/tts.functions";

export type TTSLang = "en" | "te" | "hi";

const LANG_TAG: Record<TTSLang, string> = {
  en: "en-US",
  te: "te-IN",
  hi: "hi-IN",
};

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing && existing.length) return resolve(existing);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(synth.getVoices() || []);
    };
    synth.onvoiceschanged = finish;
    setTimeout(finish, 1500);
  });
  return voicesPromise;
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: TTSLang): SpeechSynthesisVoice | null {
  const tag = LANG_TAG[lang].toLowerCase();
  const short = tag.split("-")[0];
  const exact = voices.filter((v) => v.lang?.toLowerCase() === tag);
  const loose = voices.filter((v) => v.lang?.toLowerCase().startsWith(short));
  const pool = exact.length ? exact : loose;
  if (!pool.length) return null;
  return (
    pool.find((v) => /google|natural|neural|wavenet/i.test(v.name)) ||
    pool.find((v) => /microsoft/i.test(v.name)) ||
    pool[0]
  );
}

// Single reusable Audio element so we don't stack overlapping playback.
let currentAudio: HTMLAudioElement | null = null;
let fallbackResolve: (() => void) | null = null;

function stopFallback() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
    } catch {}
    currentAudio = null;
  }
  if (fallbackResolve) {
    const r = fallbackResolve;
    fallbackResolve = null;
    r();
  }
}

export function cancelSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  stopFallback();
}

/** Pause whatever is currently being spoken (native or gateway audio). */
export function pauseSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    try { window.speechSynthesis.pause(); } catch {}
  }
  if (currentAudio) { try { currentAudio.pause(); } catch {} }
}

/** Resume speech paused with `pauseSpeech()`. */
export function resumeSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    try { window.speechSynthesis.resume(); } catch {}
  }
  if (currentAudio) { void currentAudio.play().catch(() => {}); }
}

async function playViaGateway(text: string, lang: TTSLang) {
  try {
    const { audio, mime } = await synthesizeSpeech({ data: { text, language: lang } });
    stopFallback();
    const el = new Audio(`data:${mime};base64,${audio}`);
    el.volume = 1;
    currentAudio = el;
    const ended = new Promise<void>((resolve) => {
      fallbackResolve = resolve;
      el.onended = () => resolve();
      el.onerror = () => resolve();
    });
    await el.play();
    console.log(`[TTS] gateway playback ok (${lang}, ${text.length} chars)`);
    await ended;
    fallbackResolve = null;
  } catch (err) {
    console.error("[TTS] gateway fallback failed:", err);
  }
}

export interface SpeakOptions {
  urgent?: boolean;
  interrupt?: boolean;
  rate?: number;
  pitch?: number;
}

// Resolves when playback has finished (or failed). The Speech Manager relies
// on this to serialize announcements across modules.
export async function speak(text: string, lang: TTSLang = "en", opts: SpeakOptions = {}) {
  if (!text || typeof window === "undefined") return;
  const synth = window.speechSynthesis;

  if (opts.interrupt || opts.urgent) cancelSpeech();

  const voices = await loadVoices();
  const nativeVoice = synth ? pickVoice(voices, lang) : null;

  console.log(
    `[TTS] speak lang=${lang} voices=${voices.length} nativeVoice=${nativeVoice?.name ?? "none"}`,
  );

  if (nativeVoice && synth) {
    stopFallback();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = nativeVoice;
    u.lang = nativeVoice.lang || LANG_TAG[lang];
    u.rate = opts.rate ?? (opts.urgent ? 1.15 : 1);
    u.pitch = opts.pitch ?? (opts.urgent ? 1.2 : 1);
    u.volume = 1;
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      u.onend = done;
      u.onerror = (e) => {
        if (settled) return;
        settled = true;
        if (e.error === "interrupted" || e.error === "canceled") return resolve();
        console.warn("[TTS] native error, falling back to gateway:", e.error);
        void playViaGateway(text, lang).then(resolve);
      };
      synth.speak(u);
    });
    return;
  }

  // No native voice for this language — go straight to gateway.
  console.log(`[TTS] no native ${LANG_TAG[lang]} voice; using AI Gateway fallback`);
  await playViaGateway(text, lang);
}