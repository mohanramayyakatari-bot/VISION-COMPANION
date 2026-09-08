import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mic } from "lucide-react";
import { useT } from "@/lib/i18n";
import { GlassCard, SpatialBackdrop } from "@/components/spatial";

export const Route = createFileRoute("/help")({
  validateSearch: (s: Record<string, unknown>) => ({
    lang: typeof s.lang === "string" ? s.lang : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Voice Commands Help — Vision Companion" },
      { name: "description", content: "Every Vision Companion voice command: open object detection, read this, describe my surroundings, take me to a place, change language, and emergency." },
      { property: "og:title", content: "Voice Commands Help — Vision Companion" },
      { property: "og:description", content: "Learn what to say after Hey Vision to control every mode hands-free." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const COMMANDS = [
  "Open object detection",
  "Describe my surroundings",
  "Read this",
  "How much money is this",
  "Who is in front of me",
  "Detect hazards",
  "Take me to Vijayawada",
  "Change language to Telugu",
  "Go back / Go home / Close",
  "Emergency",
];

function HelpPage() {
  const { t } = useT();
  return (
    <div className="min-h-dvh">
      <SpatialBackdrop />
      <header className="sticky top-0 z-30 glass-sheet">
        <div className="mx-auto flex h-16 max-w-md items-center gap-3 px-4">
          <Link to="/" aria-label={t("common.home")} className="grid size-11 place-items-center rounded-full glass-panel">
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="text-lg font-bold">{t("help.title")}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-5 pb-nav space-y-4">
        <p className="text-sm text-muted-foreground">{t("help.sub")}</p>
        <ul className="space-y-2">
          {COMMANDS.map((c) => (
            <li key={c}>
              <GlassCard className="flex items-center gap-3 rounded-2xl p-4">
                <Mic className="size-5 shrink-0 text-primary-glow" aria-hidden />
                <span className="font-medium">“{c}”</span>
              </GlassCard>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("help.privacy")}</p>
      </main>
    </div>
  );
}
