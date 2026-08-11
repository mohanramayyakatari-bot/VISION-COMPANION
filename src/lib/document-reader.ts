// DocumentReader — turns extracted OCR text into a paced, voice-controlled
// reading session: sections are read one at a time and the user can pause,
// continue, repeat, skip to the next/previous section, or stop by voice.

import { sayAndWait, stopSpeaking, pauseSpeaking, resumeSpeaking } from "@/lib/speech-manager";
import type { Lang } from "@/lib/language";

export type ReaderState = {
  active: boolean;
  paused: boolean;
  index: number;
  total: number;
};

const MSG = {
  none: {
    en: "I don't see any readable text. Hold the camera steady over the page.",
    te: "చదవగలిగే వచనం కనిపించడం లేదు. కెమెరాను పేజీపై స్థిరంగా ఉంచండి.",
    hi: "कोई पढ़ने योग्य पाठ नहीं दिख रहा। कैमरा पेज पर स्थिर रखें।",
  },
  start: {
    en: (n: number) => `Document detected. ${n} section${n > 1 ? "s" : ""}. Starting to read.`,
    te: (n: number) => `పత్రం కనిపించింది. ${n} భాగాలు. చదవడం ప్రారంభిస్తున్నాను.`,
    hi: (n: number) => `दस्तावेज़ मिला। ${n} भाग। पढ़ना शुरू कर रहा हूँ।`,
  },
  end: {
    en: "That is the end of the document.",
    te: "పత్రం ముగిసింది.",
    hi: "दस्तावेज़ समाप्त हुआ।",
  },
  paused: { en: "Paused.", te: "ఆపాను.", hi: "रोक दिया।" },
  resumed: { en: "Continuing.", te: "కొనసాగిస్తున్నాను.", hi: "जारी रख रहा हूँ।" },
  stopped: { en: "Stopped reading.", te: "చదవడం ఆపాను.", hi: "पढ़ना बंद किया।" },
  last: { en: "This is the last section.", te: "ఇదే చివరి భాగం.", hi: "यह अंतिम भाग है।" },
  first: { en: "This is the first section.", te: "ఇదే మొదటి భాగం.", hi: "यह पहला भाग है।" },
};

/** Quality hints the vision model can return so we can coach the user. */
export const QUALITY_HINT: Record<string, Record<Lang, string>> = {
  too_far: {
    en: "The text is too small. Move the camera closer to the page.",
    te: "వచనం చాలా చిన్నదిగా ఉంది. కెమెరాను పేజీకి దగ్గరగా తీసుకురండి.",
    hi: "पाठ बहुत छोटा है। कैमरा पेज के पास लाएँ।",
  },
  blurry: {
    en: "The image is blurry. Hold the camera still for a moment.",
    te: "చిత్రం అస్పష్టంగా ఉంది. కెమెరాను కొద్దిసేపు కదపకుండా ఉంచండి.",
    hi: "तस्वीर धुंधली है। कैमरा थोड़ी देर स्थिर रखें।",
  },
  tilted: {
    en: "The page looks tilted. Hold the camera flat above the page.",
    te: "పేజీ వంగి ఉంది. కెమెరాను పేజీపై సమాంతరంగా ఉంచండి.",
    hi: "पेज तिरछा है। कैमरा पेज के ऊपर सीधा रखें।",
  },
  partial: {
    en: "Part of the page is out of view. Move the camera back a little.",
    te: "పేజీలో కొంత భాగం కనిపించడం లేదు. కెమెరాను కొంచెం వెనక్కి తీసుకోండి.",
    hi: "पेज का कुछ हिस्सा बाहर है। कैमरा थोड़ा पीछे करें।",
  },
};

/** Split the OCR output into speakable sections, preserving reading order. */
export function splitIntoSections(text: string, maxChars = 320): string[] {
  const clean = (text ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}|\n(?=[A-Z\u0C00-\u0C7F\u0900-\u097F0-9])/);
  const sections: string[] = [];
  let buf = "";
  const push = () => { if (buf.trim()) sections.push(buf.trim()); buf = ""; };

  for (const para of paragraphs) {
    const p = para.trim();
    if (!p) continue;
    if (p.length > maxChars) {
      push();
      const sentences = p.match(/[^.!?।]+[.!?।]*\s*/g) ?? [p];
      for (const s of sentences) {
        if (buf.length + s.length > maxChars) push();
        buf += s;
      }
      push();
      continue;
    }
    if (buf.length + p.length > maxChars) push();
    buf += (buf ? "\n" : "") + p;
  }
  push();
  return sections;
}

type Listener = (s: ReaderState) => void;

export class DocumentReader {
  private sections: string[] = [];
  private index = 0;
  private active = false;
  private paused = false;
  private runToken = 0;
  private lang: Lang = "en";
  private listeners = new Set<Listener>();

  subscribe(cb: Listener) {
    this.listeners.add(cb);
    cb(this.state);
    return () => { this.listeners.delete(cb); };
  }

  get state(): ReaderState {
    return { active: this.active, paused: this.paused, index: this.index, total: this.sections.length };
  }

  private emit() { for (const l of this.listeners) l(this.state); }

  /** Begin reading a freshly extracted document. */
  async start(text: string, lang: Lang) {
    this.lang = lang;
    const sections = splitIntoSections(text);
    if (!sections.length) {
      await sayAndWait(MSG.none[lang], lang, "ocr");
      return;
    }
    this.stop(true);
    this.sections = sections;
    this.index = 0;
    this.active = true;
    this.paused = false;
    this.emit();
    await sayAndWait(MSG.start[lang](sections.length), lang, "ocr");
    void this.loop(++this.runToken);
  }

  private async loop(token: number) {
    while (this.active && token === this.runToken && this.index < this.sections.length) {
      if (this.paused) { await new Promise((r) => setTimeout(r, 300)); continue; }
      const section = this.sections[this.index]!;
      await sayAndWait(section, this.lang, "ocr");
      if (token !== this.runToken || !this.active) return;
      if (this.paused) continue;
      this.index++;
      this.emit();
    }
    if (this.active && token === this.runToken) {
      this.active = false;
      this.emit();
      await sayAndWait(MSG.end[this.lang], this.lang, "ocr");
    }
  }

  pause() {
    if (!this.active || this.paused) return;
    this.paused = true;
    pauseSpeaking();
    this.emit();
  }

  resume() {
    if (!this.active || !this.paused) return;
    this.paused = false;
    resumeSpeaking();
    this.emit();
  }

  /** Repeat the section currently being read. */
  repeat() {
    if (!this.active) return;
    this.paused = false;
    stopSpeaking();
    void this.loop(++this.runToken);
  }

  next() {
    if (!this.active) return;
    if (this.index >= this.sections.length - 1) {
      void sayAndWait(MSG.last[this.lang], this.lang, "ocr");
      return;
    }
    this.index++;
    this.paused = false;
    stopSpeaking();
    this.emit();
    void this.loop(++this.runToken);
  }

  previous() {
    if (!this.active) return;
    if (this.index === 0) {
      void sayAndWait(MSG.first[this.lang], this.lang, "ocr");
      return;
    }
    this.index--;
    this.paused = false;
    stopSpeaking();
    this.emit();
    void this.loop(++this.runToken);
  }

  stop(silent = false) {
    const wasActive = this.active;
    this.active = false;
    this.paused = false;
    this.runToken++;
    this.emit();
    if (wasActive) {
      stopSpeaking();
      if (!silent) void sayAndWait(MSG.stopped[this.lang], this.lang, "ocr");
    }
  }

  setLang(lang: Lang) { this.lang = lang; }
  get isActive() { return this.active; }
}

/** One reader per app session — reachable from any screen. */
export const documentReader = new DocumentReader();
