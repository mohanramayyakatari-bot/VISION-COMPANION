// Global app language store. One source of truth for UI text, TTS language and
// speech recognition, so a voice command like "change language to Hindi"
// actually changes the whole application, not just one screen.

export type Lang = "en" | "te" | "hi";

export const LANG_LABEL: Record<Lang, string> = { en: "English", te: "తెలుగు", hi: "हिन्दी" };
export const LANG_TAG: Record<Lang, string> = { en: "en-US", te: "te-IN", hi: "hi-IN" };

const KEY = "vision.lang";
let current: Lang = "en";

if (typeof window !== "undefined") {
  try {
    const saved = window.localStorage.getItem(KEY) as Lang | null;
    if (saved === "en" || saved === "te" || saved === "hi") current = saved;
  } catch { /* ignore */ }
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (current === lang) return;
  current = lang;
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("vision:langChanged", { detail: { lang } }));
}

export function onLangChange(cb: (lang: Lang) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const h = (e: Event) => cb((e as CustomEvent).detail.lang as Lang);
  window.addEventListener("vision:langChanged", h);
  return () => window.removeEventListener("vision:langChanged", h);
}

/** Pick a translated string for the active language. */
export function t(map: Record<Lang, string>, lang: Lang = current): string {
  return map[lang] ?? map.en;
}
