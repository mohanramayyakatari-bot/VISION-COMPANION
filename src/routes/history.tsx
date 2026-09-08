import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { GlassCard, GlassButton, SpatialBackdrop } from "@/components/spatial";
import { clearHistory, listHistory, relativeTime, type HistoryItem } from "@/lib/history";

export const Route = createFileRoute("/history")({
  validateSearch: (s: Record<string, unknown>) => ({
    lang: typeof s.lang === "string" ? s.lang : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Activity History — Vision Companion" },
      { name: "description", content: "A private timeline of the Vision Companion modes you used recently: reading text, object detection, currency, scenes and navigation." },
      { property: "og:title", content: "Activity History — Vision Companion" },
      { property: "og:description", content: "See which AI modes you used and when, stored privately on your device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const LOCALE: Record<string, string> = { en: "en-US", te: "te-IN", hi: "hi-IN" };

function HistoryPage() {
  const { t, lang } = useT();
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const refresh = () => setItems(listHistory());
    refresh();
    window.addEventListener("vision:historyChanged", refresh);
    return () => window.removeEventListener("vision:historyChanged", refresh);
  }, []);

  return (
    <div className="min-h-dvh">
      <SpatialBackdrop />
      <header className="sticky top-0 z-30 glass-sheet">
        <div className="mx-auto flex h-16 max-w-md items-center gap-3 px-4">
          <Link to="/" aria-label={t("common.home")} className="grid size-11 place-items-center rounded-full glass-panel">
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="text-lg font-bold">{t("history.title")}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-5 pb-nav space-y-4">
        <p className="text-sm text-muted-foreground">{t("history.sub")}</p>

        {items.length === 0 ? (
          <GlassCard className="p-6 text-center text-sm text-muted-foreground">
            {t("history.empty")}
          </GlassCard>
        ) : (
          <>
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id}>
                  <GlassCard className="flex items-center gap-3 rounded-2xl p-4 animate-rise">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-primary">
                      <Clock className="size-5 text-primary-foreground" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{t(it.labelKey)}</span>
                      {it.detail && (
                        <span className="block truncate text-xs text-muted-foreground">{it.detail}</span>
                      )}
                    </span>
                    <time
                      dateTime={new Date(it.at).toISOString()}
                      className="shrink-0 text-xs text-muted-foreground"
                    >
                      {relativeTime(it.at, LOCALE[lang] ?? "en-US")}
                    </time>
                  </GlassCard>
                </li>
              ))}
            </ul>
            <GlassButton onClick={() => clearHistory()} className="w-full" aria-label={t("history.clear")}>
              <Trash2 className="size-5" aria-hidden /> {t("history.clear")}
            </GlassButton>
          </>
        )}
      </main>
    </div>
  );
}
