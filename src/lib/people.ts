import { cachedProfile } from "@/lib/session";

export type Person = { id: string; name: string; relation?: string; file: string };
export type CustomPerson = {
  id: string;
  name: string;
  relation?: string;
  images: string[]; // data URLs (multiple angles)
  createdAt: number;
  updatedAt: number;
  recognizedCount?: number;
};

const STORE_KEY = "vision.people.v1";
const OVERRIDE_KEY = "vision.people.overrides.v1";

export const PEOPLE: Person[] = [
  { id: "akhil", name: "Akhil", relation: "friend", file: "/people/akhil.jpeg" },
  { id: "pradeep", name: "Pradeep", relation: "friend", file: "/people/pradeep.jpeg" },
  { id: "akash", name: "Akash", relation: "friend", file: "/people/akash.jpeg" },
  { id: "sivanagu", name: "Siva Nagu", relation: "friend", file: "/people/sivanagu.jpeg" },
  { id: "ramteja", name: "Ramteja", relation: "friend", file: "/people/ramteja.jpeg" },
  { id: "murali", name: "Murali", relation: "friend", file: "/people/murali.jpeg" },
  { id: "ramayya", name: "Ramayya", relation: "friend", file: "/people/ramayya.jpeg" },
];

export function peopleRefsForOrigin(origin: string) {
  return PEOPLE.map((p) => ({ name: p.name, url: `${origin}${p.file}` }));
}

/* ---------- local (editable) face database ---------- */

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
  cachedRefs = null;
  window.dispatchEvent(new CustomEvent("vision:peopleChanged"));
}

export function listCustomPeople(): CustomPerson[] {
  return readJSON<CustomPerson[]>(STORE_KEY, []);
}

/** { [builtinId]: { name?, deleted?, images? } } */
type Overrides = Record<string, { name?: string; relation?: string; deleted?: boolean; images?: string[] }>;

export function listOverrides(): Overrides {
  return readJSON<Overrides>(OVERRIDE_KEY, {});
}

export type MergedPerson = {
  id: string;
  name: string;
  relation?: string;
  builtin: boolean;
  file?: string;
  images: string[];
  updatedAt?: number;
};

export function listAllPeople(): MergedPerson[] {
  const ov = listOverrides();
  const builtins: MergedPerson[] = PEOPLE.filter((p) => !ov[p.id]?.deleted).map((p) => ({
    id: p.id,
    name: ov[p.id]?.name ?? p.name,
    relation: ov[p.id]?.relation ?? p.relation,
    builtin: true,
    file: p.file,
    images: ov[p.id]?.images ?? [],
  }));
  const custom: MergedPerson[] = listCustomPeople().map((p) => ({
    id: p.id,
    name: p.name,
    relation: p.relation,
    builtin: false,
    images: p.images,
    updatedAt: p.updatedAt,
  }));
  return [...builtins, ...custom];
}

export function addPerson(name: string, images: string[], relation?: string): CustomPerson {
  const now = Date.now();
  const person: CustomPerson = {
    id: `p_${now}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    relation,
    images,
    createdAt: now,
    updatedAt: now,
  };
  writeJSON(STORE_KEY, [...listCustomPeople(), person]);
  return person;
}

export function updatePerson(
  id: string,
  patch: { name?: string; relation?: string; images?: string[]; addImages?: string[] },
) {
  const custom = listCustomPeople();
  const idx = custom.findIndex((p) => p.id === id);
  if (idx >= 0) {
    const p = custom[idx]!;
    custom[idx] = {
      ...p,
      name: patch.name?.trim() || p.name,
      relation: patch.relation ?? p.relation,
      images: patch.images ?? (patch.addImages ? [...p.images, ...patch.addImages] : p.images),
      updatedAt: Date.now(),
    };
    writeJSON(STORE_KEY, custom);
    return;
  }
  // built-in person → store an override
  const ov = listOverrides();
  const prev = ov[id] ?? {};
  ov[id] = {
    ...prev,
    name: patch.name?.trim() || prev.name,
    relation: patch.relation ?? prev.relation,
    images: patch.images ?? (patch.addImages ? [...(prev.images ?? []), ...patch.addImages] : prev.images),
  };
  writeJSON(OVERRIDE_KEY, ov);
}

export function deletePerson(id: string) {
  const custom = listCustomPeople();
  if (custom.some((p) => p.id === id)) {
    writeJSON(STORE_KEY, custom.filter((p) => p.id !== id));
    return;
  }
  const ov = listOverrides();
  ov[id] = { ...(ov[id] ?? {}), deleted: true };
  writeJSON(OVERRIDE_KEY, ov);
}

export function findPersonByName(q: string): MergedPerson | undefined {
  const n = q.trim().toLowerCase();
  return listAllPeople().find((p) => p.name.toLowerCase().includes(n));
}

let cachedRefs: Array<{ name: string; url: string }> | null = null;

export function clearPeopleCache() {
  cachedRefs = null;
}

export async function loadPeopleRefsAsDataUrls() {
  if (cachedRefs) return cachedRefs;
  const out: Array<{ name: string; url: string }> = [];
  // The signed-in user's own registered profile photos: recognized by their
  // registered name instead of "unknown".
  const me = cachedProfile();
  if (me?.display_name && me.face_images?.length) {
    for (const img of me.face_images.slice(0, 3)) out.push({ name: me.display_name, url: img });
  }
  for (const p of listAllPeople()) {
    // locally captured images take priority (they are already data URLs)
    if (p.images.length) {
      for (const img of p.images.slice(0, 3)) out.push({ name: p.name, url: img });
      if (!p.file) continue;
    }
    if (!p.file) continue;
    try {
      const res = await fetch(p.file);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) continue;
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      out.push({ name: p.name, url: dataUrl });
    } catch { /* skip */ }
  }
  cachedRefs = out;
  return out;
}