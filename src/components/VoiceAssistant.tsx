import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { say, stopSpeaking, type SpeechPriority } from "@/lib/speech-manager";
import { routeCommand } from "@/lib/voice-router";
import { openMode, MODE_REGISTRY } from "@/lib/vision-modes";

type SRWindow = typeof window & {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
};

const WAKE_WORDS = [
  "hey vision", "hi vision", "hello vision",
  "హే విజన్", "విజన్",
  "हे विजन", "हैलो विजन", "विजन",
];

// Voice-only language switch phrases in all three languages.
const LANG_SWITCH: { lang: Lang; keys: string[] }[] = [
  { lang: "te", keys: ["telugu", "తెలుగు", "తెలుగులో", "तेलुगु", "speak telugu", "switch to telugu", "change language to telugu", "తెలుగులో మాట్లాడు", "తెలుగులో మాట్లాడండి"] },
  { lang: "hi", keys: ["hindi", "हिंदी", "हिन्दी", "हिंदी में", "हिन्दी में बात", "speak hindi", "switch to hindi", "change language to hindi", "हिंदी में बात करो"] },
  { lang: "en", keys: ["english", "इंग्लिश", "अंग्रेज़ी", "అంగ్లం", "ఇంగ్లీష్", "speak english", "switch to english", "change language to english"] },
];

// Detect language from Unicode script of the transcript.
function detectLang(text: string): Lang | null {
  if (/[\u0C00-\u0C7F]/.test(text)) return "te"; // Telugu
  if (/[\u0900-\u097F]/.test(text)) return "hi"; // Devanagari
  if (/[a-zA-Z]/.test(text)) return "en";
  return null;
}

type Lang = "en" | "te" | "hi";

type Command = {
  keys: string[];
  label: string;
  responses: Record<Lang, string>;
  langOverride?: Lang;
  route?: string;
  cameraMode?: string;
};

const COMMAND_ROUTES: Command[] = [
  { keys: ["open camera", "start camera", "live camera"], label: "Open Camera", route: "/camera",
    responses: { en: "Opening the live camera.", te: "లైవ్ కెమెరాను తెరుస్తున్నాను.", hi: "लाइव कैमरा खोल रहा हूँ।" } },
  { keys: ["object", "detect object", "what is this", "what's this", "identify"], label: "Object Detection", route: "/camera", cameraMode: "object",
    responses: { en: "Opening object detection. Point your camera at an object.", te: "వస్తువును గుర్తిస్తున్నాను. కెమెరాను వస్తువుపై ఉంచండి.", hi: "ऑब्जेक्ट डिटेक्शन खोल रहा हूँ। कैमरा वस्तु की ओर रखें।" } },
  { keys: ["scene", "surrounding", "describe", "around me", "where am i", "in front of me", "what's in front"], label: "Scene Understanding", route: "/camera", cameraMode: "scene",
    responses: { en: "Analyzing your surroundings now.", te: "మీ చుట్టూ ఉన్న దృశ్యాన్ని విశ్లేషిస్తున్నాను.", hi: "आपके आस-पास का दृश्य समझ रहा हूँ।" } },
  { keys: ["indoor", "navigate indoor", "inside", "room"], label: "Indoor Navigation", route: "/camera", cameraMode: "navigate",
    responses: { en: "Starting indoor navigation. Please choose a destination.", te: "లోపలి మార్గదర్శకాన్ని ప్రారంభిస్తున్నాను.", hi: "इनडोर नेविगेशन शुरू कर रहा हूँ।" } },
  { keys: ["outdoor", "map", "navigate outdoor", "directions", "walk"], label: "Outdoor Navigation", route: "/map",
    responses: { en: "Starting outdoor navigation.", te: "బయటి మార్గదర్శకాన్ని ప్రారంభిస్తున్నాను.", hi: "आउटडोर नेविगेशन शुरू कर रहा हूँ।" } },
  { keys: ["read", "ocr", "text", "book", "sign"], label: "Text Reader", route: "/camera", cameraMode: "read",
    responses: { en: "Reading text in front of you.", te: "మీ ముందున్న వచనాన్ని చదువుతున్నాను.", hi: "आपके सामने का पाठ पढ़ रहा हूँ।" } },
  { keys: ["money", "currency", "note", "rupee", "cash"], label: "Currency", route: "/camera", cameraMode: "currency",
    responses: { en: "Detecting currency notes.", te: "కరెన్సీ నోట్లను గుర్తిస్తున్నాను.", hi: "नोटों की पहचान कर रहा हूँ।" } },
  { keys: ["color", "colour", "shade"], label: "Color", route: "/camera", cameraMode: "color",
    responses: { en: "Identifying colors.", te: "రంగులను గుర్తిస్తున్నాను.", hi: "रंगों की पहचान कर रहा हूँ।" } },
  { keys: ["face", "friend", "who is", "recognize", "people"], label: "People", route: "/camera", cameraMode: "face",
    responses: { en: "Scanning for known faces.", te: "పరిచయమున్న ముఖాలను వెతుకుతున్నాను.", hi: "जानी-पहचानी शक्लें ढूँढ रहा हूँ।" } },
  { keys: ["hazard", "danger", "safe", "obstacle", "can i walk"], label: "Hazard Detection", route: "/camera", cameraMode: "hazard",
    responses: { en: "Checking for hazards around you.", te: "మీ చుట్టూ ప్రమాదాలను తనిఖీ చేస్తున్నాను.", hi: "आस-पास खतरों की जाँच कर रहा हूँ।" } },
  { keys: ["product", "barcode", "medicine", "label", "shopping", "price", "mrp", "expiry"], label: "Product", route: "/camera", cameraMode: "product",
    responses: { en: "Scanning the product label.", te: "ఉత్పత్తి లేబుల్‌ను స్కాన్ చేస్తున్నాను.", hi: "प्रोडक्ट लेबल स्कैन कर रहा हूँ।" } },
  { keys: ["document", "scan document", "page"], label: "Document Scan",
    responses: { en: "Scanning the document.", te: "పత్రాన్ని స్కాన్ చేస్తున్నాను.", hi: "दस्तावेज़ स्कैन कर रहा हूँ।" } },
  { keys: ["count"], label: "Count Objects",
    responses: { en: "Counting objects in view.", te: "కనిపిస్తున్న వస్తువులను లెక్కిస్తున్నాను.", hi: "दिख रही वस्तुएँ गिन रहा हूँ।" } },
  { keys: ["bus", "bus number", "platform", "board", "sign board"], label: "Bus Number", route: "/camera", cameraMode: "read",
    responses: { en: "Reading the bus route number.", te: "బస్సు నంబర్‌ను చదువుతున్నాను.", hi: "बस नंबर पढ़ रहा हूँ।" } },
  { keys: ["translate"], label: "Translate",
    responses: { en: "Translating the recognized text.", te: "గుర్తించిన వచనాన్ని అనువదిస్తున్నాను.", hi: "पहचाने गए पाठ का अनुवाद कर रहा हूँ।" } },
  { keys: ["remind", "reminder", "medicine at", "alarm"], label: "Reminder",
    responses: { en: "Reminder saved.", te: "గుర్తు చేయవలసినది భద్రపరచబడింది.", hi: "रिमाइंडर सहेजा गया।" } },
  { keys: ["add person", "new person", "manage people", "update face", "change face", "replace photo", "rename", "delete person", "search person", "face manager"], label: "Face Manager", route: "/people",
    responses: { en: "Opening the face manager. You can add, update, rename or delete people.", te: "ముఖ నిర్వహణను తెరుస్తున్నాను. వ్యక్తులను జోడించవచ్చు, మార్చవచ్చు, తొలగించవచ్చు.", hi: "फेस मैनेजर खोल रहा हूँ। आप लोग जोड़, बदल या हटा सकते हैं।" } },
  { keys: ["emergency contact", "add contact", "contacts"], label: "Emergency Contacts", route: "/emergency",
    responses: { en: "Opening emergency contacts.", te: "అత్యవసర పరిచయాలను తెరుస్తున్నాను.", hi: "आपातकालीन संपर्क खोल रहा हूँ।" } },
  { keys: ["dashboard", "open dashboard", "home"], label: "Dashboard", route: "/dashboard",
    responses: { en: "Opening the dashboard.", te: "డాష్‌బోర్డును తెరుస్తున్నాను.", hi: "डैशबोर्ड खोल रहा हूँ।" } },
  { keys: ["emergency", "sos", "help me", "call for help", "अत्यावश्यक", "अत्यवसरं"], label: "Emergency", route: "/emergency",
    responses: { en: "Sending emergency alert to your caregiver with your live location.", te: "మీ సంరక్షకునికి అత్యవసర హెచ్చరిక పంపుతున్నాను.", hi: "आपके देखभालकर्ता को आपातकालीन अलर्ट भेज रहा हूँ।" } },
  { keys: ["stop", "quiet", "silence", "mute"], label: "Stop",
    responses: { en: "Stopping.", te: "ఆగుతున్నాను.", hi: "रुक रहा हूँ।" } },
  { keys: ["stop navigation", "cancel navigation", "end navigation", "మార్గం ఆపు", "नेविगेशन बंद"], label: "Stop Navigation",
    responses: { en: "Stopping navigation.", te: "మార్గదర్శకాన్ని ఆపుతున్నాను.", hi: "नेविगेशन बंद कर रहा हूँ।" } },
  { keys: ["repeat", "again", "say again"], label: "Repeat",
    responses: { en: "Repeating the last response.", te: "చివరి సమాధానాన్ని మళ్లీ చెబుతున్నాను.", hi: "पिछला उत्तर दोहरा रहा हूँ।" } },
  { keys: ["battery", "status"], label: "Status",
    responses: { en: "All systems online. Battery at eighty two percent.", te: "అన్ని వ్యవస్థలు సిద్ధంగా ఉన్నాయి. బ్యాటరీ 82 శాతం.", hi: "सभी सिस्टम ऑनलाइन। बैटरी 82 प्रतिशत।" } },
  { keys: ["telugu"], label: "Language: Telugu", langOverride: "te",
    responses: { en: "Switching to Telugu.", te: "తెలుగుకి మారుస్తున్నాను.", hi: "तेलुगु में बदल रहा हूँ।" } },
  { keys: ["hindi"], label: "Language: Hindi", langOverride: "hi",
    responses: { en: "Switching to Hindi.", te: "హిందీకి మారుస్తున్నాను.", hi: "हिंदी में बदल रहा हूँ।" } },
  { keys: ["english"], label: "Language: English", langOverride: "en",
    responses: { en: "Switching to English.", te: "ఇంగ్లీషుకి మారుస్తున్నాను.", hi: "अंग्रेज़ी में बदल रहा हूँ।" } },
];

const LANG_TAG: Record<Lang, string> = { en: "en-US", te: "te-IN", hi: "hi-IN" };
const LANG_LABEL: Record<Lang, string> = { en: "English", te: "తెలుగు", hi: "हिन्दी" };
const GREETING: Record<Lang, string> = {
  en: "Hello. I am Vision Companion. How can I help you today?",
  te: "నమస్తే. నేను విజన్ కంపానియన్. మీకు ఎలా సహాయపడగలను?",
  hi: "नमस्ते। मैं विजन कंपेनियन हूँ। मैं आपकी कैसे मदद कर सकता हूँ?",
};

// All assistant speech goes through the central Speech Manager so no two
// modules can ever talk over each other.
function speak(text: string, lang: Lang = "en", priority: SpeechPriority = "general") {
  say(text, lang, priority, { force: true });
}

const LISTENING_PROMPT: Record<Lang, string> = {
  en: "I'm listening.",
  te: "నేను వింటున్నాను.",
  hi: "मैं सुन रहा हूँ।",
};

export function VoiceAssistant() {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [awake, setAwake] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const langRef = useRef<Lang>("en");
  const recRef = useRef<any>(null);
  const awakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Warm up voices list (browsers load asynchronously).
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.getVoices();
    }
    const w = window as SRWindow;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = LANG_TAG[lang];
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      const raw = text.trim();
      const lower = raw.toLowerCase();
      setTranscript(lower);
      // Auto-detect language from the user's own script so replies match.
      const detected = detectLang(raw) ?? lang;
      if (detected !== langRef.current) {
        langRef.current = detected;
        setLang(detected);
      }
      if (!awake && WAKE_WORDS.some((w) => lower.includes(w))) {
        setAwake(true);
        setOpen(true);
        speak(LISTENING_PROMPT[detected], detected);
        setLastAction("Awake — listening for a command");
        if (awakeTimer.current) clearTimeout(awakeTimer.current);
        // Stay awake until a command completes; only a long silence ends it.
        awakeTimer.current = setTimeout(() => setAwake(false), 45000);
        return;
      }
      // Keep the session alive while the user is still speaking.
      if (awake && awakeTimer.current) {
        clearTimeout(awakeTimer.current);
        awakeTimer.current = setTimeout(() => setAwake(false), 45000);
      }
      if (awake && e.results[e.results.length - 1].isFinal) {
        // ---- Centralized VoiceCommandRouter: natural phrasing → real action.
        const intent = routeCommand(raw);
        if (intent) {
          if (intent.type === "STOP") {
            stopSpeaking();
            window.dispatchEvent(new CustomEvent("vision:stopSpeech"));
            setLastAction("Stopped speaking");
            return;
          }
          if (intent.type === "STOP_NAV") {
            window.dispatchEvent(new CustomEvent("vision:stopNav"));
            setLastAction("Navigation stopped");
            setAwake(false);
            return;
          }
          if (intent.type === "REPEAT") {
            window.dispatchEvent(new CustomEvent("vision:repeatNav"));
            setLastAction("Repeating");
            setAwake(false);
            return;
          }
          if (intent.type === "NAVIGATE_TO") {
            const msgs: Record<Lang, string> = {
              en: `Opening walking directions to ${intent.destination}.`,
              te: `${intent.destination} కు నడక మార్గదర్శకాన్ని తెరుస్తున్నాను.`,
              hi: `${intent.destination} तक पैदल दिशा-निर्देश खोल रहा हूँ।`,
            };
            speak(msgs[detected], detected);
            setLastAction(`Navigate → ${intent.destination}`);
            navigate({ to: "/map" as any, search: { dest: intent.destination, lang: detected, auto: true } as any }).catch(() => {});
            setAwake(false);
            return;
          }
          if (intent.type === "MODE") {
            // Exactly the same call the UI cards make — one Mode Manager.
            openMode(intent.mode, {
              lang: detected,
              navigate: (o) => navigate({ to: o.to as any, search: o.search as any }),
            });
            setLastAction(`${intent.mode} — ${MODE_REGISTRY[intent.mode].say[detected]}`);
            setAwake(false);
            return;
          }
        }
        // Language switch by voice — accept in any of the three languages.
        const swap = LANG_SWITCH.find((s) => s.keys.some((k) => lower.includes(k.toLowerCase())));
        if (swap) {
          langRef.current = swap.lang;
          setLang(swap.lang);
          const msg: Record<Lang, string> = {
            en: `Switched to ${LANG_LABEL[swap.lang]}.`,
            te: `${LANG_LABEL[swap.lang]}కి మారాను.`,
            hi: `${LANG_LABEL[swap.lang]} में बदल गया।`,
          };
          speak(msg[swap.lang], swap.lang);
          setLastAction(`Language → ${LANG_LABEL[swap.lang]}`);
          setAwake(false);
          return;
        }
        // "navigate to X" / "take me to X" / "directions to X" → open Google Maps directions
        const destMatch = raw.match(/(?:navigate|take me|go|directions|guide me|తీసుకెళ్|తీసుకెళ్లు|ले चलो|ले जाओ)\s*(?:to\s+|కి\s+|కు\s+)?(.+)$/i);
        if (destMatch?.[1]) {
          const dest = destMatch[1].replace(/[.?!,]+$/, "").trim();
          const msgs: Record<Lang, string> = {
            en: `Opening walking directions to ${dest}.`,
            te: `${dest} కు నడక మార్గదర్శకాన్ని తెరుస్తున్నాను.`,
            hi: `${dest} तक पैदल दिशा-निर्देश खोल रहा हूँ।`,
          };
          speak(msgs[detected], detected);
          setLastAction(`Navigate → ${dest}`);
          navigate({ to: "/map" as any, search: { dest, lang: detected, auto: true } as any }).catch(() => {});
          setAwake(false);
          return;
        }
        if (/(stop|quiet|silence|mute|ఆపు|चुप|बंद करो)/i.test(lower)) {
          stopSpeaking();
          window.dispatchEvent(new CustomEvent("vision:stopSpeech"));
          setLastAction("Stopped speaking");
          return;
        }
        const match = COMMAND_ROUTES.find((c) => c.keys.some((k) => lower.includes(k)));
        if (match) {
          const nextLang = match.langOverride ?? detected;
          const msg = match.responses[nextLang];
          speak(msg, nextLang, match.label === "Emergency" ? "emergency" : "general");
          if (match.langOverride) { setLang(match.langOverride); langRef.current = match.langOverride; }
          if (match.label === "Stop Navigation") {
            window.dispatchEvent(new CustomEvent("vision:stopNav"));
          } else if (match.label === "Repeat") {
            window.dispatchEvent(new CustomEvent("vision:repeatNav"));
          }
          if (match.route) {
            const autoModes = new Set(["object", "scene", "face", "navigate", "safety"]);
            // Already on the camera page? Switch modes in place so the shared
            // camera stream and background models are never torn down.
            if (match.route === "/camera" && window.location.pathname === "/camera") {
              window.dispatchEvent(new CustomEvent("vision:setMode", {
                detail: { mode: match.cameraMode ?? "scene", lang: nextLang, auto: autoModes.has(match.cameraMode ?? "") },
              }));
              setLastAction(`${match.label} — ${msg}`);
              return;
            }
            navigate({
              to: match.route as any,
              search: match.cameraMode
                ? ({ mode: match.cameraMode, lang: nextLang, auto: autoModes.has(match.cameraMode) ? "1" : undefined } as any)
                : match.label === "Emergency"
                  ? ({ lang: nextLang, auto: "1" } as any)
                  : ({ lang: nextLang } as any),
            }).catch(() => {});
          }
          setLastAction(`${match.label} — ${msg}`);
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
  }, [awake, lang]);

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
                <p className="text-[10px] text-primary-glow mt-0.5">Language · {LANG_LABEL[lang]}</p>
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
            <div className="flex gap-1">
              {(["en", "te", "hi"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => { setLang(l); langRef.current = l; speak(GREETING[l], l); }}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium ${lang === l ? "bg-gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                >
                  {LANG_LABEL[l]}
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => { speak("Available commands: object detection, scene understanding, indoor navigation, outdoor navigation, read text, currency, color, face, hazard, and emergency."); }}>
              Help
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { stopSpeaking(); window.dispatchEvent(new CustomEvent("vision:stopSpeech")); }}>Stop</Button>
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