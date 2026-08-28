import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react";
import {
  getCreditStatus,
  getCreditStatusAt,
  onCreditStatusChange,
  type CreditStatus,
} from "@/lib/credit-status";
import { getLang } from "@/lib/language";
import { useT, tr } from "@/lib/i18n";
import { say } from "@/lib/speech-manager";

export function CreditBanner() {
  const { t } = useT();
  const [status, setStatus] = useState<CreditStatus>("ok");
  const [lastAt, setLastAt] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const timeLabel = useMemo(() => {
    if (!lastAt) return "";
    const diff = Math.max(0, Math.floor((now - lastAt) / 1000));
    if (diff < 60) return t("credit.updatedNow");
    if (diff < 3600) return t("credit.updatedMin", { n: Math.floor(diff / 60) });
    return t("credit.updatedAt", {
      time: new Date(lastAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }, [lastAt, now, t]);

  useEffect(() => {
    setMounted(true);
    setStatus(getCreditStatus());
    setLastAt(getCreditStatusAt() || Date.now());
    return onCreditStatusChange((s, at) => {
      setStatus(s);
      setLastAt(at || Date.now());
      setDismissed(false);
    });
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  // Announce status changes to screen-reader users and visually impaired users.
  useEffect(() => {
    if (!mounted || status === "ok") return;
    const lang = getLang();
    say(tr(`credit.${status}.line`, undefined, lang), lang, "general", { force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, mounted]);

  // No banner at all during SSR: this avoids hydration mismatches and keeps the
  // default UI clean while credits are OK.
  if (!mounted) return null;

  // Rate-limit notice can be dismissed; no-credits stays visible until resolved.
  if (dismissed && status === "rate_limit") return null;

  const isIssue = status === "rate_limit" || status === "no_credits";
  const msg = { label: t(`credit.${status}.label`), line: t(`credit.${status}.line`) };

  const statusClass =
    status === "ok"
      ? "bg-success/20 text-success border-success/30"
      : status === "rate_limit"
        ? "bg-warning/25 text-warning border-warning/40"
        : "bg-destructive/25 text-destructive-foreground border-destructive/40";

  const Icon =
    status === "ok"
      ? CheckCircle2
      : status === "rate_limit"
        ? AlertTriangle
        : AlertCircle;

  return (
    <div
      className={`sticky top-0 z-50 ${statusClass} border-b px-4 py-2.5 backdrop-blur-md`}
      role="status"
      aria-live="polite"
      aria-label={timeLabel ? `${msg.label} — ${timeLabel}` : msg.label}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="text-sm font-semibold truncate">{msg.label}</span>
          {timeLabel && (
            <span className="text-xs opacity-75 hidden sm:inline">
              · {timeLabel}
            </span>
          )}
          {isIssue && (
            <span className="text-xs opacity-90 hidden sm:inline">
              — {msg.line}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isIssue && (
            <Link
              to="/settings"
              search={{ tab: "credits" } as any}
              className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
            >
              {t("common.plansCredits")}
            </Link>
          )}
          {status === "rate_limit" && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10"
              aria-label={t("credit.dismiss")}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {/* Visually hidden full text for screen readers on small screens. */}
        {isIssue && (
          <span className="sr-only">{msg.line}</span>
        )}
      </div>
    </div>
  );
}
