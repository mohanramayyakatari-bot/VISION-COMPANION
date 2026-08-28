import { tr } from "@/lib/i18n";
import { getLang } from "@/lib/language";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { say } from "@/lib/speech-manager";
import { toast } from "sonner";
import {
  Eye, Camera, Mic, MapPin, Brain, ScanText, Coins, Palette, Users,
  ShieldAlert, Bell, Volume2, Navigation, Languages, Battery, Wifi,
  Sparkles, ArrowLeft, PlayCircle,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Vision Companion" },
      { name: "description", content: "Voice-controlled AI dashboard with object detection, scene understanding, OCR, navigation and safety modes." },
    ],
  }),
  component: Dashboard,
});

type Mode = {
  id: string;
  icon: any;
  title: string;
  desc: string;
  demo: { label: string; confidence: number }[];
  explain: string;
  voice: string;
};

const MODES: Mode[] = [
  { id: "object", icon: Eye, title: "Object Detection", desc: "YOLOv11 detects and localises objects in real time.",
    demo: [{ label: "Bicycle", confidence: 94 }, { label: "Plant", confidence: 88 }, { label: "Wall", confidence: 76 }],
    explain: "I detected a bicycle because it has two circular wheels, a triangular frame and handlebars — 94% confidence.",
    voice: "A bicycle is on your left, about two meters away. The path is clear." },
  { id: "scene", icon: Brain, title: "Scene Understanding", desc: "LLaVA describes environments and context.",
    demo: [{ label: "Outdoor walkway", confidence: 92 }, { label: "Daylight", confidence: 98 }, { label: "Low traffic", confidence: 85 }],
    explain: "This looks like an outdoor walkway. I can see plants on both sides, a parked bicycle and a building ahead.",
    voice: "You are on an outdoor walkway. Path is safe, turn right in 20 meters." },
  { id: "indoor", icon: Navigation, title: "Indoor Navigation", desc: "ORB-SLAM3 turn-by-turn indoor guidance.",
    demo: [{ label: "Library — 18 m", confidence: 100 }, { label: "Turn right in 6 m", confidence: 96 }],
    explain: "Route computed using visual SLAM landmarks. No obstacles detected on the current corridor.",
    voice: "Go straight twelve meters, then turn right. Library is on your left." },
  { id: "outdoor", icon: MapPin, title: "Outdoor Navigation", desc: "Google Maps safe-walking routes.",
    demo: [{ label: "Bus Stop — 200 m", confidence: 100 }, { label: "Crossing ahead", confidence: 89 }],
    explain: "Route avoids construction on Main Street. One pedestrian crossing in 30 meters.",
    voice: "Continue fifty meters and cross the road. Bus stop will be on your right." },
  { id: "ocr", icon: ScanText, title: "Read Text", desc: "OCR for books, medicine and sign boards.",
    demo: [{ label: "Text extracted", confidence: 97 }],
    explain: "Recognized printed text using vision OCR with 97% character accuracy.",
    voice: "The sign reads: Ameerpet Metro Station. Platform two, this way." },
  { id: "currency", icon: Coins, title: "Currency", desc: "Detect and count Indian rupee notes.",
    demo: [{ label: "₹500 × 1", confidence: 99 }, { label: "₹200 × 2", confidence: 96 }, { label: "Total ₹900", confidence: 100 }],
    explain: "Identified notes by serial number patterns and denomination markings.",
    voice: "You are holding nine hundred rupees." },
  { id: "color", icon: Palette, title: "Color Detection", desc: "Describe colors and count them.",
    demo: [{ label: "Red apples: 2", confidence: 98 }, { label: "Yellow apple: 1", confidence: 95 }],
    explain: "Segmented the frame and clustered pixels by hue.",
    voice: "I see two red apples and one yellow apple." },
  { id: "face", icon: Users, title: "Face Recognition", desc: "Identify saved friends and family.",
    demo: [{ label: "Ravi (front)", confidence: 96 }, { label: "Sita (left)", confidence: 92 }, { label: "Amit (right)", confidence: 89 }],
    explain: "Matched three registered faces from your contacts book.",
    voice: "Ravi is in front of you, Sita is on your left, Amit is on your right." },
  { id: "hazard", icon: ShieldAlert, title: "Hazard Detection", desc: "Instant safety warnings for hazards.",
    demo: [{ label: "Wet floor", confidence: 91 }],
    explain: "Detected a yellow warning sign and reflective floor surface.",
    voice: "Warning: wet floor ahead. Please slow down." },
  { id: "reminder", icon: Bell, title: "Smart Reminders", desc: "Voice reminders for medicine and meetings.",
    demo: [{ label: "Medicine at 5:00 PM", confidence: 100 }],
    explain: "Reminder saved to your local schedule.",
    voice: "Reminder set: take medicine at five in the evening." },
  { id: "translate", icon: Languages, title: "Translate", desc: "Translate recognized text into your language.",
    demo: [{ label: "English → Telugu", confidence: 100 }],
    explain: "Translated using multilingual model with 9 supported languages.",
    voice: "మెట్రో స్టేషన్ ఇక్కడ ఉంది." },
  { id: "emergency", icon: PlayCircle, title: "Emergency SOS", desc: "Alert caregiver with your live location.",
    demo: [{ label: "Caregiver notified", confidence: 100 }, { label: "GPS shared", confidence: 100 }],
    explain: "Sent SMS with GPS coordinates to your emergency contact.",
    voice: "Emergency alert sent with your location." },
];

function speak(text: string) {
  say(text, "en", "general", { force: true });
}

function Dashboard() {
  const [active, setActive] = useState<Mode | null>(null);

  const runMode = (m: Mode) => {
    setActive(m);
    toast.success(`Running: ${m.title}`, { description: m.voice });
    speak(m.voice);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/60 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Home
          </Link>
          <div className="flex items-center gap-2 font-semibold">
            <div className="size-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Eye className="size-4 text-primary-foreground" />
            </div>
            Vision Companion
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Wifi className="size-3.5" /> Online</span>
            <span className="flex items-center gap-1"><Battery className="size-3.5" /> 82%</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-3 gap-4 mb-8">
          <div className="glass-card rounded-2xl p-6 lg:col-span-2">
            <div className="text-xs uppercase tracking-wider text-primary-glow mb-2">{tr("dashboard.welcome", undefined, getLang())}</div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{tr("dashboard.greeting", undefined, getLang())}</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Say <span className="text-gradient font-semibold">“Hey Vision”</span> then a command like
              “object detection”, “read text”, “navigate outdoor” or “emergency”.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary"><Mic className="size-3" /> Voice ready</Badge>
              <Badge variant="secondary"><Camera className="size-3" /> Camera armed</Badge>
              <Badge variant="secondary"><Sparkles className="size-3" /> Explainable AI</Badge>
              <Badge variant="secondary"><Languages className="size-3" /> 9 languages</Badge>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-6">
            <div className="text-xs uppercase tracking-wider text-primary-glow mb-3">AI status</div>
            {[
              { l: "YOLOv11", v: 96 },
              { l: "LLaVA", v: 92 },
              { l: "Whisper", v: 88 },
              { l: "ORB-SLAM3", v: 84 },
            ].map((s) => (
              <div key={s.l} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs mb-1"><span>{s.l}</span><span className="text-muted-foreground">{s.v}%</span></div>
                <Progress value={s.v} />
              </div>
            ))}
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-4">{tr("dashboard.allModes", undefined, getLang())}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => runMode(m)}
              className="text-left glass-card rounded-2xl p-6 hover:shadow-glow transition-all group focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="size-11 rounded-xl bg-gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <m.icon className="size-5 text-primary-foreground" />
                </div>
                <Volume2 className="size-4 text-muted-foreground group-hover:text-primary-glow" />
              </div>
              <h3 className="font-semibold mb-1">{m.title}</h3>
              <p className="text-sm text-muted-foreground">{m.desc}</p>
            </button>
          ))}
        </div>
      </main>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-lg">
          {active && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="size-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                    <active.icon className="size-5 text-primary-foreground" />
                  </div>
                  <div>
                    <DialogTitle>{active.title}</DialogTitle>
                    <DialogDescription>{active.desc}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="aspect-video rounded-xl bg-secondary/50 border border-border overflow-hidden relative flex items-center justify-center">
                <div className="absolute inset-0 opacity-30" style={{ background: "var(--gradient-glow)" }} />
                <Camera className="size-10 text-muted-foreground/40" />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[10px] bg-background/70 rounded-full px-2 py-1">
                  <span className="size-1.5 rounded-full bg-destructive animate-pulse" /> LIVE
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-primary-glow">{tr("dashboard.detected", undefined, getLang())}</div>
                {active.demo.map((d) => (
                  <div key={d.label} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                    <span>{d.label}</span>
                    <Badge variant="secondary" className="text-xs">{d.confidence}%</Badge>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border p-3 bg-secondary/30">
                <div className="text-xs uppercase tracking-wider text-primary-glow mb-1 flex items-center gap-1">
                  <Sparkles className="size-3" /> Why?
                </div>
                <p className="text-sm text-muted-foreground">{active.explain}</p>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 bg-gradient-primary text-primary-foreground" onClick={() => speak(active.voice)}>
                  <Volume2 className="size-4" /> Speak
                </Button>
                <Button variant="secondary" onClick={() => setActive(null)}>{tr("common.close", undefined, getLang())}</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}