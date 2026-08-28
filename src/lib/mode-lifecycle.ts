// ModeLifecycle — guarantees that exactly ONE Vision Companion mode is ever
// running. Every mode (camera modes, outdoor navigation, people manager,
// emergency, voice-driven modes) opens a *session* here. Opening a new session
// automatically tears the previous one down: timers, loops, listeners, camera
// tracks, pending API results and any in-flight speech.
//
// Modes do not talk to each other — they only register cleanup functions.

import { stopSpeaking } from "@/lib/speech-manager";
import { documentReader } from "@/lib/document-reader";

export type ModeSession = {
  /** Unique id for this run of the mode. */
  id: number;
  /** Name of the mode that owns the session. */
  name: string;
  /** False as soon as another mode (or the homepage) takes over. */
  readonly alive: boolean;
};

let counter = 0;
let activeId = 0;
let activeName: string | null = null;
let cleanups: Array<() => void> = [];

/** Current mode name, or null when nothing is running (e.g. the homepage). */
export function getActiveMode(): string | null {
  return activeName;
}

export function isSessionAlive(id: number): boolean {
  return id === activeId && activeId !== 0;
}

/**
 * Register a teardown callback for the *currently active* session. Returns an
 * unregister function so React effects can drop their own cleanup on unmount.
 */
export function registerCleanup(fn: () => void): () => void {
  cleanups.push(fn);
  return () => {
    cleanups = cleanups.filter((c) => c !== fn);
  };
}

/**
 * Fully stop whatever mode is currently running: run every registered cleanup,
 * cancel document reading and silence all queued/current speech so an old
 * announcement can never bleed into the next mode.
 */
export function stopActiveMode(reason = "switch") {
  const previous = activeName;
  // Invalidate the session first — late async callbacks check `isSessionAlive`
  // and become no-ops from this moment on.
  activeId = 0;
  activeName = null;

  const list = cleanups;
  cleanups = [];
  for (const fn of list) {
    try { fn(); } catch { /* one broken teardown must not block the rest */ }
  }

  try { documentReader.stop(true); } catch { /* ignore */ }
  stopSpeaking();

  if (typeof window !== "undefined" && previous) {
    window.dispatchEvent(
      new CustomEvent("vision:modeStopped", { detail: { mode: previous, reason } }),
    );
  }
}

/**
 * Start a mode. Any previously running mode is stopped and cleaned up first.
 * Returns a session handle; async work should bail out when `alive` is false.
 */
export function startMode(name: string): ModeSession {
  stopActiveMode(`start:${name}`);
  activeId = ++counter;
  activeName = name;
  const id = activeId;
  return {
    id,
    name,
    get alive() { return isSessionAlive(id); },
  };
}
