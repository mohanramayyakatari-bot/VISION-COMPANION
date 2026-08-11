// Central Command Manager.
// Voice input → intent (voice-router) → THIS manager → real application action
// → UI/state update → spoken confirmation. Every screen routes through here so
// new commands only ever need to be added in one place.

import { say, stopSpeaking } from "@/lib/speech-manager";
import { openMode, MODE_REGISTRY } from "@/lib/vision-modes";
import { documentReader } from "@/lib/document-reader";
import { getLang, setLang, LANG_LABEL, type Lang } from "@/lib/language";
import type { Intent } from "@/lib/voice-router";
import type { NavigateFn } from "@/lib/vision-modes";

export type CommandContext = {
  navigate: NavigateFn;
  lang: Lang;
};

const M = {
  back: { en: "Going back.", te: "వెనక్కి వెళ్తున్నాను.", hi: "पीछे जा रहा हूँ।" },
  home: { en: "Going to the home screen.", te: "హోమ్ స్క్రీన్‌కు వెళ్తున్నాను.", hi: "होम स्क्रीन पर जा रहा हूँ।" },
  settings: { en: "Opening settings.", te: "సెట్టింగ్‌లను తెరుస్తున్నాను.", hi: "सेटिंग्स खोल रहा हूँ।" },
  cameraOn: { en: "Turning the camera on.", te: "కెమెరాను ఆన్ చేస్తున్నాను.", hi: "कैमरा चालू कर रहा हूँ।" },
  cameraOff: { en: "Turning the camera off.", te: "కెమెరాను ఆపుతున్నాను.", hi: "कैमरा बंद कर रहा हूँ।" },
  closed: { en: "Closing this mode.", te: "ఈ మోడ్‌ను మూసివేస్తున్నాను.", hi: "यह मोड बंद कर रहा हूँ।" },
  langSwitched: {
    en: "Language changed to English.",
    te: "భాష తెలుగుకి మార్చాను.",
    hi: "भाषा हिंदी में बदल दी गई है।",
  } as Record<Lang, string>,
  help: {
    en: "You can say: open object detection, describe the scene, who is in front of me, read this, read the next page, pause reading, continue, change language to Hindi, go back, go home, open settings, turn off the camera, or emergency.",
    te: "మీరు ఇలా చెప్పవచ్చు: వస్తువుల గుర్తింపు తెరువు, దృశ్యాన్ని వివరించు, ఎవరు ఉన్నారు, ఇది చదువు, తదుపరి పేజీ చదువు, చదవడం ఆపు, కొనసాగించు, భాష మార్చు, వెనక్కి వెళ్లు, హోమ్‌కు వెళ్లు, సెట్టింగ్‌లు తెరువు, కెమెరా ఆపు, అత్యవసరం.",
    hi: "आप कह सकते हैं: ऑब्जेक्ट डिटेक्शन खोलो, दृश्य बताओ, सामने कौन है, यह पढ़ो, अगला पेज पढ़ो, पढ़ना रोको, जारी रखो, भाषा बदलो, पीछे जाओ, होम जाओ, सेटिंग्स खोलो, कैमरा बंद करो, आपातकाल।",
  },
  reading: { en: "Starting to read.", te: "చదవడం ప్రారంభిస్తున్నాను.", hi: "पढ़ना शुरू कर रहा हूँ।" },
  navTo: {
    en: (d: string) => `Opening walking directions to ${d}.`,
    te: (d: string) => `${d} కు నడక మార్గదర్శకాన్ని తెరుస్తున్నాను.`,
    hi: (d: string) => `${d} तक पैदल दिशा-निर्देश खोल रहा हूँ।`,
  },
};

function emit(name: string, detail?: unknown) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

const onCameraRoute = () =>
  typeof window !== "undefined" && window.location.pathname === "/camera";

/**
 * Executes an intent as a real application action.
 * Returns a short label describing what happened (for the UI transcript panel).
 */
export function executeIntent(intent: Intent, ctx: CommandContext): string | null {
  if (!intent) return null;
  const lang = ctx.lang ?? getLang();

  switch (intent.type) {
    case "STOP":
      stopSpeaking();
      emit("vision:stopSpeech");
      return "Stopped speaking";

    case "STOP_NAV":
      emit("vision:stopNav");
      return "Navigation stopped";

    case "REPEAT":
      if (documentReader.isActive) { documentReader.repeat(); return "Repeating section"; }
      emit("vision:repeat");
      emit("vision:repeatNav");
      return "Repeating";

    case "SET_LANG": {
      setLang(intent.lang);
      say(M.langSwitched[intent.lang], intent.lang, "general", { force: true });
      documentReader.setLang(intent.lang);
      emit("vision:setMode", { lang: intent.lang });
      return `Language → ${LANG_LABEL[intent.lang]}`;
    }

    case "HOME":
      say(M.home[lang], lang, "general", { force: true });
      void ctx.navigate({ to: "/", search: { lang } });
      return "Home";

    case "BACK":
      say(M.back[lang], lang, "general", { force: true });
      if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
      else void ctx.navigate({ to: "/", search: { lang } });
      return "Back";

    case "SETTINGS":
      say(M.settings[lang], lang, "general", { force: true });
      void ctx.navigate({ to: "/settings", search: { lang } });
      return "Settings";

    case "HELP":
      say(M.help[lang], lang, "general", { force: true });
      return "Help";

    case "CAMERA_ON":
      say(M.cameraOn[lang], lang, "general", { force: true });
      if (onCameraRoute()) emit("vision:cameraPower", { on: true });
      else void ctx.navigate({ to: "/camera", search: { lang } });
      return "Camera on";

    case "CAMERA_OFF":
      say(M.cameraOff[lang], lang, "general", { force: true });
      emit("vision:cameraPower", { on: false });
      return "Camera off";

    case "CLOSE_MODE":
      documentReader.stop(true);
      stopSpeaking();
      say(M.closed[lang], lang, "general", { force: true });
      emit("vision:closeMode");
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        void ctx.navigate({ to: "/", search: { lang } });
      }
      return "Mode closed";

    case "READ_START":
      if (onCameraRoute()) {
        emit("vision:setMode", { mode: "read", lang, auto: false });
        emit("vision:readDocument");
      } else {
        openMode("OCR", { lang, navigate: ctx.navigate, silent: true });
      }
      say(M.reading[lang], lang, "ocr", { force: true });
      return "Reading document";

    case "READ_NEXT":
      documentReader.next();
      return "Next section";

    case "READ_PREV":
      documentReader.previous();
      return "Previous section";

    case "READ_PAUSE":
      documentReader.pause();
      emit("vision:pauseSpeech");
      return "Paused";

    case "READ_RESUME":
      documentReader.resume();
      emit("vision:resumeSpeech");
      return "Continuing";

    case "READ_STOP":
      documentReader.stop();
      return "Stopped reading";

    case "NAVIGATE_TO":
      say(M.navTo[lang](intent.destination), lang, "navigation", { force: true });
      void ctx.navigate({ to: "/map", search: { dest: intent.destination, lang, auto: true } });
      return `Navigate → ${intent.destination}`;

    case "MODE":
      openMode(intent.mode, { lang, navigate: ctx.navigate });
      return `${intent.mode} — ${MODE_REGISTRY[intent.mode].say[lang]}`;

    default:
      return null;
  }
}
