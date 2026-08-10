import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { analyzeFrame } from "@/lib/vision.functions";
import { listAllPeople, loadPeopleRefsAsDataUrls } from "@/lib/people";
import { say, stopSpeaking, type SpeechPriority } from "@/lib/speech-manager";
import {
  ObjectEventEngine, FaceTracker, parseDetections, parseFaces, describeEvent,
} from "@/lib/object-events";
import { Button } from "@/components/ui/button";
import {
  Camera as CameraIcon, Eye, ScanText, Coins, Palette, ShieldAlert,
  Navigation, Users, Package, Loader2, ArrowLeft, RefreshCw, Play, Square, Siren,
} from "lucide-react";

export const Route = createFileRoute("/camera")({
  component: CameraPage,
  validateSearch: (s: Record<string, unknown>) => ({
    mode: typeof s.mode === "string" ? (s.mode as Mode) : undefined,
    lang: typeof s.lang === "string" ? (s.lang as Lang) : undefined,
    auto: s.auto === "1" || s.auto === 1 || s.auto === true || s.auto === "true",
  }),
  head: () => ({
    meta: [
      { title: "Live Camera — Vision Companion" },
      { name: "description", content: "Real-time AI vision assistant. Point your camera and hear what's in front of you." },
    ],
  }),
});

type Lang = "en" | "te" | "hi";
type Mode = "safety" | "scene" | "object" | "read" | "currency" | "color" | "hazard" | "navigate" | "face" | "product";

const MODES: { id: Mode; label: string; icon: any; hint: Record<Lang, string> }[] = [
  { id: "safety", label: "Safety Live", icon: Siren, hint: { en: "Continuous safety watch on.", te: "నిరంతర భద్రతా పర్యవేక్షణ.", hi: "लगातार सुरक्षा निगरानी।" } },
  { id: "scene", label: "Describe Scene", icon: Eye, hint: { en: "Analyzing your surroundings.", te: "మీ చుట్టూ ఉన్నదాన్ని విశ్లేషిస్తున్నాను.", hi: "आपके आस-पास देख रहा हूँ।" } },
  { id: "object", label: "Detect Objects", icon: Package, hint: { en: "Detecting objects.", te: "వస్తువులను గుర్తిస్తున్నాను.", hi: "वस्तुएँ पहचान रहा हूँ।" } },
  { id: "read", label: "Read Text", icon: ScanText, hint: { en: "Reading the text.", te: "వచనాన్ని చదువుతున్నాను.", hi: "पाठ पढ़ रहा हूँ।" } },
  { id: "currency", label: "Money", icon: Coins, hint: { en: "Checking the currency.", te: "కరెన్సీని పరిశీలిస్తున్నాను.", hi: "नोट पहचान रहा हूँ।" } },
  { id: "color", label: "Color", icon: Palette, hint: { en: "Identifying colors.", te: "రంగులను గుర్తిస్తున్నాను.", hi: "रंग पहचान रहा हूँ।" } },
  { id: "hazard", label: "Hazards", icon: ShieldAlert, hint: { en: "Checking for hazards.", te: "ప్రమాదాలను తనిఖీ చేస్తున్నాను.", hi: "खतरे देख रहा हूँ।" } },
  { id: "navigate", label: "Navigate", icon: Navigation, hint: { en: "Guiding your next step.", te: "మీ తదుపరి అడుగును సూచిస్తున్నాను.", hi: "अगला कदम बता रहा हूँ।" } },
  { id: "face", label: "People", icon: Users, hint: { en: "Looking for people.", te: "మనుషుల కోసం చూస్తున్నాను.", hi: "लोगों को देख रहा हूँ।" } },
  { id: "product", label: "Product Label", icon: Package, hint: { en: "Reading the label.", te: "లేబుల్ చదువుతున్నాను.", hi: "लेबल पढ़ रहा हूँ।" } },
];

const LANG_TAG: Record<Lang, string> = { en: "en-US", te: "te-IN", hi: "hi-IN" };
const LANG_LABEL: Record<Lang, string> = { en: "English", te: "తెలుగు", hi: "हिन्दी" };

// Everything speaks through the central Speech Manager, which guarantees a
// single voice at a time and priority-based interruption.
function speak(text: string, lang: Lang, priority: SpeechPriority = "general", force = false) {
  say(text, lang, priority, { force });
}

// Which speech priority a camera mode's own output carries.
const MODE_PRIORITY: Record<Mode, SpeechPriority> = {
  safety: "hazard",
  hazard: "hazard",
  navigate: "navigation",
  read: "ocr",
  product: "shopping",
  currency: "shopping",
  face: "face",
  scene: "scene",
  object: "scene",
  color: "general",
};

// Modes that keep background face recognition running alongside them.
const FACE_BG_MODES = new Set<Mode>([
  "safety", "scene", "object", "read", "currency", "color", "hazard", "navigate", "product",
]);

// Extract a destination from phrases like "navigate to X" / "take me to X".
function parseDestination(q?: string): string | null {
  if (!q) return null;
  const m = q.match(/(?:navigate|take me|go|directions|guide me)\s+to\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function CameraPage() {
  const search = Route.useSearch();
  const analyze = useServerFn(analyzeFrame);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>(search.mode ?? "scene");
  const [lang, setLang] = useState<Lang>(search.lang ?? "en");
  const [result, setResult] = useState<string>("");
  const [auto, setAuto] = useState(!!search.auto);
  const [people, setPeople] = useState(() => listAllPeople());
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSpoken = useRef<string>("");
  const inFlight = useRef(false);
  // Shared analysis state: one event engine + one face tracker for the whole
  // camera session, used by every mode over the SAME video stream.
  const objEngine = useRef(new ObjectEventEngine());
  const faceTracker = useRef(new FaceTracker());

  useEffect(() => {
    const h = () => setPeople(listAllPeople());
    h();
    window.addEventListener("vision:peopleChanged", h);
    return () => window.removeEventListener("vision:peopleChanged", h);
  }, []);

  // Spoken confirmation the moment a mode is launched from a card or voice command.
  useEffect(() => {
    const meta = MODES.find((m) => m.id === (search.mode ?? "scene"));
    if (meta) speak(meta.hint[lang], lang, "general", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-run once the camera is ready if a mode was passed via URL (voice command).
  useEffect(() => {
    if (ready && search.mode) {
      const t = setTimeout(() => run(search.mode as Mode), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const startCamera = async (dir: "environment" | "user" = facing) => {
    setErr(null);
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: dir }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch (e: any) {
      setErr(e?.message ?? "Camera access was denied. Enable camera permission in your browser.");
      setReady(false);
    }
  };

  useEffect(() => {
    startCamera(facing);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (autoTimer.current) clearTimeout(autoTimer.current);
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  const captureBase64 = (): string | null => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return null;
    const w = Math.min(v.videoWidth, 960);
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.78);
  };

  const run = async (m: Mode = mode) => {
    if (inFlight.current) return;
    const img = captureBase64();
    if (!img) { setErr("Camera not ready yet."); return; }
    inFlight.current = true;
    setBusy(true); setErr(null);
    const meta = MODES.find((x) => x.id === m)!;
    // Skip the "Analyzing…" chatter in live mode — it drowns the actual answer.
    if (!auto) speak(meta.hint[lang], lang);
    try {
      const peopleRefs = m === "face" ? await loadPeopleRefsAsDataUrls() : undefined;
      const { text } = await analyze({ data: { imageBase64: img, mode: m, language: lang, peopleRefs } });

      // --- Object mode: event-driven. Only changes are spoken, immediately. ---
      if (m === "object") {
        const dets = parseDetections(text);
        setResult(
          dets.length
            ? dets.map((d) => `${d.label} · ${d.position}${d.distance != null ? ` · ~${d.distance}m` : ""}`).join("\n")
            : text,
        );
        const events = objEngine.current.update(dets);
        for (const ev of events) {
          const line = describeEvent(ev, lang);
          if (line) say(line, lang, ev.urgent ? "hazard" : "scene", { force: ev.urgent });
        }
        return;
      }

      // --- Face mode: multi-frame verified identities, one line per person. ---
      if (m === "face") {
        const obs = parseFaces(text);
        setResult(
          obs.length
            ? obs.map((o) => `${o.name} · ${o.position} · ${Math.round(o.confidence * 100)}%`).join("\n")
            : text,
        );
        for (const line of faceTracker.current.update(obs, lang)) say(line, lang, "face");
        return;
      }

      setResult(text);

      // Safety mode: interrupt immediately for HAZARD, otherwise low-key describe scene.
      if (m === "safety") {
        const isHazard = /^\s*HAZARD\s*:/i.test(text);
        const clean = text.replace(/^\s*(HAZARD|SCENE)\s*:\s*/i, "").trim();
        if (!clean) return;
        if (isHazard) {
          lastSpoken.current = "";
          speak(clean, lang, "hazard", true);
        } else if (clean !== lastSpoken.current) {
          lastSpoken.current = clean;
          speak(clean, lang, "scene");
        }
      } else if (text && text !== lastSpoken.current) {
        lastSpoken.current = text;
        speak(text, lang, MODE_PRIORITY[m] ?? "general", !auto);
      }
    } catch (e: any) {
      const msg = e?.message ?? "Something went wrong.";
      setErr(msg);
      speak(msg, lang, "general", true);
    } finally {
      inFlight.current = false;
      setBusy(false);
      // Non-blocking: schedule next capture immediately; don't wait for TTS.
      // Safety mode runs as fast as the network allows (~800ms round-trip typical).
      if (auto) {
        // Newest-frame-first: the next capture is scheduled the moment the
        // previous inference returns, never waiting for speech to finish.
        const delay = m === "face" ? 1200 : m === "safety" || m === "object" ? 250 : 1200;
        autoTimer.current = setTimeout(() => run(m), delay);
      }
    }
  };

  const toggleAuto = () => {
    setAuto((a) => {
      const next = !a;
      if (!next && autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
      if (next) setTimeout(() => run(mode), 100);
      return next;
    });
  };

  // ---- Background face recognition -------------------------------------
  // Runs alongside every other camera mode on the SAME video stream, so a
  // known person is announced even while reading text, navigating, etc.
  const faceBgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faceBgBusy = useRef(false);

  useEffect(() => {
    if (!ready || mode === "face" || !FACE_BG_MODES.has(mode) || people.length === 0) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (!faceBgBusy.current && !inFlight.current) {
        faceBgBusy.current = true;
        try {
          const img = captureBase64();
          if (img) {
            const refs = await loadPeopleRefsAsDataUrls();
            const { text } = await analyze({
              data: { imageBase64: img, mode: "face", language: lang, peopleRefs: refs },
            });
            if (cancelled) return;
            // Same tracker as the dedicated Face mode: multi-frame verified,
            // announced once per person, silent while they stay in view.
            const obs = parseFaces(text).filter((o) => !/^unknown/i.test(o.name));
            for (const line of faceTracker.current.update(obs, lang)) {
              say(line, lang, "face");
            }
          }
        } catch {
          /* background recognition must never disrupt the active mode */
        } finally {
          faceBgBusy.current = false;
        }
      }
      if (!cancelled) faceBgTimer.current = setTimeout(tick, 3000);
    };

    faceBgTimer.current = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      if (faceBgTimer.current) clearTimeout(faceBgTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode, lang, people.length]);

  // ---- Voice-driven mode switching (no remount, camera keeps running) ----
  useEffect(() => {
    const onSetMode = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mode?: Mode; lang?: Lang; auto?: boolean };
      if (detail?.lang) setLang(detail.lang);
      if (!detail?.mode) return;
      setMode(detail.mode);
      lastSpoken.current = "";
      if (typeof detail.auto === "boolean") setAuto(detail.auto);
      setTimeout(() => run(detail.mode as Mode), 150);
    };
    const onStop = () => {
      setAuto(false);
      if (autoTimer.current) clearTimeout(autoTimer.current);
      stopSpeaking();
    };
    window.addEventListener("vision:setMode", onSetMode);
    window.addEventListener("vision:stopSpeech", onStop);
    return () => {
      window.removeEventListener("vision:setMode", onSetMode);
      window.removeEventListener("vision:stopSpeech", onStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <div className="text-sm font-semibold flex items-center gap-2">
          <CameraIcon className="size-4 text-primary-glow" /> Live Camera
        </div>
        <div className="flex gap-1">
          {(["en", "te", "hi"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${lang === l ? "bg-gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              aria-label={`Switch to ${LANG_LABEL[l]}`}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </header>

      <div className="relative flex-1 bg-black overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {!ready && !err && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <Loader2 className="size-6 animate-spin mr-2" /> Starting camera…
          </div>
        )}
        {err && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="glass-card rounded-2xl p-6 max-w-sm">
              <p className="text-sm mb-4">{err}</p>
              <Button onClick={() => startCamera(facing)} variant="secondary">
                <RefreshCw className="size-4" /> Retry
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="absolute left-3 right-3 bottom-3 glass-card rounded-2xl p-4 max-h-[38%] overflow-auto">
            <p className="text-xs text-primary-glow mb-1">AI · {MODES.find((m) => m.id === mode)?.label}</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{result}</p>
          </div>
        )}

        {mode === "face" && (
          <div className="absolute top-3 right-3 glass-card rounded-xl px-3 py-2 text-[10px] max-w-[55%]">
            <p className="text-primary-glow mb-1">Trusted contacts ({people.length})</p>
            <p className="text-muted-foreground leading-tight">{people.map((p) => p.name).join(" · ")}</p>
            <Link to="/people" search={{ lang } as any} className="text-primary-glow underline mt-1 inline-block">Manage people</Link>
          </div>
        )}

        {busy && (
          <div className="absolute top-3 left-3 glass-card rounded-full px-3 py-1.5 text-xs flex items-center gap-2">
            <Loader2 className="size-3 animate-spin" /> Analyzing…
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background/95 backdrop-blur">
        <div className="px-3 py-3 flex gap-2 overflow-x-auto">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); lastSpoken.current = ""; run(m.id); }}
                disabled={!ready || busy}
                className={`shrink-0 min-w-[86px] rounded-xl px-3 py-2 flex flex-col items-center gap-1 text-xs transition-all ${active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-foreground hover:bg-secondary/70"} disabled:opacity-50`}
              >
                <Icon className="size-4" />
                <span className="font-medium">{m.label}</span>
              </button>
            );
          })}
        </div>
        <div className="px-3 pb-4 flex items-center justify-between gap-2">
          <Button size="sm" variant="secondary" onClick={() => setFacing(facing === "environment" ? "user" : "environment")}>
            <RefreshCw className="size-4" /> Flip
          </Button>
          <Button size="lg" onClick={() => run(mode)} disabled={!ready || busy} className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CameraIcon className="size-4" />}
            Capture &amp; Speak
          </Button>
          <Button size="sm" variant={auto ? "default" : "secondary"} onClick={toggleAuto} disabled={!ready}>
            {auto ? <Square className="size-4" /> : <Play className="size-4" />}
            {auto ? "Stop" : "Live"}
          </Button>
        </div>
      </div>
    </div>
  );
}