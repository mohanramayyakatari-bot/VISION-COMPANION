export type CreditStatus = "ok" | "rate_limit" | "no_credits";

type StoredStatus = { status: CreditStatus; at: number };

const KEY = "vision.creditStatus.v1";
const EVENT = "vision:creditStatusChanged";

let current: CreditStatus = "ok";
let lastAt = 0;

function readStored(): CreditStatus | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredStatus;
    if (
      parsed.status === "ok" ||
      parsed.status === "rate_limit" ||
      parsed.status === "no_credits"
    ) {
      return parsed.status;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStored(status: CreditStatus) {
  if (typeof window === "undefined") return;
  try {
    lastAt = Date.now();
    window.localStorage.setItem(KEY, JSON.stringify({ status, at: lastAt }));
  } catch {
    /* ignore */
  }
}

function emit(status: CreditStatus) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(EVENT, { detail: { status, at: lastAt } })
  );
}

export function getCreditStatus(): CreditStatus {
  return current;
}

export function setCreditStatus(status: CreditStatus) {
  if (current === status) return;
  current = status;
  writeStored(status);
  emit(status);
}

export function clearCreditStatus() {
  setCreditStatus("ok");
}

export function onCreditStatusChange(
  cb: (status: CreditStatus, at: number) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const h = (e: Event) => {
    const d = (e as CustomEvent).detail as StoredStatus;
    cb(d.status, d.at);
  };
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

// Initialize from the last stored value on the client so the banner reflects the
// real state immediately after a page reload.
if (typeof window !== "undefined") {
  const saved = readStored();
  if (saved) current = saved;
}
