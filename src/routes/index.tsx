import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Eye, Mic, Camera, MapPin, ScanText, Coins, Palette, Users,
  ShieldAlert, Languages, Brain, Navigation, Package, Siren,
  Bus, PhoneCall, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vision Companion — Your AI Eyes, Everywhere" },
      { name: "description", content: "Voice-first AI visual assistant for the visually impaired. Say Hey Vision to detect objects, read text, find money, describe scenes and detect hazards." },
    ],
  }),
  component: Index,
});

type Lang = "en" | "te" | "hi";

const COPY: Record<Lang, {
  wake: string; hero: string; sub: string; startCam: string; modes: string;
  hint: string; camHint: string; sayHey: string;
}> = {
  en: {
    wake: 'Say "Hey Vision" to begin.',
    hero: "Your AI eyes. Everywhere.",
    sub: 'Say something like: what is this, read text, find money, describe scene, detect hazard.',
    startCam: "Start Camera",
    modes: "AI Modes",
    hint: "Tap a mode or say a command",
    camHint: "Allow camera to enable live AI analysis of objects, text, currency and surroundings.",
    sayHey: 'Say "Hey Vision"',
  },
  te: {
    wake: '"హే విజన్" అని చెప్పి ప్రారంభించండి.',
    hero: "మీ AI కళ్ళు. ఎక్కడైనా.",
    sub: "ఇలా చెప్పండి: ఇది ఏమిటి, వచనం చదువు, డబ్బు కనుగొను, దృశ్యం వివరించు, ప్రమాదం గుర్తించు.",
    startCam: "కెమెరా ప్రారంభించు",
    modes: "AI మోడ్‌లు",
    hint: "మోడ్‌ను తాకండి లేదా ఆజ్ఞ చెప్పండి",
    camHint: "వస్తువులు, వచనం, డబ్బు, పరిసరాల ప్రత్యక్ష AI విశ్లేషణకు కెమెరాను అనుమతించండి.",
    sayHey: '"హే విజన్" అని చెప్పండి',
  },
  hi: {
    wake: '"हे विज़न" कहकर शुरू करें।',
    hero: "आपकी AI आँखें। हर जगह।",
    sub: "ऐसा कहें: यह क्या है, पाठ पढ़ो, पैसे ढूँढो, दृश्य बताओ, खतरा पहचानो।",
    startCam: "कैमरा शुरू करें",
    modes: "AI मोड",
    hint: "मोड चुनें या आवाज़ से आदेश दें",
    camHint: "वस्तुओं, पाठ, मुद्रा और परिवेश के लाइव AI विश्लेषण के लिए कैमरे की अनुमति दें।",
    sayHey: '"हे विज़न" कहें',
  },
};

const LANG_LABEL: Record<Lang, string> = { en: "English", te: "తెలుగు", hi: "हिन्दी" };

type ModeDef = { id: string; icon: any; label: Record<Lang, string>; to: string; search?: Record<string, string> };

const MODES: ModeDef[] = [
  { id: "object",   icon: Package,      label: { en: "Object Detection", te: "వస్తువుల గుర్తింపు", hi: "वस्तु पहचान" },     to: "/camera", search: { mode: "object", auto: "1" } },
  { id: "scene",    icon: Eye,          label: { en: "Scene Understand", te: "దృశ్య అవగాహన",     hi: "दृश्य समझ" },       to: "/camera", search: { mode: "scene", auto: "1" } },
  { id: "read",     icon: ScanText,     label: { en: "Read Text",        te: "వచనం చదువు",       hi: "पाठ पढ़ें" },        to: "/camera", search: { mode: "read" } },
  { id: "currency", icon: Coins,        label: { en: "Currency",         te: "కరెన్సీ",           hi: "मुद्रा" },          to: "/camera", search: { mode: "currency" } },
  { id: "product",  icon: Package,      label: { en: "Product & Price",  te: "ఉత్పత్తి & ధర",     hi: "उत्पाद और मूल्य" },  to: "/camera", search: { mode: "product" } },
  { id: "color",    icon: Palette,      label: { en: "Color Detect",     te: "రంగు గుర్తింపు",    hi: "रंग पहचान" },      to: "/camera", search: { mode: "color" } },
  { id: "face",     icon: Users,        label: { en: "Face Recognize",   te: "ముఖ గుర్తింపు",     hi: "चेहरा पहचान" },     to: "/camera", search: { mode: "face", auto: "1" } },
  { id: "hazard",   icon: ShieldAlert,  label: { en: "Hazard Alert",     te: "ప్రమాద హెచ్చరిక",   hi: "खतरा चेतावनी" },   to: "/camera", search: { mode: "safety", auto: "1" } },
  { id: "indoor",   icon: Navigation,   label: { en: "Indoor Nav",       te: "లోపలి మార్గం",     hi: "इनडोर मार्ग" },     to: "/camera", search: { mode: "navigate", auto: "1" } },
  { id: "outdoor",  icon: MapPin,       label: { en: "Outdoor Nav",      te: "బాహ్య మార్గం",     hi: "बाहरी मार्ग" },     to: "/map" },
  { id: "sign",     icon: Bus,          label: { en: "Sign & Bus Board", te: "సైన్ & బస్ బోర్డ్",  hi: "साइन और बस बोर्ड" }, to: "/camera", search: { mode: "read" } },
  { id: "people",   icon: Users,        label: { en: "Manage People",    te: "వ్యక్తుల నిర్వహణ",  hi: "लोग प्रबंधित करें" }, to: "/people" },
  { id: "sos",      icon: PhoneCall,    label: { en: "Emergency",        te: "అత్యవసరం",         hi: "आपातकाल" },        to: "/emergency" },
];

function Index() {
  const [lang, setLang] = useState<Lang>("en");
  const [camOn, setCamOn] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const t = COPY[lang];

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
  }, []);

  const startCamera = async () => {
    setCamErr(null); setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamOn(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 30);
    } catch (e: any) {
      setCamErr(e?.message ?? "Camera permission denied.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b-2 border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-12 shrink-0 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
              <Eye className="size-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-lg leading-tight truncate">Vision Companion</div>
              <div className="text-sm text-muted-foreground truncate">{t.wake}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(["en", "te", "hi"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                aria-label={`Switch language to ${LANG_LABEL[l]}`}
                className={`min-h-11 px-4 rounded-full text-sm font-semibold border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${lang === l ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow" : "bg-secondary text-foreground border-border hover:bg-secondary/80"}`}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Hero */}
        <section aria-labelledby="hero-title" className="glass-card rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute inset-0 -z-10 opacity-70" style={{ background: "var(--gradient-glow)" }} />
          <h1 id="hero-title" className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.02] mb-4">
            {t.hero}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed mb-6">
            {t.sub}
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-secondary/60 px-4 py-2 text-sm font-medium">
            <span className="size-2 rounded-full bg-success animate-pulse" />
            {t.sayHey}
          </div>
        </section>

        {/* Camera preview */}
        <section aria-labelledby="cam-title" className="rounded-3xl border-2 border-border bg-black relative overflow-hidden aspect-video max-h-[560px]">
          <h2 id="cam-title" className="sr-only">Live camera preview</h2>
          {camOn ? (
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div className="flex flex-col items-center gap-4 max-w-md">
                <Camera className="size-14 text-muted-foreground/70" aria-hidden />
                <Button
                  onClick={startCamera}
                  disabled={starting}
                  size="lg"
                  className="min-h-14 px-8 text-lg font-bold rounded-full bg-gradient-primary text-primary-foreground shadow-glow focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {starting ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
                  {t.startCam}
                </Button>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {camErr ? camErr : t.camHint}
                </p>
              </div>
            </div>
          )}
          {camOn && (
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-background/80 backdrop-blur px-3 py-1.5 text-xs font-semibold">
              <span className="size-2 rounded-full bg-destructive animate-pulse" /> LIVE
            </div>
          )}
          {camOn && (
            <div className="absolute bottom-3 right-3">
              <Link to="/camera" search={{ mode: undefined, lang, auto: false } as any}>
                <Button size="lg" className="min-h-12 rounded-full bg-gradient-primary text-primary-foreground shadow-glow font-bold">
                  Open Full Camera
                </Button>
              </Link>
            </div>
          )}
        </section>

        {/* AI Modes */}
        <section aria-labelledby="modes-title">
          <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
            <h2 id="modes-title" className="text-2xl md:text-3xl font-bold">{t.modes}</h2>
            <p className="text-sm md:text-base text-muted-foreground">{t.hint}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.id}
                  to={m.to}
                  search={{ ...(m.search ?? {}), lang } as any}
                  className="group glass-card rounded-2xl p-5 md:p-6 min-h-[132px] flex flex-col justify-between border-2 border-border hover:border-primary hover:shadow-glow transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="size-12 rounded-2xl bg-gradient-primary grid place-items-center group-hover:scale-110 transition-transform">
                    <Icon className="size-6 text-primary-foreground" aria-hidden />
                  </div>
                  <div className="mt-4 font-bold text-base md:text-lg leading-tight">
                    {m.label[lang]}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="pt-6 pb-24 text-center text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <Mic className="size-4" aria-hidden /> Voice assistant is always listening — say &ldquo;Hey Vision&rdquo;.
          </div>
        </footer>
      </main>
    </div>
  );
}
