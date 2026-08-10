// VoiceCommandRouter — converts free-form speech (English, Telugu, Hindi) into
// a VisionMode action. Intent matching is keyword/synonym based so natural
// phrasings ("take me outside", "who is around me") all resolve correctly.

import type { VisionMode } from "@/lib/vision-modes";

export type Intent =
  | { type: "MODE"; mode: VisionMode }
  | { type: "STOP" }
  | { type: "STOP_NAV" }
  | { type: "REPEAT" }
  | { type: "NAVIGATE_TO"; destination: string }
  | null;

type Rule = { mode: VisionMode; keys: string[] };

// Order matters: more specific intents first.
const RULES: Rule[] = [
  { mode: "OUTDOOR_NAVIGATION", keys: [
    "outdoor navigation", "outdoor nav", "navigate outside", "navigation outside", "take me outside",
    "outside navigation", "outdoor", "street navigation", "walk me", "walking directions",
    "బయటి మార్గం", "బయట నావిగేషన్", "बाहरी मार्ग", "बाहर नेविगेशन",
  ]},
  { mode: "INDOOR_NAVIGATION", keys: [
    "indoor navigation", "indoor nav", "navigate indoor", "inside navigation", "navigate inside",
    "indoor", "inside the room", "room navigation", "లోపలి మార్గం", "इनडोर", "अंदर नेविगेशन",
  ]},
  { mode: "FACE", keys: [
    "face recognition", "face recognise", "face recognize", "recognize people", "recognise people",
    "people detection", "detect people", "who is around", "who is there", "who is in front",
    "identify person", "identify people", "known faces", "face detect", "faces",
    "ముఖ గుర్తింపు", "ఎవరు ఉన్నారు", "చెహरा", "चेहरा पहचान", "कौन है", "लोग पहचान",
  ]},
  { mode: "PEOPLE_MANAGER", keys: [
    "manage people", "add person", "new person", "register face", "face manager", "people manager",
    "rename person", "delete person", "వ్యక్తుల నిర్వహణ", "लोग प्रबंधन", "व्यक्ति जोड़",
  ]},
  { mode: "OBJECT_DETECTION", keys: [
    "object detection", "detect object", "detect objects", "object mode", "what is this",
    "what's this", "identify object", "objects around", "వస్తువుల గుర్తింపు", "ఇది ఏమిటి",
    "वस्तु पहचान", "यह क्या है", "ऑब्जेक्ट",
  ]},
  { mode: "SCENE_UNDERSTANDING", keys: [
    "scene understanding", "describe scene", "describe surroundings", "what is around me",
    "where am i", "describe", "scene", "surroundings", "దృశ్యం", "చుట్టూ", "दृश्य", "आस-पास",
  ]},
  { mode: "SIGN_BUS", keys: [
    "sign board", "bus board", "bus number", "bus route", "platform number", "sign and bus",
    "బస్ నంబర్", "బస్ బోర్డ్", "बस नंबर", "बस बोर्ड", "साइन बोर्ड",
  ]},
  { mode: "OCR", keys: [
    "read text", "read this", "read it", "text reader", "ocr", "read the book", "read document",
    "scan document", "reading", "వచనం చదువు", "చదువు", "पाठ पढ़", "पढ़ो", "दस्तावेज़ स्कैन",
  ]},
  { mode: "CURRENCY", keys: [
    "currency", "money", "note", "rupee", "cash", "how much money", "కరెన్సీ", "డబ్బు", "नोट", "पैसे", "मुद्रा",
  ]},
  { mode: "SHOPPING", keys: [
    "shopping", "shopping assistant", "price", "mrp", "షాపింగ్", "ధర", "शॉपिंग", "कीमत",
  ]},
  { mode: "PRODUCT", keys: [
    "product", "product and price", "label", "medicine", "expiry", "barcode",
    "ఉత్పత్తి", "లేబుల్", "उत्पाद", "लेबल", "दवा",
  ]},
  { mode: "COLOR", keys: [
    "color detection", "colour detection", "color", "colour", "what colour", "what color",
    "రంగు", "रंग",
  ]},
  { mode: "HAZARD", keys: [
    "hazard", "danger", "safety", "is it safe", "can i walk", "obstacle",
    "ప్రమాదం", "సురక్షిత", "खतरा", "सुरक्षित", "बाधा",
  ]},
  { mode: "EMERGENCY", keys: [
    "emergency", "sos", "help me", "call for help", "emergency contact",
    "అత్యవసరం", "సహాయం", "आपातकाल", "मदद करो",
  ]},
  { mode: "HOME", keys: ["go home", "home screen", "main screen", "dashboard home"] },
];

// Verbs people naturally use before a mode name — stripped before matching so
// "start", "open", "i want", "switch to" all behave identically.
const OPEN_VERBS =
  /\b(please|can you|could you|hey vision|open|start|launch|switch to|go to|show|activate|enable|begin|i want|i need|turn on|use)\b/gi;

export function routeCommand(rawTranscript: string): Intent {
  const raw = (rawTranscript ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (/\b(stop navigation|cancel navigation|end navigation)\b|మార్గం ఆపు|नेविगेशन बंद/i.test(lower)) {
    return { type: "STOP_NAV" };
  }
  if (/^(stop|quiet|silence|mute|shut up)\b|\bstop talking\b|ఆపు|చుప్|चुप|बंद करो/i.test(lower)) {
    return { type: "STOP" };
  }
  if (/\b(repeat|say again|again)\b|మళ్లీ చెప్పు|फिर से/i.test(lower)) {
    return { type: "REPEAT" };
  }

  // "navigate to <place>" → real outdoor navigation with a destination.
  const dest = raw.match(
    /(?:navigate|take me|go|directions|guide me|తీసుకెళ్లు|ले चलो|ले जाओ)\s*(?:to\s+|కి\s+|కు\s+)?(.+)$/i,
  );
  if (dest?.[1]) {
    const place = dest[1].replace(/[.?!,]+$/, "").trim();
    // "take me outside" is a mode, not a destination.
    if (place && !/^(outside|outdoor|indoor|inside|home|back)$/i.test(place)) {
      return { type: "NAVIGATE_TO", destination: place };
    }
  }

  const cleaned = ` ${lower.replace(OPEN_VERBS, " ").replace(/\s+/g, " ").trim()} `;
  for (const rule of RULES) {
    if (rule.keys.some((k) => cleaned.includes(k.toLowerCase()))) {
      return { type: "MODE", mode: rule.mode };
    }
  }
  return null;
}
