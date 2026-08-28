import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { say } from "@/lib/speech-manager";
import { startMode, stopActiveMode, registerCleanup } from "@/lib/mode-lifecycle";

import {
  addPerson, deletePerson, listAllPeople, updatePerson, type MergedPerson,
} from "@/lib/people";
import { isGuest } from "@/lib/session";
import { tr, useT } from "@/lib/i18n";
import { ArrowLeft, Camera as CameraIcon, Plus, Trash2, Users, Loader2, Save } from "lucide-react";

type Lang = "en" | "te" | "hi";

export const Route = createFileRoute("/people")({
  validateSearch: (s: Record<string, unknown>) => ({
    lang: typeof s.lang === "string" ? (s.lang as Lang) : undefined,
    person: typeof s.person === "string" ? s.person : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Face Manager — Vision Companion" },
      { name: "description", content: "Add, update, rename or delete the people Vision Companion recognizes. Capture multiple face angles from the live camera." },
      { property: "og:title", content: "Face Manager — Vision Companion" },
      { property: "og:description", content: "Manage the trusted faces your AI assistant announces." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeoplePage,
});

const ANGLE_KEYS = ["people.angle.front", "people.angle.left", "people.angle.right", "people.angle.up", "people.angle.down"];

function PeoplePage() {
  const search = Route.useSearch();
  const guest = typeof window !== "undefined" && isGuest();
  const { lang } = useT();
  const [people, setPeople] = useState<MergedPerson[]>([]);
  const [locked] = useState(guest);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [target, setTarget] = useState<string | null>(null); // person id being captured for
  const [shots, setShots] = useState<string[]>([]);
  const [camOn, setCamOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const refresh = () => setPeople(listAllPeople());

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("vision:peopleChanged", h);
    return () => {
      window.removeEventListener("vision:peopleChanged", h);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (search.person) setQuery(search.person);
  }, [search.person]);

  const startCamera = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "user" } }, audio: false });
      streamRef.current = stream;
      setCamOn(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      }, 40);
    } catch (e: any) {
      const msg = tr("people.camPermission", undefined, lang);
      setErr(e?.message ?? msg);
      say(msg, lang, "general", { force: true });
    }
  };

  const capture = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    const w = Math.min(v.videoWidth, 640);
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    c.width = w; c.height = h;
    c.getContext("2d")?.drawImage(v, 0, 0, w, h);
    const url = c.toDataURL("image/jpeg", 0.75);
    setShots((s) => [...s, url]);
    say(tr("people.captureLabel", { angle: ANGLE_KEYS[shots.length] ? tr(ANGLE_KEYS[shots.length], undefined, lang) : tr("people.angle.extra", undefined, lang) }, lang), lang, "general", { force: true });
  };

  const saveShots = () => {
    if (!shots.length) return;
    if (target) {
      updatePerson(target, { addImages: shots });
      say(tr("people.faceUpdated", undefined, lang), lang, "general", { force: true });
    } else {
      if (!newName.trim()) { setErr(tr("people.needName", undefined, lang)); return; }
      addPerson(newName, shots);
      say(`${newName} added.`, lang, "general", { force: true });
      setNewName("");
    }
    setShots([]); setTarget(null); refresh();
  };

  const shown = people.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  if (locked) {
    return (
      <div className="min-h-dvh grid place-items-center px-4">
        <div className="glass-card rounded-3xl p-8 max-w-md text-center border-2 border-border">
          <Users className="size-10 mx-auto text-primary-glow mb-4" aria-hidden />
          <h1 className="text-2xl font-bold mb-2">{tr("people.accountRequired", undefined, lang)}</h1>
          <p className="text-muted-foreground mb-6">
            {tr("people.accountRequiredBody", undefined, lang)}
          </p>
          <Link to="/auth">
            <Button className="min-h-13 rounded-2xl bg-gradient-primary text-primary-foreground font-bold px-8">
              {tr("people.loginSignUp", undefined, lang)}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b-2 border-border">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> {tr("common.home", undefined, lang)}
          </Link>
          <div className="font-bold flex items-center gap-2"><Users className="size-5 text-primary-glow" /> {tr("people.title", undefined, lang)}</div>
          <Link to="/camera" search={{ mode: "face", lang, auto: false } as any} className="text-sm text-primary-glow font-semibold">{tr("people.recognize", undefined, lang)}</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-28">
        <section className="glass-card rounded-3xl p-5 border-2 border-border space-y-3">
          <h2 className="font-bold text-lg">
            {target ? tr("people.updatePhotos", { name: people.find((p) => p.id === target)?.name ?? "" }, lang) : tr("people.addPerson", undefined, lang)}
          </h2>
          {!target && (
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={tr("people.personName", undefined, lang)} className="min-h-12" aria-label={tr("people.personName", undefined, lang)} />
          )}
          <div className="rounded-2xl overflow-hidden bg-black aspect-video relative">
            <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {!camOn && (
              <div className="absolute inset-0 grid place-items-center">
                <Button onClick={() => void startCamera()} className="min-h-12 bg-gradient-primary text-primary-foreground">
                  <CameraIcon className="size-5" /> {tr("people.startCamera", undefined, lang)}
                </Button>
              </div>
            )}
            {camOn && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs bg-background/80 rounded-full px-3 py-1.5">
                {tr("people.captureLabel", { angle: ANGLE_KEYS[shots.length] ? tr(ANGLE_KEYS[shots.length], undefined, lang) : tr("people.angle.extra", undefined, lang) }, lang)}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={capture} disabled={!camOn} className="min-h-12 flex-1 bg-gradient-primary text-primary-foreground">
              <CameraIcon className="size-4" /> {tr("people.captureAngle", { n: shots.length }, lang)}
            </Button>
            <Button onClick={saveShots} disabled={!shots.length} variant="secondary" className="min-h-12">
              <Save className="size-4" /> {tr("common.save", undefined, lang)}
            </Button>
            {target && <Button variant="secondary" className="min-h-12" onClick={() => { setTarget(null); setShots([]); }}>{tr("common.cancel", undefined, lang)}</Button>}
          </div>
          {!!shots.length && (
            <div className="flex gap-2 overflow-x-auto">
              {shots.map((s, i) => <img key={i} src={s} alt={`Captured angle ${i + 1}`} className="size-16 rounded-lg object-cover border border-border" />)}
            </div>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold flex-1">{tr("people.registered", { n: people.length }, lang)}</h2>
          </div>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("people.searchPeople", undefined, lang)} className="min-h-12" aria-label={tr("people.searchPeople", undefined, lang)} />
          <ul className="space-y-2">
            {shown.map((p) => (
              <li key={p.id} className="glass-card rounded-2xl p-3 flex items-center gap-3 border-2 border-border">
                <img
                  src={p.images[0] ?? p.file ?? ""}
                  alt={p.name}
                  className="size-14 rounded-xl object-cover bg-secondary"
                />
                <div className="flex-1 min-w-0">
                  <Input
                    defaultValue={p.name}
                    onBlur={(e) => { if (e.target.value.trim() && e.target.value !== p.name) { updatePerson(p.id, { name: e.target.value }); refresh(); } }}
                    className="min-h-10 font-semibold"
                    aria-label={`Rename ${p.name}`}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {p.builtin ? tr("people.builtin", undefined, lang) : tr("people.custom", undefined, lang)} · {(p.images.length || (p.file ? 1 : 0))} {tr("people.photos", undefined, lang)}
                  </div>
                </div>
                <Button size="sm" variant="secondary" className="min-h-11" onClick={() => { setTarget(p.id); setShots([]); if (!camOn) void startCamera(); }}>
                  <Plus className="size-4" /> {tr("people.photosBtn", undefined, lang)}
                </Button>
                <Button size="sm" variant="secondary" className="min-h-11" aria-label={`Delete ${p.name}`} onClick={() => { deletePerson(p.id); refresh(); }}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
            {!shown.length && <li className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> {tr("people.noMatch", undefined, lang)}</li>}
          </ul>
        </section>
      </main>
    </div>
  );
}