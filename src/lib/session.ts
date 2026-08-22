// Session + guest-mode store for Vision Companion.
// A user can be: signed in (has a profile → personal features), a guest, or
// "skipped" (same access as guest, just chose to decide later).
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  display_name: string;
  relation: string;
  face_images: string[];
};

const GUEST_KEY = "vision.guest";
const PROFILE_KEY = "vision.profile";

export function isGuest(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

export function setGuest(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(GUEST_KEY, "1");
    else window.localStorage.removeItem(GUEST_KEY);
  } catch { /* ignore */ }
}

/** Cached profile, readable synchronously (used by face recognition). */
export function cachedProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function cacheProfile(p: Profile | null) {
  if (typeof window === "undefined") return;
  try {
    if (p) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    else window.localStorage.removeItem(PROFILE_KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("vision:profileChanged", { detail: { profile: p } }));
}

export async function getSessionUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Loads (and creates on first login) the signed-in user's profile. */
export async function loadProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) {
    cacheProfile(null);
    return null;
  }
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, relation, face_images")
    .eq("id", user.id)
    .maybeSingle();

  if (data) {
    const p: Profile = {
      id: data.id,
      display_name: data.display_name,
      relation: data.relation,
      face_images: Array.isArray(data.face_images) ? (data.face_images as string[]) : [],
    };
    cacheProfile(p);
    return p;
  }

  const fallbackName =
    (user.user_metadata?.["full_name"] as string | undefined) ??
    (user.user_metadata?.["name"] as string | undefined) ??
    user.email?.split("@")[0] ??
    "Me";
  const fresh = { id: user.id, display_name: fallbackName, relation: "me", face_images: [] as string[] };
  await supabase.from("profiles").insert(fresh);
  cacheProfile(fresh);
  return fresh;
}

export async function saveProfile(patch: { display_name?: string; face_images?: string[] }) {
  const user = await getSessionUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("id, display_name, relation, face_images")
    .maybeSingle();
  if (!data) return null;
  const p: Profile = {
    id: data.id,
    display_name: data.display_name,
    relation: data.relation,
    face_images: Array.isArray(data.face_images) ? (data.face_images as string[]) : [],
  };
  cacheProfile(p);
  return p;
}

export async function signOut() {
  await supabase.auth.signOut();
  cacheProfile(null);
  setGuest(false);
}

export function onProfileChange(cb: (p: Profile | null) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const h = (e: Event) => cb((e as CustomEvent).detail.profile as Profile | null);
  window.addEventListener("vision:profileChanged", h);
  return () => window.removeEventListener("vision:profileChanged", h);
}
