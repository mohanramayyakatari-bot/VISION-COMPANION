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

// ------------------------------------------------- natural paragraph -------
// Turns the detection list into ONE grammatical sentence-paragraph in the
// active language. Presentation only — no change to detection itself.

function fmtDist(d: number | null, lang: Lang): string {
  if (d == null) return "";
  const n = d % 1 === 0 ? String(d) : String(Math.round(d * 10) / 10);
  return lang === "te" ? ` సుమారు ${n} మీటర్ల దూరంలో`
    : lang === "hi" ? ` लगभग ${n} मीटर पर`
    : ` at approximately ${n} meters`;
}

function joinList(parts: string[], lang: Lang): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  const and = lang === "te" ? "మరియు" : lang === "hi" ? "और" : "and";
  return `${parts.slice(0, -1).join(", ")} ${and} ${parts[parts.length - 1]}`;
}

/** One natural-language paragraph describing everything currently detected. */
export function describeDetections(dets: Detection[], lang: Lang): string {
  if (!dets.length) {
    return lang === "te" ? "ప్రస్తుతం నాకు ఏ వస్తువూ కనిపించడం లేదు."
      : lang === "hi" ? "अभी मुझे कोई वस्तु नहीं दिख रही है।"
      : "I can't see any objects right now.";
  }

  // group identical labels so repeats read as "chairs on the left and right"
  const groups = new Map<string, Detection[]>();
  for (const d of dets) {
    const k = d.label.toLowerCase();
    const g = groups.get(k);
    if (g) g.push(d); else groups.set(k, [d]);
  }

  const phrases: string[] = [];
  for (const [, g] of groups) {
    const label = g[0]!.label;
    if (g.length === 1) {
      const d = g[0]!;
      phrases.push(
        lang === "te" ? `${POS[lang][d.position]}${fmtDist(d.distance, lang)} ${label}`
          : lang === "hi" ? `${POS[lang][d.position]}${fmtDist(d.distance, lang)} ${label}`
          : `a ${label} ${POS[lang][d.position]}${fmtDist(d.distance, lang)}`,
      );
    } else {
      const items = g.map((d) =>
        lang === "en"
          ? `${POS[lang][d.position]}${fmtDist(d.distance, lang)}`
          : `${POS[lang][d.position]}${fmtDist(d.distance, lang)}`,
      );
      const list = joinList(items, lang);
      phrases.push(
        lang === "te" ? `${g.length} ${label}లు ${list}`
          : lang === "hi" ? `${g.length} ${label} ${list}`
          : `${g.length} ${label}s, ${list}`,
      );
    }
  }

  const body = joinList(phrases, lang);
  return lang === "te" ? `నాకు ${body} కనిపిస్తున్నాయి.`
    : lang === "hi" ? `मुझे ${body} दिखाई दे रहे हैं।`
    : `I can see ${body}.`;
}

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

// Relations come from the SAME stored people memory the People Manager uses,
// so any camera mode can say "Your friend Ram is in front of you."
let RELATIONS: Record<string, string> = {};

export function setPersonRelations(map: Record<string, string>) {
  RELATIONS = Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]),
  );
}

const REL_WORD: Record<Lang, Record<string, string>> = {
  en: { friend: "Your friend", family: "Your family member", mother: "Your mother", father: "Your father", brother: "Your brother", sister: "Your sister", neighbour: "Your neighbour", neighbor: "Your neighbour", caregiver: "Your caregiver", doctor: "Your doctor", colleague: "Your colleague" },
  te: { friend: "మీ స్నేహితుడు", family: "మీ కుటుంబ సభ్యులు", mother: "మీ అమ్మ", father: "మీ నాన్న", brother: "మీ సోదరుడు", sister: "మీ సోదరి", neighbour: "మీ పొరుగువారు", neighbor: "మీ పొరుగువారు", caregiver: "మీ సంరక్షకుడు", doctor: "మీ డాక్టర్", colleague: "మీ సహోద్యోగి" },
  hi: { friend: "आपका दोस्त", family: "आपके परिवार के सदस्य", mother: "आपकी माँ", father: "आपके पिता", brother: "आपका भाई", sister: "आपकी बहन", neighbour: "आपका पड़ोसी", neighbor: "आपका पड़ोसी", caregiver: "आपका देखभालकर्ता", doctor: "आपके डॉक्टर", colleague: "आपका सहकर्मी" },
};

/** "Your friend Ram" when a relation is stored, otherwise just "Ram". */
export function personPhrase(name: string, lang: Lang): string {
  const rel = RELATIONS[name.toLowerCase()];
  if (!rel) return name;
  const word = REL_WORD[lang][rel.trim().toLowerCase()];
  return word ? `${word} ${name}` : name;
}

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
          said.push(lang === "te" ? `ఒక వ్యక్తి ${p} ఉన్నారు.` : lang === "hi" ? `एक व्यक्ति ${p} है।` : `A person is ${p}.`);
        } else {
          const who = personPhrase(identity, lang);
          said.push(lang === "te" ? `${who} ${p} ఉన్నారు.` : lang === "hi" ? `${who} ${p} हैं।` : `${who} is ${p}.`);
        }
      } else if (t.announced && moved && identity !== "unknown") {
        const p = POS[lang][o.position];
        const who = personPhrase(identity, lang);
        said.push(lang === "te" ? `${who} ఇప్పుడు ${p}.` : lang === "hi" ? `${who} अब ${p}।` : `${who} is now ${p}.`);
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
