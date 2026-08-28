import { createFileRoute, Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { say } from "@/lib/speech-manager";
import { startMode, stopActiveMode } from "@/lib/mode-lifecycle";

import { reverseGeocode } from "@/lib/maps.functions";
import {
  addContact, buildAlertMessage, deleteContact, listContacts, moveContact,
  smsHref, updateContact, type Contact,
} from "@/lib/emergency";
import {
  ArrowLeft, Siren, PhoneCall, MessageSquare, MapPin, Plus, Trash2,
  ChevronUp, ChevronDown, Loader2, Share2, Pencil, Check,
} from "lucide-react";

type Lang = "en" | "te" | "hi";

export const Route = createFileRoute("/emergency")({
  validateSearch: (s: Record<string, unknown>) => ({
    lang: typeof s.lang === "string" ? (s.lang as Lang) : undefined,
    auto: s.auto === "1" || s.auto === 1 || s.auto === true || s.auto === "true",
  }),
  head: () => ({
    meta: [
      { title: "Emergency SOS — Vision Companion" },
      { name: "description", content: "Send an emergency alert with your live GPS location to every registered contact, call for help, and manage emergency contacts by voice or touch." },
      { property: "og:title", content: "Emergency SOS — Vision Companion" },
      { property: "og:description", content: "One-tap SOS with live location sharing to all your emergency contacts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmergencyPage,
});

function EmergencyPage() {
  const search = Route.useSearch();
  const { lang, t: tk } = useT();
  const t = {
    title: tk("emergency.title"), sos: tk("emergency.sos"), locating: tk("emergency.locating"),
    sent: tk("emergency.sent"), fail: tk("emergency.fail"), noContacts: tk("emergency.noContacts"),
    contacts: tk("emergency.contacts"), add: tk("emergency.add"),
    name: tk("common.name"), phone: tk("common.phone"), activated: tk("emergency.activated"),
  };
  const revGeo = useServerFn(reverseGeocode);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const autoFired = useRef(false);

  const refresh = () => setContacts(listContacts());

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("vision:contactsChanged", h);
    return () => window.removeEventListener("vision:contactsChanged", h);
  }, []);

  // Emergency takes over the single active-mode slot: any camera mode, live
  // loop or ongoing announcement is stopped before the SOS screen speaks.
  useEffect(() => {
    startMode("EMERGENCY");
    say(t.activated, lang, "emergency", { force: true, exclusive: true });
    void locate();
    return () => stopActiveMode("leave:emergency");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const locate = async () => {
    setLocating(true);
    setError(null);
    try {
      const p = await new Promise<GeolocationPosition>((res, rej) => {
        if (!navigator.geolocation) return rej(new Error("Location is not available on this device."));
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 });
      });
      const next = { lat: p.coords.latitude, lng: p.coords.longitude };
      setPos(next);
      try {
        const { address: a } = await revGeo({ data: { ...next, language: lang } });
        setAddress(a);
        setMessage(buildAlertMessage({ ...next, address: a, lang }));
      } catch {
        setMessage(buildAlertMessage({ ...next, address: null, lang }));
      }
      return next;
    } catch (e: any) {
      setError(e?.message ?? tk("emergency.locationRequired"));
      return null;
    } finally {
      setLocating(false);
    }
  };

  const sendAll = async () => {
    const list = listContacts();
    if (!list.length) {
      setError(t.noContacts);
      say(t.noContacts, lang, "emergency", { force: true });
      return;
    }
    const where = pos ?? (await locate());
    const body = where ? buildAlertMessage({ ...where, address, lang }) : message;
    if (!body) {
      say(t.fail, lang, "emergency", { force: true });
      return;
    }
    setMessage(body);
    let ok = 0;
    for (const c of list) {
      try {
        updateContact(c.id, { lastStatus: "pending" });
        window.open(smsHref(c.phone, body), "_self");
        updateContact(c.id, { lastStatus: "sent", lastSentAt: Date.now() });
        ok++;
      } catch {
        updateContact(c.id, { lastStatus: "failed" });
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    refresh();
    say(ok ? t.sent : t.fail, lang, "emergency", { force: true });
  };

  const shareLocation = async () => {
    const where = pos ?? (await locate());
    if (!where) return;
    const body = buildAlertMessage({ ...where, address, lang });
    if (navigator.share) {
      try { await navigator.share({ title: "Emergency", text: body }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(body); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (search.auto && !autoFired.current && contacts.length) {
      autoFired.current = true;
      const id = setTimeout(() => void sendAll(), 900);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.auto, contacts.length]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b-2 border-border">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> {tk("common.home")}
          </Link>
          <div className="font-bold flex items-center gap-2"><Siren className="size-5 text-destructive" /> {t.title}</div>
          <span className="w-14" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-28">
        <section className="glass-card rounded-3xl p-6 border-2 border-destructive/60">
          <Button
            onClick={() => void sendAll()}
            className="w-full min-h-20 text-xl font-black rounded-2xl bg-destructive text-destructive-foreground shadow-glow"
          >
            <Siren className="size-7" /> {t.sos}
          </Button>
          <div className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
            <MapPin className="size-4" />
            {locating ? (<><Loader2 className="size-4 animate-spin" /> {t.locating}</>)
              : pos ? (address ?? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`)
              : (error ?? tk("emergency.locationUnknown"))}
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => void locate()} className="min-h-11"><MapPin className="size-4" /> {tk("emergency.refreshLocation")}</Button>
            <Button variant="secondary" onClick={() => void shareLocation()} className="min-h-11"><Share2 className="size-4" /> {tk("emergency.shareLocation")}</Button>
          </div>
          {message && (
            <pre className="mt-4 whitespace-pre-wrap text-xs bg-secondary/60 rounded-xl p-3 border border-border">{message}</pre>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">{t.contacts}</h2>
          <div className="flex gap-2 flex-wrap">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} className="min-h-12 flex-1 min-w-[140px]" aria-label={t.name} />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} inputMode="tel" className="min-h-12 flex-1 min-w-[140px]" aria-label={t.phone} />
            <Button
              className="min-h-12 bg-gradient-primary text-primary-foreground"
              onClick={() => {
                if (!name.trim() || !phone.trim()) return;
                addContact(name, phone);
                setName(""); setPhone(""); refresh();
              }}
            >
              <Plus className="size-4" /> {t.add}
            </Button>
          </div>

          <ul className="space-y-2">
            {contacts.map((c, i) => (
              <li key={c.id} className="glass-card rounded-2xl p-4 flex items-center gap-3 border-2 border-border">
                <div className="flex flex-col">
                  <button aria-label={tk("emergency.moveUp")} disabled={i === 0} onClick={() => { moveContact(c.id, -1); refresh(); }} className="disabled:opacity-30"><ChevronUp className="size-4" /></button>
                  <button aria-label={tk("emergency.moveDown")} disabled={i === contacts.length - 1} onClick={() => { moveContact(c.id, 1); refresh(); }} className="disabled:opacity-30"><ChevronDown className="size-4" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  {editing === c.id ? (
                    <div className="flex gap-2 flex-wrap">
                      <Input defaultValue={c.name} onChange={(e) => updateContact(c.id, { name: e.target.value })} className="min-h-10 flex-1 min-w-[120px]" aria-label="Edit name" />
                      <Input defaultValue={c.phone} onChange={(e) => updateContact(c.id, { phone: e.target.value })} className="min-h-10 flex-1 min-w-[120px]" aria-label="Edit phone" />
                    </div>
                  ) : (
                    <>
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-sm text-muted-foreground">{c.phone}</div>
                    </>
                  )}
                  {c.lastStatus && (
                    <div className={`text-xs mt-1 ${c.lastStatus === "sent" ? "text-success" : c.lastStatus === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
                      {c.lastStatus.toUpperCase()}{c.lastSentAt ? ` · ${new Date(c.lastSentAt).toLocaleTimeString()}` : ""}
                    </div>
                  )}
                </div>
                <a href={`tel:${c.phone}`} aria-label={`Call ${c.name}`}>
                  <Button size="sm" variant="secondary" className="min-h-11"><PhoneCall className="size-4" /></Button>
                </a>
                <a href={smsHref(c.phone, message || "Emergency! I need help.")} aria-label={`Message ${c.name}`}>
                  <Button size="sm" variant="secondary" className="min-h-11"><MessageSquare className="size-4" /></Button>
                </a>
                <Button size="sm" variant="secondary" className="min-h-11" aria-label="Edit contact" onClick={() => { setEditing(editing === c.id ? null : c.id); refresh(); }}>
                  {editing === c.id ? <Check className="size-4" /> : <Pencil className="size-4" />}
                </Button>
                <Button size="sm" variant="secondary" className="min-h-11" aria-label={`Delete ${c.name}`} onClick={() => { deleteContact(c.id); refresh(); }}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
            {!contacts.length && <li className="text-sm text-muted-foreground">{t.noContacts}</li>}
          </ul>
        </section>
      </main>
    </div>
  );
}