import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type SRWindow = typeof window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

const WAKE_WORDS = ["hey vision", "hi vision", "hello vision"];

const COMMAND_ROUTES: { keys: string[]; label: string; response: string }[] = [
  { keys: ["object", "detect object"], label: "Object Detection", response: "Opening object detection. Point your camera at an object." },
  { keys: ["scene", "surrounding"], label: "Scene Understanding", response: "Analyzing your surroundings now." },
  { keys: ["indoor", "navigate indoor"], label: "Indoor Navigation", response: "Starting indoor navigation. Please choose a destination." },
  { keys: ["outdoor", "map", "navigate outdoor"], label: "Outdoor Navigation", response: "Starting outdoor navigation." },
  { keys: ["read", "ocr", "text"], label: "Text Reader", response: "Reading text in front of you." },
  { keys: ["money", "currency", "note"], label: "Currency", response: "Detecting currency notes." },
  { keys: ["color"], label: "Color", response: "Identifying colors." },
  { keys: ["face", "friend", "who"], label: "Face Recognition", response: "Scanning for known faces." },
  { keys: ["hazard", "danger", "safe"], label: "Hazard Detection", response: "Checking for hazards around you." },
  { keys: ["emergency", "sos", "help"], label: "Emergency", response: "Sending emergency alert to your caregiver." },
  { keys: ["stop", "quiet"], label: "Stop", response: "Stopping." },
  { keys: ["repeat"], label: "Repeat", response: "Repeating the last response." },
  { keys: ["telugu"], label: "Language: Telugu", response: "Switching to Telugu." },
  { keys: ["hindi"], label: "Language: Hindi", response: "Switching to Hindi." },
  { keys: ["english"], label: "Language: English", response: "Switching to English." },
];

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  u.pitch = 1;
  window.speechSynthesis.speak(u);
}

export function VoiceAssistant() {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [awake, setAwake] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const recRef = useRef<any>(null);
  const awakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const w = window as SRWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      const lower = text.toLowerCase().trim();
      setTranscript(lower);
      if (!awake && WAKE_WORDS.some((w) => lower.includes(w))) {
        setAwake(true);
        setOpen(true);
        speak("Hello. I am Vision Companion. How can I help you today?");
        setLastAction("Awake — listening for a command");
        if (awakeTimer.current) clearTimeout(awakeTimer.current);
        awakeTimer.current = setTimeout(() => setAwake(false), 15000);
        return;
      }
      if (awake && e.results[e.results.length - 1].isFinal) {
        const match = COMMAND_ROUTES.find((c) => c.keys.some((k) => lower.includes(k)));
        if (match) {
          speak(match.response);
          setLastAction(`${match.label} — ${match.response}`);
          setAwake(false);
        }
      }
    };
    rec.onend = () => {
      if (recRef.current?._on) {
        try { rec.start(); } catch {}
      } else {
        setListening(false);
      }
    };
    rec.onerror = () => {};
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, [awake]);

  const toggle = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec._on = false;
      try { rec.stop(); } catch {}
      setListening(false);
    } else {
      rec._on = true;
      try { rec.start(); setListening(true); setOpen(true); } catch {}
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-28 right-6 z-50 w-[340px] glass-card rounded-2xl p-4 shadow-elegant animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-gradient-primary flex items-center justify-center">
                <Sparkles className="size-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Vision Companion</p>
                <p className="text-xs text-muted-foreground">
                  {!supported ? "Voice not supported in this browser" : awake ? "Listening for command…" : listening ? "Say “Hey Vision”" : "Idle"}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          {listening && (
            <div className="flex items-end gap-1 h-10 mb-3">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full bg-gradient-primary animate-wave origin-bottom"
                  style={{ height: "100%", animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
          )}
          {transcript && (
            <p className="text-xs text-muted-foreground italic mb-2 line-clamp-2">“{transcript}”</p>
          )}
          {lastAction && (
            <div className="rounded-lg bg-secondary/60 p-2 text-xs">
              <span className="text-primary-glow">AI:</span> {lastAction}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => { speak("Available commands: object detection, scene understanding, indoor navigation, outdoor navigation, read text, currency, color, face, hazard, and emergency."); }}>
              Help
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.speechSynthesis?.cancel()}>Stop</Button>
          </div>
        </div>
      )}
      <button
        onClick={toggle}
        aria-label={listening ? "Stop listening" : "Start voice assistant"}
        className="fixed bottom-6 right-6 z-50 size-16 rounded-full bg-gradient-primary shadow-glow flex items-center justify-center text-primary-foreground hover:scale-105 transition-transform"
      >
        {listening && <span className="absolute inset-0 rounded-full bg-primary/40 animate-pulse-ring" />}
        {listening ? <Mic className="size-6 relative" /> : <MicOff className="size-6 relative" />}
      </button>
    </>
  );
}