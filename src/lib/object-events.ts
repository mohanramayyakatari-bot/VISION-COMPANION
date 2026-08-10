// Object Event Engine + Face Tracker.
// Turns per-frame detections into *events* so the assistant only speaks when
// something actually changes (new object, object approaching, person left...).
// Both engines are pure state machines — they never touch the camera or TTS.

export type Lang = "en" | "te" | "hi";

export type Detection = {
  label: string;
  position: "left" | "center" | "right";
  distance: number | null; // metres, best effort
};

export type ObjectEventKind =
  | "NEW_OBJECT"
  | "OBJECT_DISAPPEARED"
  | "OBJECT_APPROACHING"
  | "OBJECT_MOVING_AWAY"
  | "OBJECT_DIRECTION_CHANGED"
  | "PERSON_ENTERED"
  | "PERSON_LEFT"
  | "OBJECT_BECAME_DANGEROUS";

export type ObjectEvent = {
  kind: ObjectEventKind;
  det: Detection;
  urgent: boolean;
};

const PERSON_WORDS = /(person|people|man|woman|boy|girl|child|వ్యక్తి|మనిషి|व्यक्ति|आदमी|औरत)/i;
const DANGER_WORDS =
  /(car|vehicle|motorcycle|motorbike|bike|bicycle|scooter|truck|bus|auto|train|knife|gun|fire|flame|smoke|stairs|staircase|step|hole|drain|pit|glass|dog|wire|కారు|వాహనం|బైక్|బస్|మంట|కుక్క|मोटरसाइकिल|गाड़ी|वाहन|बस|आग|कुत्ता|सीढ़ी)/i;

export function isPerson(label: string) { return PERSON_WORDS.test(label); }
export function isDangerous(label: string) { return DANGER_WORDS.test(label); }

/** Parse the model's `name|position|distance` lines into detections. */
export function parseDetections(raw: string): Detection[] {
  const out: Detection[] = [];
  for (const line of (raw ?? "").split(/\r?\n/)) {
    const parts = line.split("|").map((s) => s.trim());
    if (parts.length < 2 || !parts[0]) continue;
    const label = parts[0].replace(/^[-*\d.\s]+/, "").trim();
    if (!label || /^(none|nothing|no objects?)$/i.test(label)) continue;
    const posRaw = (parts[1] ?? "").toLowerCase();
    const position: Detection["position"] =
      posRaw.startsWith("l") ? "left" : posRaw.startsWith("r") ? "right" : "center";
    const dNum = parseFloat((parts[2] ?? "").replace(/[^\d.]/g, ""));
    out.push({ label, position, distance: Number.isFinite(dNum) ? dNum : null });
  }
  return out.slice(0, 8);
}

type Track = { det: Detection; lastSeen: number; misses: number; announced: boolean };

/** Frame-to-frame object tracking that emits only what changed. */
export class ObjectEventEngine {
  private tracks = new Map<string, Track>();
  private frame = 0;

  reset() { this.tracks.clear(); this.frame = 0; }

  update(dets: Detection[]): ObjectEvent[] {
    this.frame++;
    const events: ObjectEvent[] = [];
    const seen = new Set<string>();

    for (const d of dets) {
      const key = d.label.toLowerCase();
      seen.add(key);
      const prev = this.tracks.get(key);
      if (!prev) {
        this.tracks.set(key, { det: d, lastSeen: this.frame, misses: 0, announced: true });
        // A brand new object is only "new" after the first frame; the very first
        // frame is the baseline scene, which the scene modes already describe.
        events.push({
          kind: isPerson(d.label) ? "PERSON_ENTERED" : "NEW_OBJECT",
          det: d,
          urgent: isDangerous(d.label),
        });
        continue;
      }
      const before = prev.det;
      prev.det = d; prev.lastSeen = this.frame; prev.misses = 0;
      if (before.distance != null && d.distance != null) {
        if (d.distance <= before.distance - 0.8) {
          events.push({ kind: "OBJECT_APPROACHING", det: d, urgent: isDangerous(d.label) && d.distance < 6 });
          continue;
        }
        if (d.distance >= before.distance + 1.5) {
          events.push({ kind: "OBJECT_MOVING_AWAY", det: d, urgent: false });
          continue;
        }
      }
      if (before.position !== d.position && isDangerous(d.label)) {
        events.push({ kind: "OBJECT_DIRECTION_CHANGED", det: d, urgent: false });
      }
    }

    for (const [key, t] of this.tracks) {
      if (seen.has(key)) continue;
      t.misses++;
      if (t.misses >= 2) {
        this.tracks.delete(key);
        events.push({
          kind: isPerson(t.det.label) ? "PERSON_LEFT" : "OBJECT_DISAPPEARED",
          det: t.det,
          urgent: false,
        });
      }
    }

    // First frame: treat as baseline, announce at most the two nearest things.
    if (this.frame === 1) return events.slice(0, 2);
    // Urgent first, then cap the chatter.
    events.sort((a, b) => Number(b.urgent) - Number(a.urgent));
    return events.slice(0, 3);
  }
}

const POS: Record<Lang, Record<Detection["position"], string>> = {
  en: { left: "on your left", center: "in front of you", right: "on your right" },
  te: { left: "మీ ఎడమవైపు", center: "మీ ముందు", right: "మీ కుడివైపు" },
  hi: { left: "आपके बाईं ओर", center: "आपके सामने", right: "आपके दाईं ओर" },
};

export function describeEvent(e: ObjectEvent, lang: Lang): string {
  const p = POS[lang][e.det.position];
  const n = e.det.label;
  const d = e.det.distance != null ? ` ${Math.round(e.det.distance)}` : "";
  switch (e.kind) {
    case "PERSON_ENTERED":
      return lang === "te" ? `వ్యక్తి ${p}.` : lang === "hi" ? `व्यक्ति ${p}।` : `Person ${p}.`;
    case "PERSON_LEFT":
      return lang === "te" ? "వ్యక్తి వెళ్లిపోయారు." : lang === "hi" ? "व्यक्ति चला गया।" : "Person left.";
    case "NEW_OBJECT":
      return e.urgent
        ? lang === "te" ? `జాగ్రత్త. ${n} ${p}.` : lang === "hi" ? `सावधान। ${n} ${p}।` : `Careful. ${n} ${p}.`
        : lang === "te" ? `${n} ${p}.` : lang === "hi" ? `${n} ${p}।` : `${n} ${p}.`;
    case "OBJECT_APPROACHING":
      return e.urgent
        ? lang === "te" ? `ఆగండి. ${n} ${p} దగ్గరకు వస్తోంది.` : lang === "hi" ? `रुकिए। ${n} ${p} पास आ रहा है।` : `Stop. ${n} approaching ${p}.`
        : lang === "te" ? `${n} ${p} దగ్గరవుతోంది${d}.` : lang === "hi" ? `${n} ${p} पास आ रहा है${d}।` : `${n} approaching ${p}${d ? `, ${d.trim()} metres` : ""}.`;
    case "OBJECT_MOVING_AWAY":
      return lang === "te" ? `${n} దూరమవుతోంది.` : lang === "hi" ? `${n} दूर जा रहा है।` : `${n} moving away.`;
    case "OBJECT_DIRECTION_CHANGED":
      return lang === "te" ? `${n} ఇప్పుడు ${p}.` : lang === "hi" ? `${n} अब ${p}।` : `${n} is now ${p}.`;
    case "OBJECT_DISAPPEARED":
      return lang === "te" ? `${n} ఇక కనిపించడం లేదు.` : lang === "hi" ? `${n} अब नहीं दिख रहा।` : `${n} no longer in view.`;
    default:
      return "";
  }
}

// ---------------------------------------------------------------- faces ----

export type FaceObservation = {
  name: string;          // "unknown" for unmatched people
  position: Detection["position"];
  confidence: number;    // 0..1
};

/** `name|position|confidence` lines from the face prompt. */
export function parseFaces(raw: string): FaceObservation[] {
  const out: FaceObservation[] = [];
  for (const line of (raw ?? "").split(/\r?\n/)) {
    const parts = line.split("|").map((s) => s.trim());
    if (parts.length < 2 || !parts[0]) continue;
    const name = parts[0].replace(/^[-*\d.\s]+/, "").trim();
    if (!name || /^(none|no one|nobody)$/i.test(name)) continue;
    const posRaw = (parts[1] ?? "").toLowerCase();
    const position: Detection["position"] =
      posRaw.startsWith("l") ? "left" : posRaw.startsWith("r") ? "right" : "center";
    let c = parseFloat((parts[2] ?? "").replace(/[^\d.]/g, ""));
    if (!Number.isFinite(c)) c = 0.5;
    if (c > 1) c = c / 100;
    out.push({ name, position, confidence: c });
  }
  return out.slice(0, 6);
}

/** Configurable thresholds — tuned conservatively to avoid false identities. */
export const FACE_THRESHOLDS = { high: 0.78, medium: 0.55 };
/** Frames of agreement required before a name is spoken. */
export const FACE_CONFIRMATIONS = 2;

type FaceTrack = { hits: number; misses: number; announced: boolean; position: Detection["position"] };

export class FaceTracker {
  private tracks = new Map<string, FaceTrack>();

  reset() { this.tracks.clear(); }

  /** Returns the sentences that should be spoken for this frame (may be empty). */
  update(obs: FaceObservation[], lang: Lang): string[] {
    const said: string[] = [];
    const seen = new Set<string>();

    for (const o of obs) {
      const known = !/^unknown/i.test(o.name);
      // Low confidence never gets a name.
      const identity =
        known && o.confidence >= FACE_THRESHOLDS.high ? o.name
        : known && o.confidence >= FACE_THRESHOLDS.medium ? null // keep verifying, stay silent
        : "unknown";
      if (identity === null) continue;

      const key = identity.toLowerCase();
      seen.add(key);
      const t = this.tracks.get(key) ?? { hits: 0, misses: 0, announced: false, position: o.position };
      t.hits++; t.misses = 0;
      const moved = t.position !== o.position;
      t.position = o.position;
      this.tracks.set(key, t);

      const need = identity === "unknown" ? FACE_CONFIRMATIONS + 1 : FACE_CONFIRMATIONS;
      if (!t.announced && t.hits >= need) {
        t.announced = true;
        const p = POS[lang][o.position];
        if (identity === "unknown") {
          said.push(lang === "te" ? `తెలియని వ్యక్తి ${p}.` : lang === "hi" ? `अनजान व्यक्ति ${p}।` : `Unknown person ${p}.`);
        } else {
          said.push(lang === "te" ? `${identity} ${p} ఉన్నారు.` : lang === "hi" ? `${identity} ${p} हैं।` : `${identity} is ${p}.`);
        }
      } else if (t.announced && moved && identity !== "unknown") {
        const p = POS[lang][o.position];
        said.push(lang === "te" ? `${identity} ఇప్పుడు ${p}.` : lang === "hi" ? `${identity} अब ${p}।` : `${identity} is now ${p}.`);
      }
    }

    for (const [key, t] of this.tracks) {
      if (seen.has(key)) continue;
      t.misses++;
      if (t.misses >= 3) this.tracks.delete(key); // gone; a return re-announces
    }
    return said;
  }
}
