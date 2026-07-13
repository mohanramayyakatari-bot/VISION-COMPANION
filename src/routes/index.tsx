import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Eye, Mic, Camera, MapPin, ScanText, Coins, Palette, Users,
  ShieldAlert, Languages, Brain, Sparkles, ArrowRight, CheckCircle2,
  Cpu, Cloud, Navigation, Volume2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

const FEATURES = [
  { icon: Eye, title: "Object Detection", desc: "Real-time YOLO detection with bounding boxes, distance and direction cues." },
  { icon: Brain, title: "Scene Understanding", desc: "LLaVA-powered scene descriptions of environments, people and hazards." },
  { icon: Navigation, title: "Indoor Navigation", desc: "ORB-SLAM3 turn-by-turn guidance inside buildings with AR arrows." },
  { icon: MapPin, title: "Outdoor Navigation", desc: "Google Maps routing with safe-walking, traffic and crossing alerts." },
  { icon: ScanText, title: "OCR & Documents", desc: "Read books, medicine labels, ID cards and sign boards aloud." },
  { icon: Coins, title: "Currency Recognition", desc: "Identify Indian notes and calculate totals instantly." },
  { icon: Palette, title: "Color Detection", desc: "Describe colors of objects and count them accurately." },
  { icon: Users, title: "Face & Friend Finder", desc: "Recognize saved family and friends with their direction and distance." },
  { icon: ShieldAlert, title: "Hazard Detection", desc: "Wet floors, stairs, vehicles and fire — instant safety warnings." },
  { icon: Languages, title: "9 Languages", desc: "English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Urdu, Bengali." },
  { icon: Sparkles, title: "Explainable AI", desc: "Every prediction includes the reasoning and confidence — you know why." },
  { icon: Volume2, title: "Multilingual TTS", desc: "IndicTTS + Coqui + Google TTS for natural voice guidance." },
];

const STEPS = [
  { n: "01", t: "Launch", d: "Open Vision Companion." },
  { n: "02", t: "Wake", d: "Say “Hey Vision”." },
  { n: "03", t: "Command", d: "Speak what you need." },
  { n: "04", t: "Capture", d: "Camera + mic + GPS." },
  { n: "05", t: "AI Process", d: "YOLO, LLaVA, Whisper, SLAM." },
  { n: "06", t: "Explain", d: "AI generates the why." },
  { n: "07", t: "Speak", d: "Voice guidance in your language." },
];

const STACK = [
  { g: "Frontend", i: ["React", "TypeScript", "Tailwind", "Framer Motion"] },
  { g: "Backend", i: ["FastAPI", "Python", "PostgreSQL", "Redis"] },
  { g: "AI / ML", i: ["YOLOv11", "LLaVA", "Whisper", "PyTorch"] },
  { g: "Navigation", i: ["ORB-SLAM3", "Google Maps API", "MediaPipe"] },
  { g: "Voice", i: ["Coqui TTS", "IndicTTS", "Google TTS"] },
  { g: "Deploy", i: ["Docker", "Vercel", "Railway"] },
];

function Index() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <SectionHead eyebrow="Capabilities" title="Everything a visual assistant should do" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-card rounded-2xl p-6 hover:shadow-glow transition-all group">
              <div className="size-11 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="size-5 text-primary-foreground" />
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="max-w-6xl mx-auto px-6 py-24 border-t border-border">
        <SectionHead eyebrow="Workflow" title="How Vision Companion works" />
        <div className="grid md:grid-cols-4 lg:grid-cols-7 gap-3 mt-12">
          {STEPS.map((s) => (
            <div key={s.n} className="glass-card rounded-xl p-5">
              <div className="text-xs text-primary-glow font-mono mb-2">{s.n}</div>
              <div className="font-semibold text-sm mb-1">{s.t}</div>
              <div className="text-xs text-muted-foreground">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="architecture" className="max-w-6xl mx-auto px-6 py-24 border-t border-border">
        <SectionHead eyebrow="Architecture" title="Modular, explainable, production-ready" />
        <div className="grid lg:grid-cols-3 gap-4 mt-12">
          {[
            { icon: Camera, t: "Client Layer", d: "Camera, microphone, GPS, wake-word engine and voice UI." },
            { icon: Cloud, t: "FastAPI Backend", d: "REST endpoints for detection, OCR, TTS, STT and history." },
            { icon: Cpu, t: "AI/ML Modules", d: "YOLOv11, LLaVA, Whisper, ORB-SLAM3, Google Maps." },
            { icon: Brain, t: "Decision Engine", d: "Context fusion, hazard scoring, route planning, explanations." },
            { icon: Volume2, t: "TTS Pipeline", d: "IndicTTS / Coqui / Google TTS with per-language voices." },
            { icon: Sparkles, t: "Explainable AI", d: "Every response ships with why, confidence and evidence." },
          ].map((b) => (
            <div key={b.t} className="glass-card rounded-2xl p-6">
              <b.icon className="size-6 text-primary-glow mb-3" />
              <div className="font-semibold mb-1">{b.t}</div>
              <p className="text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="tech" className="max-w-6xl mx-auto px-6 py-24 border-t border-border">
        <SectionHead eyebrow="Technology" title="Built on a mature stack" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
          {STACK.map((s) => (
            <div key={s.g} className="glass-card rounded-2xl p-6">
              <div className="text-xs uppercase tracking-wider text-primary-glow mb-3">{s.g}</div>
              <ul className="space-y-2">
                {s.i.map((x) => (
                  <li key={x} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-success" /> {x}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-24 text-center border-t border-border">
        <h2 className="text-3xl md:text-5xl font-bold mb-4">Try the voice assistant now</h2>
        <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
          Click the microphone in the bottom right, then say <span className="text-gradient font-semibold">“Hey Vision”</span>. It responds instantly.
        </p>
        <Link to="/dashboard">
          <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow">
            Open Dashboard <ArrowRight className="size-4" />
          </Button>
        </Link>
      </section>

      <Footer />
    </div>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium mb-3">{eyebrow}</div>
      <h2 className="text-3xl md:text-4xl font-bold">{title}</h2>
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/60 border-b border-border">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div className="size-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Eye className="size-4 text-primary-foreground" />
          </div>
          Vision Companion
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#architecture" className="hover:text-foreground">Architecture</a>
          <a href="#tech" className="hover:text-foreground">Technology</a>
        </div>
        <Link to="/dashboard">
          <Button size="sm" className="bg-gradient-primary text-primary-foreground">Launch app</Button>
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-32 text-center relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-4 py-1.5 text-xs text-muted-foreground mb-6">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          Voice assistant online — say “Hey Vision”
        </div>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
          Your eyes, <span className="text-gradient">everywhere.</span>
          <br />Your assistant, always.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
          Vision Companion is an explainable AI visual assistant for the visually impaired. It sees the world,
          explains it in your language, and guides you safely — indoors and outdoors.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/dashboard">
            <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow h-12 px-6">
              <Sparkles className="size-4" /> Get Started
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="h-12 px-6" onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
            <Mic className="size-4" /> Try Voice Demo
          </Button>
        </div>

        <div className="mt-20 relative">
          <div className="absolute inset-0 -z-10 blur-3xl opacity-60" style={{ background: "var(--gradient-glow)" }} />
          <div className="glass-card rounded-3xl p-8 max-w-3xl mx-auto animate-float">
            <div className="grid grid-cols-3 gap-4 text-left">
              {[
                { i: Camera, l: "Camera", v: "Live" },
                { i: Mic, l: "Microphone", v: "Listening" },
                { i: MapPin, l: "GPS", v: "Locked" },
                { i: Brain, l: "AI Model", v: "YOLOv11" },
                { i: ShieldAlert, l: "Hazards", v: "None" },
                { i: Languages, l: "Language", v: "English" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl bg-secondary/40 p-3">
                  <s.i className="size-4 text-primary-glow mb-2" />
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{s.l}</div>
                  <div className="text-sm font-semibold">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="flex items-center gap-2 font-semibold mb-3">
            <div className="size-7 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Eye className="size-4 text-primary-foreground" />
            </div>
            Vision Companion
          </div>
          <p className="text-muted-foreground">Explainable AI visual assistant for the visually impaired.</p>
        </div>
        {[
          { h: "Product", l: ["Features", "How it works", "Architecture", "Technology"] },
          { h: "Resources", l: ["Documentation", "GitHub", "Research", "Accessibility"] },
          { h: "Company", l: ["About", "Contact", "Privacy", "Terms"] },
        ].map((c) => (
          <div key={c.h}>
            <div className="font-semibold mb-3">{c.h}</div>
            <ul className="space-y-2 text-muted-foreground">
              {c.l.map((x) => <li key={x} className="hover:text-foreground cursor-pointer">{x}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Vision Companion. Built with accessibility first.
      </div>
    </footer>
  );
}
