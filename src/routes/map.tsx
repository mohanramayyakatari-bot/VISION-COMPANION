import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Navigation, MapPin, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { geocodePlace, getDirections } from "@/lib/maps.functions";

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

function speak(text: string, lang: Lang) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LANG_TAG[lang];
  window.speechSynthesis.speak(u);
}

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
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const userMarker = useRef<any>(null);
  const destMarker = useRef<any>(null);
  const routeLine = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const spokenIdx = useRef<number>(-1);

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
          () => setErr("Location permission denied. Enable location to get walking directions."),
          { enableHighAccuracy: true, maximumAge: 5000 },
        );
      }
    }).catch((e) => setErr(e.message));
    return () => {
      cancelled = true;
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const startRoute = async (destination: string) => {
    setErr(null);
    if (!destination.trim()) return;
    const user = userMarker.current?.getPosition?.();
    if (!user) { setErr("Waiting for your location…"); return; }
    setBusy(true);
    try {
      const place = await geocode({ data: { query: destination } });
      const r = await directions({ data: {
        originLat: user.lat(), originLng: user.lng(),
        destination: place.address ?? destination, mode: "WALK", language: lang,
      }});
      setRoute(r); setStepIdx(0); spokenIdx.current = -1;
      const google = (window as any).google;
      const path = decodePolyline(r.polyline).map(([lat, lng]) => ({ lat, lng }));
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
      const km = (r.distanceMeters / 1000).toFixed(1);
      const min = Math.round(r.durationSeconds / 60);
      const intro: Record<Lang, string> = {
        en: `Route to ${place.name}. ${km} kilometers, about ${min} minutes walking. ${r.steps[0]?.text ?? ""}`,
        te: `${place.name} కి మార్గం. ${km} కిలోమీటర్లు, సుమారు ${min} నిమిషాల నడక. ${r.steps[0]?.text ?? ""}`,
        hi: `${place.name} तक का रास्ता। ${km} किलोमीटर, लगभग ${min} मिनट पैदल। ${r.steps[0]?.text ?? ""}`,
      };
      speak(intro[lang], lang);
      spokenIdx.current = 0;
    } catch (e: any) {
      setErr(e?.message ?? "Could not compute route.");
    } finally {
      setBusy(false);
    }
  };

  // Auto-run from voice command (?dest=...&auto=1).
  useEffect(() => {
    if (search.auto && search.dest) {
      const t = setTimeout(() => startRoute(search.dest!), 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.auto, search.dest]);

  // Speak the next step as the user approaches its end point.
  useEffect(() => {
    if (!route) return;
    const timer = setInterval(() => {
      const u = userMarker.current?.getPosition?.();
      if (!u) return;
      const step = route.steps[stepIdx];
      if (!step?.endLat || !step?.endLng) return;
      const dx = (u.lat() - step.endLat) * 111000;
      const dy = (u.lng() - step.endLng) * 111000 * Math.cos((u.lat() * Math.PI) / 180);
      const dist = Math.hypot(dx, dy);
      if (dist < 20 && stepIdx < route.steps.length - 1) {
        const next = stepIdx + 1;
        setStepIdx(next);
        if (spokenIdx.current !== next) {
          speak(route.steps[next].text, lang);
          spokenIdx.current = next;
        }
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [route, stepIdx, lang]);

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <div className="text-sm font-semibold flex items-center gap-2">
          <Navigation className="size-4 text-primary-glow" /> Navigation
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
            placeholder="Where do you want to go?" className="pl-9" />
        </div>
        <Button onClick={() => startRoute(dest)} disabled={busy} className="bg-gradient-primary text-primary-foreground shadow-glow">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
          Go
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
                <p className="text-xs text-primary-glow">Step {stepIdx + 1} of {route.steps.length}</p>
                <p className="text-xs text-muted-foreground">{(route.distanceMeters / 1000).toFixed(1)} km · {Math.round(route.durationSeconds / 60)} min walking</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => speak(route.steps[stepIdx]?.text ?? "", lang)}>
                <Volume2 className="size-4" /> Repeat
              </Button>
            </div>
            <p className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: route.steps[stepIdx]?.text ?? "" }} />
          </div>
        )}
      </div>
    </div>
  );
}