// Lightweight local activity history. Every mode the user opens (by tap or by
// voice) is appended here so the History screen can show a timeline.
// Stored on the device only — nothing is uploaded.

export type HistoryItem = {
  id: string;
  /** i18n key for the mode/activity label, e.g. "modes.ocr". */
  labelKey: string;
  /** Optional free-text detail (destination, result summary…). */
  detail?: string;
  at: number;
};

const KEY = "vision.history";
const MAX = 60;

export function listHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function logActivity(labelKey: string, detail?: string) {
  if (typeof window === "undefined") return;
  const list = listHistory();
  const last = list[0];
  // Don't spam the timeline when the same mode reopens within a minute.
  if (last && last.labelKey === labelKey && Date.now() - last.at < 60_000) return;
  const item: HistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    labelKey,
    detail,
    at: Date.now(),
  };
  const next = [item, ...list].slice(0, MAX);
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("vision:historyChanged"));
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("vision:historyChanged"));
}

/** "2 minutes ago" style label, localized through Intl. */
export function relativeTime(at: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diff = Math.round((at - Date.now()) / 1000);
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
