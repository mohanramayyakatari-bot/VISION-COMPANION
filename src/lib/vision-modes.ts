// VisionModeManager — the single entry point for opening any Vision Companion
// mode. Tapping a card and saying a voice command both call `openMode()`, so
// the two interfaces can never drift apart.

import { say } from "@/lib/speech-manager";

export type Lang = "en" | "te" | "hi";

export type VisionMode =
  | "HOME" | "OBJECT_DETECTION" | "SCENE_UNDERSTANDING" | "OCR" | "CURRENCY"
  | "PRODUCT" | "COLOR" | "FACE" | "HAZARD" | "INDOOR_NAVIGATION"
  | "OUTDOOR_NAVIGATION" | "SIGN_BUS" | "EMERGENCY" | "SHOPPING" | "PEOPLE_MANAGER";

type ModeDef = {
  route: string;
  cameraMode?: string;   // camera.tsx mode id
  auto?: boolean;        // start the continuous loop on arrival
  say: Record<Lang, string>;
};

export const MODE_REGISTRY: Record<VisionMode, ModeDef> = {
  HOME: { route: "/", say: { en: "Going home.", te: "హోమ్‌కు వెళ్తున్నాను.", hi: "होम पर जा रहा हूँ।" } },
  OBJECT_DETECTION: { route: "/camera", cameraMode: "object", auto: true,
    say: { en: "Object detection is live.", te: "వస్తువుల గుర్తింపు ప్రారంభమైంది.", hi: "ऑब्जेक्ट डिटेक्शन चालू है।" } },
  SCENE_UNDERSTANDING: { route: "/camera", cameraMode: "scene", auto: true,
    say: { en: "Describing your surroundings.", te: "మీ చుట్టూ ఉన్నదాన్ని వివరిస్తున్నాను.", hi: "आपके आस-पास बता रहा हूँ।" } },
  OCR: { route: "/camera", cameraMode: "read",
    say: { en: "Reading text.", te: "వచనాన్ని చదువుతున్నాను.", hi: "पाठ पढ़ रहा हूँ।" } },
  CURRENCY: { route: "/camera", cameraMode: "currency",
    say: { en: "Checking the currency.", te: "కరెన్సీని పరిశీలిస్తున్నాను.", hi: "नोट पहचान रहा हूँ।" } },
  PRODUCT: { route: "/camera", cameraMode: "product",
    say: { en: "Reading the product label.", te: "ఉత్పత్తి లేబుల్ చదువుతున్నాను.", hi: "प्रोडक्ट लेबल पढ़ रहा हूँ।" } },
  SHOPPING: { route: "/camera", cameraMode: "product",
    say: { en: "Shopping assistant ready.", te: "షాపింగ్ సహాయకుడు సిద్ధం.", hi: "शॉपिंग सहायक तैयार है।" } },
  COLOR: { route: "/camera", cameraMode: "color",
    say: { en: "Identifying colors.", te: "రంగులను గుర్తిస్తున్నాను.", hi: "रंग पहचान रहा हूँ।" } },
  FACE: { route: "/camera", cameraMode: "face", auto: true,
    say: { en: "Looking for people you know.", te: "మీకు తెలిసిన వ్యక్తుల కోసం చూస్తున్నాను.", hi: "जान-पहचान के लोगों को देख रहा हूँ।" } },
  HAZARD: { route: "/camera", cameraMode: "safety", auto: true,
    say: { en: "Hazard watch is on.", te: "ప్రమాద పర్యవేక్షణ ప్రారంభమైంది.", hi: "खतरा निगरानी चालू है।" } },
  INDOOR_NAVIGATION: { route: "/camera", cameraMode: "navigate", auto: true,
    say: { en: "Indoor navigation started.", te: "లోపలి మార్గదర్శకం ప్రారంభమైంది.", hi: "इनडोर नेविगेशन शुरू।" } },
  SIGN_BUS: { route: "/camera", cameraMode: "read", auto: true,
    say: { en: "Reading signs and bus boards.", te: "సైన్ బోర్డులు చదువుతున్నాను.", hi: "साइन और बस बोर्ड पढ़ रहा हूँ।" } },
  OUTDOOR_NAVIGATION: { route: "/map",
    say: { en: "Outdoor navigation started.", te: "బాహ్య మార్గదర్శకం ప్రారంభమైంది.", hi: "आउटडोर नेविगेशन शुरू।" } },
  EMERGENCY: { route: "/emergency",
    say: { en: "Opening emergency mode.", te: "అత్యవసర మోడ్‌ను తెరుస్తున్నాను.", hi: "आपातकालीन मोड खोल रहा हूँ।" } },
  PEOPLE_MANAGER: { route: "/people",
    say: { en: "Opening people manager.", te: "వ్యక్తుల నిర్వహణను తెరుస్తున్నాను.", hi: "लोग प्रबंधन खोल रहा हूँ।" } },
};

export type NavigateFn = (opts: { to: any; search?: any }) => Promise<unknown> | void;

export interface OpenModeOptions {
  lang?: Lang;
  navigate?: NavigateFn;
  /** Extra search params (e.g. a navigation destination). */
  search?: Record<string, unknown>;
  /** Skip the spoken confirmation. */
  silent?: boolean;
}

/**
 * Opens a mode. If we are already on the target camera route, the mode is
 * switched in place over the SAME camera stream (no remount, models stay warm).
 */
export function openMode(mode: VisionMode, opts: OpenModeOptions = {}) {
  const def = MODE_REGISTRY[mode];
  if (!def) return;
  const lang = opts.lang ?? "en";
  if (!opts.silent) {
    say(def.say[lang], lang, mode === "EMERGENCY" ? "emergency" : "general", { force: true });
  }

  const onCamera = typeof window !== "undefined" && window.location.pathname === "/camera";
  if (def.route === "/camera" && onCamera) {
    window.dispatchEvent(new CustomEvent("vision:setMode", {
      detail: { mode: def.cameraMode ?? "scene", lang, auto: !!def.auto },
    }));
    return;
  }

  const search: Record<string, unknown> = { lang, ...(opts.search ?? {}) };
  if (def.cameraMode) search.mode = def.cameraMode;
  if (def.auto) search.auto = def.route === "/camera" ? "1" : true;

  if (opts.navigate) {
    void Promise.resolve(opts.navigate({ to: def.route, search })).catch?.(() => {});
    return;
  }
  if (typeof window !== "undefined") {
    const qs = new URLSearchParams(
      Object.entries(search).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
    ).toString();
    window.location.assign(`${def.route}${qs ? `?${qs}` : ""}`);
  }
}
