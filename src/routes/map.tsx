import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Navigation, MapPin, Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { geocodePlace, getDirections } from "@/lib/maps.functions";
import { say, stopSpeaking } from "@/lib/speech-manager";
import { tr } from "@/lib/i18n";

type Lang = "en" | "te" | "hi";

export const Route = createFileRoute("/map")({
  component: MapPage,
  validateSearch: (s: Record<string, unknown>) => ({
    dest: typeof s.dest === "string" ? s.dest : undefined,
    lang: (typeof s.lang === "string" ? s.lang : "en") as Lang,
    auto: s.auto === "1" || s.auto === true,
  }),
  head: () => ({
    meta: [
      { title: "Navigation Map — Vision Companion" },
      { name: "description", content: "Walking directions with turn-by-turn voice guidance for visually impaired users." },
    ],
  }),
});

const LANG_TAG: Record<Lang, string> = { en: "en-US", te: "te-IN", hi: "hi-IN" };
const LANG_LABEL: Record<Lang, string> = { en: "English", te: "తెలుగు", hi: "हिन्दी" };

function speak(text: string, lang: Lang, urgent = false) {
  say(text, lang, urgent ? "hazard" : "navigation", { force: urgent });
}
const cancelSpeech = stopSpeaking;

// Strip HTML tags returned by Google navigation instructions.
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Haversine distance in meters.
function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Closest distance from point P to the polyline (in meters).
function distToPath(p: { lat: number; lng: number }, path: Array<{ lat: number; lng: number }>): number {
  if (!path.length) return Infinity;
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    // Approximate with equirectangular projection near the segment.
    const latRef = (a.lat + b.lat) / 2;
    const cos = Math.cos((latRef * Math.PI) / 180);
    const ax = 0, ay = 0;
    const bx = (b.lng - a.lng) * cos * 111320;
    const by = (b.lat - a.lat) * 110540;
    const px = (p.lng - a.lng) * cos * 111320;
    const py = (p.lat - a.lat) * 110540;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d < best) best = d;
  }
  return best;
}

function turnPhrase(instructionText: string, lang: Lang): { approaching: string; now: string } {
  const t = instructionText.toLowerCase();
  const dir =
    /\bleft\b/.test(t) ? "left" :
    /\bright\b/.test(t) ? "right" :
    /roundabout|u-turn/.test(t) ? "uturn" :
    /destination|arriv/.test(t) ? "arrive" :
    "straight";
  const M: Record<Lang, Record<string, [string, string]>> = {
    en: {
      left: ["Left turn approaching.", "Turn left now."],
      right: ["Right turn approaching.", "Turn right now."],
      uturn: ["U-turn approaching.", "Make the U-turn now."],
      straight: ["Keep walking straight.", "Continue straight."],
      arrive: ["Your destination is just ahead.", "You have arrived."],
    },
    te: {
      left: ["ఎడమవైపు మలుపు వస్తోంది.", "ఇప్పుడు ఎడమకు తిరగండి."],
      right: ["కుడివైపు మలుపు వస్తోంది.", "ఇప్పుడు కుడికి తిరగండి."],
      uturn: ["యు-టర్న్ వస్తోంది.", "ఇప్పుడు యు-టర్న్ చేయండి."],
      straight: ["నేరుగా నడవండి.", "నేరుగా కొనసాగండి."],
      arrive: ["మీ గమ్యస్థానం సమీపంలో ఉంది.", "మీరు చేరుకున్నారు."],
    },
    hi: {
      left: ["बाईं ओर मोड़ पास आ रहा है.", "अब बाएँ मुड़ें."],
      right: ["दाईं ओर मोड़ पास आ रहा है.", "अब दाएँ मुड़ें."],
      uturn: ["यू-टर्न पास आ रहा है.", "अब यू-टर्न लें."],
      straight: ["सीधे चलते रहें.", "सीधे जारी रखें."],
      arrive: ["आपका गंतव्य पास है.", "आप पहुँच गए हैं."],
    },
  };
  const [a, n] = M[lang][dir];
  return { approaching: a, now: n };
}

const OFF_ROUTE_MSG: Record<Lang, string> = {
  en: "You have moved off the route. Recalculating a safer path.",
  te: "మీరు మార్గం నుండి బయటకు వెళ్లారు. కొత్త మార్గాన్ని లెక్కిస్తున్నాను.",
  hi: "आप रास्ते से हट गए हैं. नया मार्ग बना रहा हूँ.",
};

const ARRIVED_MSG: Record<Lang, string> = {
  en: "You have arrived at your destination.",
  te: "మీరు మీ గమ్యస్థానానికి చేరుకున్నారు.",
  hi: "आप अपने गंतव्य पर पहुँच गए हैं.",
};

// Decode a Google encoded polyline into [lat,lng] pairs.
function decodePolyline(str: string): Array<[number, number]> {
  let index = 0, lat = 0, lng = 0;
  const coordinates: Array<[number, number]> = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coordinates.push([lat / 1e5, lng / 1e5]);
  }
  return coordinates;
}

// Load the Maps JS API exactly once.
let mapsLoader: Promise<any> | null = null;
function loadMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    (window as any).__visionMapInit = () => resolve((window as any).google);
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) { reject(new Error("Google Maps browser key missing.")); return; }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__visionMapInit${channel ? `&channel=${channel}` : ""}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(s);
  });
  return mapsLoader;
}

type Step = { text: string; distanceMeters: number; endLat?: number; endLng?: number };

function MapPage() {
  const search = Route.useSearch();
  const geocode = useServerFn(geocodePlace);
  const directions = useServerFn(getDirections);
  const [lang, setLang] = useState<Lang>(search.lang ?? "en");
  const [dest, setDest] = useState(search.dest ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [route, setRoute] = useState<{ steps: Step[]; distanceMeters: number; durationSeconds: number } | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [status, setStatus] = useState<string>("");
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const userMarker = useRef<any>(null);
  const destMarker = useRef<any>(null);
  const routeLine = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const spokenApproach = useRef<Set<number>>(new Set());
  const spokenNow = useRef<Set<number>>(new Set());
  const spokenCountdown = useRef<Set<string>>(new Set());
  const pathLatLng = useRef<Array<{ lat: number; lng: number }>>([]);
  const destAddr = useRef<string>("");
  const offRouteSince = useRef<number | null>(null);
  const arrived = useRef(false);
  const rerouting = useRef(false);
  const langRef = useRef<Lang>(search.lang ?? "en");
  useEffect(() => { langRef.current = lang; }, [lang]);

  // Init map + geolocation
  useEffect(() => {
    let cancelled = false;
    loadMaps().then((google) => {
      if (cancelled || !mapDiv.current) return;
      const map = new google.maps.Map(mapDiv.current, {
        center: { lat: 17.385, lng: 78.4867 },
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
      });
      mapRef.current = map;
      if (navigator.geolocation) {
        watchId.current = navigator.geolocation.watchPosition(
          (pos) => {
            const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            if (!userMarker.current) {
              userMarker.current = new google.maps.Marker({
                map, position: p, title: "You",
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#3b82f6", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
              });
              map.setCenter(p);
            } else userMarker.current.setPosition(p);
          },
          () => setErr(tr("map.locationDenied", undefined, langRef.current)),
          { enableHighAccuracy: true, maximumAge: 5000 },
        );
      }
    }).catch((e) => setErr(e.message));
    return () => {
      cancelled = true;
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      cancelSpeech();
    };
  }, []);

  const startRoute = async (destination: string, silent = false) => {
    setErr(null);
    if (!destination.trim()) return;
    const user = userMarker.current?.getPosition?.();
    if (!user) { setErr(tr("map.waitingLocation", undefined, langRef.current)); return; }
    setBusy(true);
    try {
      const place = await geocode({ data: { query: destination } });
      const r = await directions({ data: {
        originLat: user.lat(), originLng: user.lng(),
        destination: place.address ?? destination, mode: "WALK", language: langRef.current,
      }});
      // Normalise step text (Google returns HTML).
      const cleanSteps: Step[] = r.steps.map((s: Step) => ({ ...s, text: stripTags(s.text) }));
      setRoute({ ...r, steps: cleanSteps });
      setStepIdx(0);
      spokenApproach.current = new Set();
      spokenNow.current = new Set();
      spokenCountdown.current = new Set();
      arrived.current = false;
      offRouteSince.current = null;
      destAddr.current = place.address ?? destination;
      const google = (window as any).google;
      const path = decodePolyline(r.polyline).map(([lat, lng]) => ({ lat, lng }));
      pathLatLng.current = path;
      if (routeLine.current) routeLine.current.setMap(null);
      routeLine.current = new google.maps.Polyline({
        map: mapRef.current, path, strokeColor: "#3b82f6", strokeWeight: 5, strokeOpacity: 0.9,
      });
      if (destMarker.current) destMarker.current.setMap(null);
      destMarker.current = new google.maps.Marker({
        map: mapRef.current, position: { lat: place.lat, lng: place.lng }, title: place.name,
      });
      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      mapRef.current.fitBounds(bounds, 80);
      if (!silent) {
        const km = (r.distanceMeters / 1000).toFixed(1);
        const min = Math.round(r.durationSeconds / 60);
        const first = cleanSteps[0]?.text ?? "";
        const intro: Record<Lang, string> = {
          en: `Route to ${place.name}. ${km} kilometers, about ${min} minutes walking. ${first}`,
          te: `${place.name} కి మార్గం. ${km} కిలోమీటర్లు, సుమారు ${min} నిమిషాల నడక. ${first}`,
          hi: `${place.name} तक का रास्ता। ${km} किलोमीटर, लगभग ${min} मिनट पैदल। ${first}`,
        };
        speak(intro[langRef.current], langRef.current);
      }
      setStatus(tr("map.navigating", { place: place.name ?? "" }, langRef.current));
    } catch (e: any) {
      setErr(e?.message ?? tr("map.noRoute", undefined, langRef.current));
    } finally {
      setBusy(false);
    }
  };

  const stopNav = () => {
    cancelSpeech();
    if (routeLine.current) { routeLine.current.setMap(null); routeLine.current = null; }
    if (destMarker.current) { destMarker.current.setMap(null); destMarker.current = null; }
    setRoute(null); setStepIdx(0); setStatus("");
    pathLatLng.current = [];
    const msg: Record<Lang, string> = {
      en: "Navigation stopped.", te: "మార్గదర్శకం ఆగింది.", hi: "नेविगेशन बंद हो गया।",
    };
    speak(msg[langRef.current], langRef.current);
  };

  const repeatCurrent = () => {
    if (!route) return;
    const s = route.steps[stepIdx];
    if (s) speak(s.text, langRef.current);
  };

  // Auto-run from voice command (?dest=...&auto=1).
  useEffect(() => {
    if (search.auto && search.dest) {
      const t = setTimeout(() => startRoute(search.dest!), 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.auto, search.dest]);

  // Proactive guidance loop: countdown, turn cues, off-route detection, arrival.
  useEffect(() => {
    if (!route) return;
    const timer = setInterval(async () => {
      if (arrived.current) return;
      const marker = userMarker.current?.getPosition?.();
      if (!marker) return;
      const u = { lat: marker.lat(), lng: marker.lng() };
      const step = route.steps[stepIdx];
      const L = langRef.current;

      // Off-route check
      if (pathLatLng.current.length) {
        const off = distToPath(u, pathLatLng.current);
        if (off > 40) {
          offRouteSince.current = offRouteSince.current ?? Date.now();
          if (Date.now() - (offRouteSince.current ?? 0) > 8000 && !rerouting.current && destAddr.current) {
            rerouting.current = true;
            speak(OFF_ROUTE_MSG[L], L, true);
            setStatus(tr("map.offRoute", undefined, L));
            try { await startRoute(destAddr.current, true); } finally { rerouting.current = false; }
            return;
          }
        } else {
          offRouteSince.current = null;
        }
      }

      if (!step?.endLat || !step?.endLng) return;
      const dist = distMeters(u, { lat: step.endLat, lng: step.endLng });
      const isLast = stepIdx >= route.steps.length - 1;
      const { approaching, now } = turnPhrase(step.text, L);

      // Countdown at 100m / 50m
      for (const mark of [100, 50] as const) {
        const key = `${stepIdx}:${mark}`;
        if (dist < mark + 5 && dist > mark - 15 && !spokenCountdown.current.has(key)) {
          spokenCountdown.current.add(key);
          const msg: Record<Lang, string> = {
            en: `In ${mark} meters, ${approaching.toLowerCase().replace(/\.$/, "")}.`,
            te: `${mark} మీటర్లలో, ${approaching}`,
            hi: `${mark} मीटर में, ${approaching}`,
          };
          speak(msg[L], L);
        }
      }
      // Approaching (~25m)
      if (dist < 30 && dist > 12 && !spokenApproach.current.has(stepIdx)) {
        spokenApproach.current.add(stepIdx);
        speak(approaching, L);
      }
      // Now (~10m) — advance step
      if (dist < 12 && !spokenNow.current.has(stepIdx)) {
        spokenNow.current.add(stepIdx);
        if (isLast) {
          arrived.current = true;
          speak(ARRIVED_MSG[L], L, true);
          setStatus(tr("map.arrived", undefined, L));
        } else {
          speak(now, L, true);
          setStepIdx((i) => i + 1);
        }
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [route, stepIdx]);

  // Voice-controlled stop: listen for a global "vision:stopNav" event
  // that the VoiceAssistant can dispatch.
  useEffect(() => {
    const handler = () => stopNav();
    const rep = () => repeatCurrent();
    window.addEventListener("vision:stopNav", handler);
    window.addEventListener("vision:repeatNav", rep);
    return () => {
      window.removeEventListener("vision:stopNav", handler);
      window.removeEventListener("vision:repeatNav", rep);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, stepIdx]);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {tr("common.back", undefined, lang)}
        </Link>
        <div className="text-sm font-semibold flex items-center gap-2">
          <Navigation className="size-4 text-primary-glow" /> {tr("map.title", undefined, lang)}
        </div>
        <div className="flex gap-1">
          {(["en", "te", "hi"] as Lang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-2 py-1 rounded-md text-xs font-medium ${lang === l ? "bg-gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </header>

      <div className="px-3 py-3 flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={dest} onChange={(e) => setDest(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startRoute(dest)}
            placeholder={tr("map.where", undefined, lang)} className="pl-9" />
        </div>
        <Button onClick={() => startRoute(dest)} disabled={busy} className="bg-gradient-primary text-primary-foreground shadow-glow">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
          {tr("map.go", undefined, lang)}
        </Button>
      </div>

      {err && (
        <div className="mx-3 mb-2 rounded-lg bg-destructive/15 text-destructive text-sm px-3 py-2">{err}</div>
      )}

      <div className="relative flex-1 min-h-[300px] bg-secondary/20">
        <div ref={mapDiv} className="absolute inset-0" />
        {route && (
          <div className="absolute left-3 right-3 bottom-3 glass-card rounded-2xl p-4 max-h-[40%] overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-primary-glow">{tr("map.step", { i: stepIdx + 1, n: route.steps.length }, lang)}</p>
                <p className="text-xs text-muted-foreground">{tr("map.summary", { km: (route.distanceMeters / 1000).toFixed(1), min: Math.round(route.durationSeconds / 60) }, lang)}</p>
                {status && <p className="text-[10px] text-primary-glow mt-0.5">{status}</p>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={repeatCurrent}>
                  <Volume2 className="size-4" /> {tr("map.repeat", undefined, lang)}
                </Button>
                <Button size="sm" variant="destructive" onClick={stopNav}>
                  <Square className="size-4" /> {tr("map.stop", undefined, lang)}
                </Button>
              </div>
            </div>
            <p className="text-sm leading-relaxed">{route.steps[stepIdx]?.text ?? ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}