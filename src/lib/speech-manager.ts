// Centralized Speech Manager.
// Every module (vision, navigation, OCR, faces, emergency, UI) speaks through
// `say()`. Only ONE utterance is ever active: lower-priority speech waits in a
// queue, higher-priority speech interrupts immediately and the interrupted
// message is resumed afterwards when it still matters.

import { speak as ttsSpeak, cancelSpeech, pauseSpeech, resumeSpeech, type TTSLang } from "@/lib/tts";

export type SpeechPriority =
  | "emergency"
  | "hazard"
  | "face"
  | "navigation"
  | "ocr"
  | "scene"
  | "shopping"
  | "general";

const RANK: Record<SpeechPriority, number> = {
  emergency: 0,
  hazard: 1,
  face: 2,
  navigation: 3,
  ocr: 4,
  scene: 5,
  shopping: 6,
  general: 7,
};

// Priorities important enough to be re-spoken after being interrupted.
const RESUMABLE = new Set<SpeechPriority>(["emergency", "hazard", "navigation"]);

type Item = {
  text: string;
  lang: TTSLang;
  priority: SpeechPriority;
  seq: number;
  done?: () => void;
};

let queue: Item[] = [];
let current: Item | null = null;
let running = false;
let seqCounter = 0;
let token = 0; // bumped on every interrupt/stop so stale playback loops exit

// De-duplication: identical text spoken within this window is dropped.
const DEDUPE_MS = 6000;
const recent = new Map<string, number>();

function isDuplicate(text: string): boolean {
  const now = Date.now();
  for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
  const key = text.trim().toLowerCase();
  if (recent.has(key)) return true;
  recent.set(key, now);
  return false;
}

function insert(item: Item) {
  const idx = queue.findIndex((q) => RANK[q.priority] > RANK[item.priority]);
  if (idx === -1) queue.push(item);
  else queue.splice(idx, 0, item);
  // Keep the queue short — stale chatter helps nobody.
  if (queue.length > 5) queue = queue.slice(0, 5);
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const item = queue.shift()!;
    current = item;
    const myToken = ++token;
    try {
      await ttsSpeak(item.text, item.lang, {
        urgent: item.priority === "emergency" || item.priority === "hazard",
      });
    } catch {
      /* never let one failed announcement stall the queue */
    }
    item.done?.();
    if (myToken !== token) {
      // We were interrupted; the interrupting call owns the queue from here.
      current = null;
      running = false;
      return;
    }
    current = null;
  }
  running = false;
}

export interface SayOptions {
  /** Skip the duplicate filter (e.g. an explicit "repeat" request). */
  force?: boolean;
  /** Drop everything queued and speak this alone. */
  exclusive?: boolean;
}

export function say(
  text: string,
  lang: TTSLang = "en",
  priority: SpeechPriority = "general",
  opts: SayOptions = {},
) {
  const clean = (text ?? "").trim();
  if (!clean || typeof window === "undefined") return;
  if (!opts.force && isDuplicate(clean)) return;

  const item: Item = { text: clean, lang, priority, seq: ++seqCounter };

  if (opts.exclusive) queue = [];

  if (current && RANK[priority] < RANK[current.priority]) {
    // Interrupt: stop the current utterance, requeue it if it still matters.
    const interrupted = current;
    token++;
    cancelSpeech();
    current = null;
    running = false;
    queue.unshift(item);
    if (RESUMABLE.has(interrupted.priority)) insert({ ...interrupted, seq: ++seqCounter });
    void pump();
    return;
  }

  insert(item);
  void pump();
}

/** Same as `say`, but resolves when this utterance finished (or was dropped). */
export function sayAndWait(
  text: string,
  lang: TTSLang = "en",
  priority: SpeechPriority = "general",
): Promise<void> {
  const clean = (text ?? "").trim();
  if (!clean || typeof window === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    const item: Item = { text: clean, lang, priority, seq: ++seqCounter, done };
    insert(item);
    void pump();
    // Safety net: never leave a reader loop hanging on a dropped item.
    setTimeout(done, 5000 + clean.length * 120);
  });
}

/** Pause the current utterance without losing the queue. */
export function pauseSpeaking() { pauseSpeech(); }

/** Resume after `pauseSpeaking()`. */
export function resumeSpeaking() { resumeSpeech(); }

/** Silence everything and clear the queue. */
export function stopSpeaking() {
  token++;
  for (const q of queue) q.done?.();
  queue = [];
  current?.done?.();
  current = null;
  running = false;
  cancelSpeech();
}

export function isSpeaking() {
  return !!current;
}
