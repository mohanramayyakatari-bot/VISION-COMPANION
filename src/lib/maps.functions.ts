import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const GeocodeInput = z.object({ query: z.string().min(1).max(200) });
const DirectionsInput = z.object({
  originLat: z.number(),
  originLng: z.number(),
  destination: z.string().min(1).max(200),
  mode: z.enum(["WALK", "DRIVE", "TRANSIT", "BICYCLE"]).default("WALK"),
  language: z.enum(["en", "te", "hi"]).default("en"),
});

function requireKeys() {
  const lovable = process.env.LOVABLE_API_KEY;
  const gmaps = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovable || !gmaps) throw new Error("Google Maps connector not configured.");
  return { lovable, gmaps };
}

async function handleMapsError(res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  if (res.status === 403) {
    let reason: string | undefined;
    try { reason = JSON.parse(body)?.error?.details?.find((d: any) => d.reason)?.reason; } catch {}
    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") throw new Error("Google Maps server key is referrer-restricted. In Google Cloud Console, set its application restrictions to \"None\" or \"IP addresses\".");
    if (reason === "API_KEY_SERVICE_BLOCKED") throw new Error("Google Maps server key does not allow this API. Enable it on the key's allowed-APIs list.");
  }
  throw new Error(`Google Maps error (${res.status}): ${body.slice(0, 200)}`);
}

export const geocodePlace = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GeocodeInput.parse(d))
  .handler(async ({ data }) => {
    const { lovable, gmaps } = requireKeys();
    const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": gmaps,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({ textQuery: data.query }),
    });
    if (!res.ok) await handleMapsError(res);
    const json = (await res.json()) as any;
    const p = json.places?.[0];
    if (!p) throw new Error(`No place found for "${data.query}".`);
    return {
      name: p.displayName?.text as string,
      address: p.formattedAddress as string,
      lat: p.location?.latitude as number,
      lng: p.location?.longitude as number,
    };
  });

export const getDirections = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DirectionsInput.parse(d))
  .handler(async ({ data }) => {
    const { lovable, gmaps } = requireKeys();
    const langMap = { en: "en-US", te: "te-IN", hi: "hi-IN" } as const;
    const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": gmaps,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.startLocation,routes.legs.steps.endLocation",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: data.originLat, longitude: data.originLng } } },
        destination: { address: data.destination },
        travelMode: data.mode,
        languageCode: langMap[data.language],
        units: "METRIC",
      }),
    });
    if (!res.ok) await handleMapsError(res);
    const json = (await res.json()) as any;
    const route = json.routes?.[0];
    if (!route) throw new Error("No route found.");
    const steps = (route.legs?.[0]?.steps ?? []).map((s: any) => ({
      text: s.navigationInstruction?.instructions ?? "",
      distanceMeters: s.distanceMeters ?? 0,
      endLat: s.endLocation?.latLng?.latitude,
      endLng: s.endLocation?.latLng?.longitude,
    })).filter((s: any) => s.text);
    return {
      polyline: route.polyline?.encodedPolyline as string,
      distanceMeters: route.distanceMeters as number,
      durationSeconds: Number(String(route.duration ?? "0s").replace("s", "")),
      steps,
    };
  });

const ReverseInput = z.object({ lat: z.number(), lng: z.number(), language: z.enum(["en", "te", "hi"]).default("en") });

export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ReverseInput.parse(d))
  .handler(async ({ data }) => {
    const { lovable, gmaps } = requireKeys();
    const langMap = { en: "en", te: "te", hi: "hi" } as const;
    const url = `${GATEWAY}/maps/api/geocode/json?latlng=${data.lat},${data.lng}&language=${langMap[data.language]}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": gmaps },
    });
    if (!res.ok) await handleMapsError(res);
    const json = (await res.json()) as any;
    const address = json.results?.[0]?.formatted_address as string | undefined;
    return { address: address ?? null };
  });

const _unusedDirections = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DirectionsInput.parse(d))
  .handler(async ({ data }) => {
    const { lovable, gmaps } = requireKeys();
    const langMap = { en: "en-US", te: "te-IN", hi: "hi-IN" } as const;
    const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": gmaps,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.startLocation,routes.legs.steps.endLocation",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: data.originLat, longitude: data.originLng } } },
        destination: { address: data.destination },
        travelMode: data.mode,
        languageCode: langMap[data.language],
        units: "METRIC",
      }),
    });
    if (!res.ok) await handleMapsError(res);
    const json = (await res.json()) as any;
    const route = json.routes?.[0];
    if (!route) throw new Error("No route found.");
    const steps = (route.legs?.[0]?.steps ?? []).map((s: any) => ({
      text: s.navigationInstruction?.instructions ?? "",
      distanceMeters: s.distanceMeters ?? 0,
      endLat: s.endLocation?.latLng?.latitude,
      endLng: s.endLocation?.latLng?.longitude,
    })).filter((s: any) => s.text);
    return {
      polyline: route.polyline?.encodedPolyline as string,
      distanceMeters: route.distanceMeters as number,
      durationSeconds: Number(String(route.duration ?? "0s").replace("s", "")),
      steps,
    };
  });