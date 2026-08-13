import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react";
import {
  getCreditStatus,
  getCreditStatusAt,
  onCreditStatusChange,
  type CreditStatus,
} from "@/lib/credit-status";
import { getLang } from "@/lib/language";
import { say } from "@/lib/speech-manager";

type Lang = "en" | "te" | "hi";

const MESSAGES: Record<
  CreditStatus,
  Record<Lang, { line: string; label: string }>
> = {
  ok: {
    en: { line: "AI service is active.", label: "AI active" },
    te: { line: "AI సేవా క్రియాశీలకంగా ఉంది.", label: "AI సక్రియం" },
    hi: { line: "AI सेवा सक्रिय है।", label: "AI सक्रिय" },
  },
  rate_limit: {
    en: {
      line: "AI is being rate-limited. Requests are slowing down.",
      label: "Rate limit",
    },
    te: {
      line: "AI రేట్ పరిమితికి చేరుకుంది. అభ్యర్థనలు నెమ్మదిస్తున్నాయి.",
      label: "రేట్ పరిమితి",
    },
    hi: {
      line: "AI रेट सीमा तक पहुँच गया है। अनुरोध धीमे हो रहे हैं।",
      label: "रेट सीमा",
    },
  },
  no_credits: {
    en: {
      line: "AI credits are exhausted. Add credits to continue.",
      label: "Credits exhausted",
    },
    te: {
      line: "AI క్రెడిట్లు అయిపోయాయి. కొనసాగించడానికి క్రెడిట్లు జోడించండి.",
      label: "క్రెడిట్లు ముగిశాయి",
    },
    hi: {
      line: "AI क्रेडिट समाप्त हो गए हैं। जारी रखने के लिए क्रेडिट जोड़ें।",
      label: "क्रेडिट समाप्त",
    },
  },
};

export function CreditBanner() {
  const [status, setStatus] = useState<CreditStatus>("ok");
  const [lastAt, setLastAt] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const timeLabel = useMemo(() => {
    if (!lastAt) return "";
    const diff = Math.max(0, Math.floor((now - lastAt) / 1000));
    if (diff < 60) return "Updated just now";
    if (diff < 3600) return `Updated ${Math.floor(diff / 60)}m ago`;
    return `Updated at ${new Date(lastAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }, [lastAt, now]);

  useEffect(() => {
    setMounted(true);
    setStatus(getCreditStatus());
    setLastAt(getCreditStatusAt());
    return onCreditStatusChange((s, at) => {
      setStatus(s);
      setLastAt(at);
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
    say(MESSAGES[status][lang].line, lang, "general", { force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, mounted]);

  // No banner at all during SSR: this avoids hydration mismatches and keeps the
  // default UI clean while credits are OK.
  if (!mounted) return null;

  // Rate-limit notice can be dismissed; no-credits stays visible until resolved.
  if (dismissed && status === "rate_limit") return null;

  const isIssue = status === "rate_limit" || status === "no_credits";
  const lang = getLang();
  const msg = MESSAGES[status][lang];

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
      aria-label={msg.label}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="text-sm font-semibold truncate">{msg.label}</span>
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
              Plans &amp; credits
            </Link>
          )}
          {status === "rate_limit" && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10"
              aria-label="Dismiss rate limit notice"
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
