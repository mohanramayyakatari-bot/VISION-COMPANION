import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MODE_REGISTRY, type VisionMode } from "@/lib/vision-modes";
import { getSessionUser, isGuest, loadProfile } from "@/lib/session";
import { useT, type Lang } from "@/lib/i18n";
import { stopActiveMode } from "@/lib/mode-lifecycle";


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

  // Returning to the homepage stops every mode: camera loops, navigation,
  // background watches, timers and any speech still playing.
  useEffect(() => {
    stopActiveMode("home");
  }, []);

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

  const modeSearch = (id: VisionMode) => {
    const def = MODE_REGISTRY[id];
    const search: Record<string, unknown> = { lang };
    if (def.cameraMode) search.mode = def.cameraMode;
    if (def.auto) search.auto = "1";
    return search;
  };

  return (
    <div className="min-h-dvh">
      <SpatialBackdrop />

      {/* Top bar */}
      <header className="sticky top-0 z-30 glass-sheet">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <VisionLens size={36} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold leading-tight">{t("common.appName")}</div>
              <div className="truncate text-[0.7rem] text-muted-foreground">{t("home.tagline")}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {(["en", "te", "hi"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                aria-label={t("home.switchLang", { name: langLabel[l] })}
                className={`min-h-10 rounded-full px-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring ${lang === l ? "bg-gradient-primary text-primary-foreground edge-glow" : "glass-panel text-muted-foreground"}`}
              >
                {langLabel[l]}
              </button>
            ))}
            <Link
              to="/settings"
              search={{ lang } as any}
              aria-label={t("common.settings")}
              className="grid size-10 place-items-center rounded-full glass-panel"
            >
              <Settings className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-5 pb-nav space-y-6">
        {/* Hero */}
        <section aria-labelledby="hero-title" className="animate-rise">
          <h1 id="hero-title" className="text-[2.6rem] font-black leading-[1.03] tracking-tight">
            {t("home.hero")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("home.sub")}</p>

          <div className="mt-5 space-y-3">
            {!camOn && (
              <GlassButton
                tone="primary"
                onClick={startCamera}
                disabled={starting}
                className="w-full min-h-16 text-lg"
              >
                {starting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
                {t("home.startCam")}
              </GlassButton>
            )}
            <GlassPill className="w-full justify-center py-3 text-sm">
              <span className="size-2 rounded-full bg-success animate-pulse" aria-hidden />
              {t("home.sayHey")}
            </GlassPill>
          </div>
        </section>

        {/* Live camera */}
        {camOn && (
          <section
            aria-labelledby="cam-title"
            className="relative aspect-[3/4] overflow-hidden rounded-[1.75rem] border border-border bg-black"
          >
            <h2 id="cam-title" className="sr-only">{t("home.cameraPreview")}</h2>
            <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
            <div className="absolute left-3 top-3">
              <GlassPill>
                <span className="size-2 rounded-full bg-destructive animate-pulse" aria-hidden /> {t("common.live")}
              </GlassPill>
            </div>
            <div className="absolute inset-x-3 bottom-3">
              <Link to="/camera" search={{ mode: undefined, lang, auto: false } as any} className="block">
                <GlassButton tone="primary" className="w-full">{t("home.openFullCamera")}</GlassButton>
              </Link>
            </div>
          </section>
        )}
        {camErr && <p className="text-sm text-destructive" role="alert">{camErr}</p>}

        {/* AI modes */}
        <section aria-labelledby="modes-title">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="modes-title" className="text-lg font-bold">{t("home.modes")}</h2>
            <p className="truncate text-xs text-muted-foreground">{t("home.hint")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.id}
                  to={MODE_REGISTRY[m.id].route}
                  search={modeSearch(m.id) as any}
                  className="glass-panel group flex min-h-[5.5rem] flex-col justify-between rounded-2xl p-3.5 transition-transform active:scale-[0.98] hover:edge-glow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-gradient-primary">
                    <Icon className="size-4.5 text-primary-foreground" aria-hidden />
                  </span>
                  <span className="mt-2 text-sm font-semibold leading-tight">{t(m.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Emergency — visually separated from the normal modes */}
        <section aria-labelledby="sos-title">
          <Link
            to="/emergency"
            search={{ lang } as any}
            className="flex items-center gap-3 rounded-[1.75rem] border border-destructive/50 bg-destructive/10 p-4 backdrop-blur-xl transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-destructive">
              <Siren className="size-6 text-destructive-foreground" aria-hidden />
            </span>
            <span className="min-w-0">
              <span id="sos-title" className="block font-bold">{t("home.emergencyTitle")}</span>
              <span className="block text-xs text-muted-foreground">{t("home.emergencySub")}</span>
            </span>
          </Link>
        </section>

        <p className="flex items-center justify-center gap-2 pt-2 text-center text-xs text-muted-foreground">
          <Mic className="size-3.5" aria-hidden /> {t("home.footer")}
        </p>
      </main>
    </div>
  );
}

