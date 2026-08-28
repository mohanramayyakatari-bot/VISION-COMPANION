import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MODE_REGISTRY, type VisionMode } from "@/lib/vision-modes";
import { getSessionUser, isGuest, loadProfile } from "@/lib/session";
import { useT, type Lang } from "@/lib/i18n";

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

// Every card resolves through the shared VisionModeManager registry, so a tap
// and the matching voice command open exactly the same mode with the same
// services started. Labels come from the central i18n dictionary.
type ModeDef = { id: VisionMode; icon: any; labelKey: string };

const MODES: ModeDef[] = [
  { id: "OBJECT_DETECTION",   icon: Package,     labelKey: "modes.objectDetection" },
  { id: "SCENE_UNDERSTANDING", icon: Eye,        labelKey: "modes.sceneUnderstanding" },
  { id: "OCR",                icon: ScanText,    labelKey: "modes.ocr" },
  { id: "CURRENCY",           icon: Coins,       labelKey: "modes.currency" },
  { id: "PRODUCT",            icon: Package,     labelKey: "modes.product" },
  { id: "COLOR",              icon: Palette,     labelKey: "modes.color" },
  { id: "FACE",               icon: Users,       labelKey: "modes.face" },
  { id: "HAZARD",             icon: ShieldAlert, labelKey: "modes.hazard" },
  { id: "INDOOR_NAVIGATION",  icon: Navigation,  labelKey: "modes.indoorNav" },
  { id: "OUTDOOR_NAVIGATION", icon: MapPin,      labelKey: "modes.outdoorNav" },
  { id: "SIGN_BUS",           icon: Bus,         labelKey: "modes.signBus" },
  { id: "PEOPLE_MANAGER",     icon: Users,       labelKey: "modes.peopleManager" },
  { id: "EMERGENCY",          icon: PhoneCall,   labelKey: "modes.emergency" },
];

function Index() {
  const navigate = useNavigate();
  const { t, lang, setLang, langLabel } = useT();
  const [camOn, setCamOn] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);


  // Welcome gate: first visit (no account, no guest choice) goes to /auth.
  useEffect(() => {
    let cancelled = false;
    getSessionUser().then((u) => {
      if (cancelled) return;
      if (u) { loadProfile(); return; }
      if (!isGuest()) navigate({ to: "/auth" });
    });
    return () => { cancelled = true; };
  }, [navigate]);

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
              <div className="font-bold text-lg leading-tight truncate">{t("common.appName")}</div>
              <div className="text-sm text-muted-foreground truncate">{t("home.wake")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(["en", "te", "hi"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                aria-label={t("home.switchLang", { name: langLabel[l] })}
                className={`min-h-11 px-4 rounded-full text-sm font-semibold border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${lang === l ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow" : "bg-secondary text-foreground border-border hover:bg-secondary/80"}`}
              >
                {langLabel[l]}
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
            {t("home.hero")}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed mb-6">
            {t("home.sub")}
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-secondary/60 px-4 py-2 text-sm font-medium">
            <span className="size-2 rounded-full bg-success animate-pulse" />
            {t("home.sayHey")}
          </div>
        </section>

        {/* Camera preview */}
        <section aria-labelledby="cam-title" className="rounded-3xl border-2 border-border bg-black relative overflow-hidden aspect-video max-h-[560px]">
          <h2 id="cam-title" className="sr-only">{t("home.cameraPreview")}</h2>
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
                  {t("home.startCam")}
                </Button>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {camErr ? camErr : t("home.camHint")}
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
                  {t("home.openFullCamera")}
                </Button>
              </Link>
            </div>
          )}
        </section>

        {/* AI Modes */}
        <section aria-labelledby="modes-title">
          <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
            <h2 id="modes-title" className="text-2xl md:text-3xl font-bold">{t("home.modes")}</h2>
            <p className="text-sm md:text-base text-muted-foreground">{t("home.hint")}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {MODES.map((m) => {
              const Icon = m.icon;
              const def = MODE_REGISTRY[m.id];
              const search: Record<string, unknown> = { lang };
              if (def.cameraMode) search.mode = def.cameraMode;
              if (def.auto) search.auto = "1";
              return (
                <Link
                  key={m.id}
                  to={def.route}
                  search={search as any}
                  className="group glass-card rounded-2xl p-5 md:p-6 min-h-[132px] flex flex-col justify-between border-2 border-border hover:border-primary hover:shadow-glow transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="size-12 rounded-2xl bg-gradient-primary grid place-items-center group-hover:scale-110 transition-transform">
                    <Icon className="size-6 text-primary-foreground" aria-hidden />
                  </div>
                  <div className="mt-4 font-bold text-base md:text-lg leading-tight">
                    {t(m.labelKey)}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <footer className="pt-6 pb-24 text-center text-sm text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <Mic className="size-4" aria-hidden /> {t("home.footer")}
          </div>
        </footer>
      </main>
    </div>
  );
}
