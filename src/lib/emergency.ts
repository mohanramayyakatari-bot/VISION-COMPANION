export type Contact = {
  id: string;
  name: string;
  phone: string;
  priority: number;
  lastStatus?: "sent" | "failed" | "pending";
  lastSentAt?: number;
};

const KEY = "vision.emergency.contacts.v1";

function read(): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Contact[]) : [];
    return list.sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  }
}

function write(list: Contact[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* quota */ }
  window.dispatchEvent(new CustomEvent("vision:contactsChanged"));
}

export function listContacts() {
  return read();
}

export function addContact(name: string, phone: string): Contact {
  const list = read();
  const c: Contact = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    phone: phone.replace(/\s+/g, ""),
    priority: list.length,
  };
  write([...list, c]);
  return c;
}

export function updateContact(id: string, patch: Partial<Omit<Contact, "id">>) {
  write(read().map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

export function deleteContact(id: string) {
  write(read().filter((c) => c.id !== id));
}

export function moveContact(id: string, dir: -1 | 1) {
  const list = read();
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const a = list[i]!;
  const b = list[j]!;
  list[i] = b;
  list[j] = a;
  write(list.map((c, idx) => ({ ...c, priority: idx })));
}

export function findContactByName(q: string) {
  const n = q.trim().toLowerCase();
  return read().find((c) => c.name.toLowerCase().includes(n));
}

export function buildAlertMessage(opts: {
  lat: number;
  lng: number;
  address?: string | null;
  lang: "en" | "te" | "hi";
}) {
  const link = `https://maps.google.com/?q=${opts.lat},${opts.lng}`;
  const time = new Date().toLocaleString();
  const head: Record<string, string> = {
    en: "Emergency Alert! I may need immediate assistance.",
    te: "అత్యవసర హెచ్చరిక! నాకు వెంటనే సహాయం కావాలి.",
    hi: "आपातकालीन अलर्ट! मुझे तुरंत मदद चाहिए।",
  };
  return [
    head[opts.lang],
    opts.address ? `Address: ${opts.address}` : null,
    `Location: ${link}`,
    `Lat/Lng: ${opts.lat.toFixed(6)}, ${opts.lng.toFixed(6)}`,
    `Time: ${time}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function smsHref(phone: string, body: string) {
  const isIOS = typeof navigator !== "undefined" && /iP(hone|ad|od)/.test(navigator.userAgent);
  return `sms:${phone}${isIOS ? "&" : "?"}body=${encodeURIComponent(body)}`;
}