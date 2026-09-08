// Floating mobile bottom navigation with the glowing central Vision button.
// Hidden on immersive screens (camera, onboarding) where it would cover the
// live view.

import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, Clock, Settings, HelpCircle, Mic } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const HIDDEN_ON = ["/camera", "/auth"];

export function BottomNavigation() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t, lang } = useT();

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const item = (to: string, label: string, Icon: any) => {
    const active = pathname === to;
    return (
      <Link
        key={to}
        to={to}
        search={{ lang } as any}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 min-h-14 rounded-2xl text-[0.65rem] font-semibold",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <Icon className={cn("size-5", active && "text-primary-glow")} aria-hidden />
        <span className="truncate max-w-full">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("nav.label")}
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-md items-center gap-1 rounded-[1.75rem] glass-sheet px-2 py-2">
        {item("/", t("nav.home"), Home)}
        {item("/history", t("nav.history"), Clock)}

        <button
          onClick={() => navigate({ to: "/camera", search: { lang } as any })}
          aria-label={t("nav.vision")}
          className="relative -mt-8 grid size-16 shrink-0 place-items-center rounded-full bg-gradient-primary edge-glow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          <span className="absolute inset-0 rounded-full bg-primary/40 animate-pulse-ring" aria-hidden />
          <Mic className="relative size-7 text-primary-foreground" aria-hidden />
        </button>

        {item("/settings", t("nav.settings"), Settings)}
        {item("/help", t("nav.help"), HelpCircle)}
      </div>
    </nav>
  );
}
