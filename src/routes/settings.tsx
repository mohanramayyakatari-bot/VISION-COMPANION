import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Languages, Volume2, Square, Users, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { say, stopSpeaking } from "@/lib/speech-manager";
import { getLang, setLang as setGlobalLang, onLangChange, LANG_LABEL, type Lang } from "@/lib/language";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  validateSearch: (s: Record<string, unknown>) => ({
    lang: typeof s.lang === "string" ? (s.lang as Lang) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Settings — Vision Companion" },
      { name: "description", content: "Choose your language, manage spoken feedback and open your people and emergency settings by voice or touch." },
      { property: "og:title", content: "Settings — Vision Companion" },
      { property: "og:description", content: "Language, speech and accessibility settings for the Vision Companion voice assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const INTRO: Record<Lang, string> = {
  en: "Settings. Say change language to Hindi, English or Telugu. Say go back to return.",
  te: "సెట్టింగ్‌లు. భాషను మార్చడానికి తెలుగు, హిందీ లేదా ఇంగ్లీష్ అని చెప్పండి. వెనక్కి వెళ్లడానికి వెనక్కి అని చెప్పండి.",
  hi: "सेटिंग्स। भाषा बदलने के लिए हिंदी, अंग्रेज़ी या तेलुगु कहें। वापस जाने के लिए पीछे कहें।",
};

function SettingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [lang, setLangState] = useState<Lang>(search.lang ?? getLang());

  useEffect(() => {
    const initial: Lang = search.lang ?? getLang();
    if (search.lang) setGlobalLang(search.lang);
    say(INTRO[initial], initial, "general", { force: true });
    return onLangChange(setLangState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (l: Lang) => {
    setGlobalLang(l);
    setLangState(l);
    say(
      l === "te" ? "భాష తెలుగుకి మార్చాను." : l === "hi" ? "भाषा हिंदी में बदल दी गई है।" : "Language changed to English.",
      l, "general", { force: true },
    );
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" aria-label="Go back to the home screen">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <h1 className="text-sm font-semibold">Settings</h1>
        <span className="w-12" />
      </header>

      <main className="p-4 space-y-4 max-w-lg mx-auto">
        <section className="glass-card rounded-2xl p-4" aria-labelledby="lang-h">
          <h2 id="lang-h" className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Languages className="size-4 text-primary-glow" /> Language
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {(["en", "te", "hi"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => choose(l)}
                aria-pressed={lang === l}
                aria-label={`Set application language to ${LANG_LABEL[l]}`}
                className={`rounded-xl py-3 text-sm font-medium transition-all ${lang === l ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-foreground"}`}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Voice: “Hey Vision, change language to Hindi.”
          </p>
        </section>

        <section className="glass-card rounded-2xl p-4" aria-labelledby="speech-h">
          <h2 id="speech-h" className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Volume2 className="size-4 text-primary-glow" /> Speech
          </h2>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => say(INTRO[lang], lang, "general", { force: true })} aria-label="Test the spoken voice">
              <Volume2 className="size-4" /> Test voice
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => { stopSpeaking(); window.dispatchEvent(new CustomEvent("vision:stopSpeech")); }} aria-label="Stop all speech">
              <Square className="size-4" /> Stop speech
            </Button>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-4 space-y-2" aria-labelledby="more-h">
          <h2 id="more-h" className="text-sm font-semibold mb-1">More</h2>
          <Button variant="secondary" className="w-full justify-start" onClick={() => navigate({ to: "/people", search: { lang } as any })} aria-label="Open people and face memory">
            <Users className="size-4" /> People &amp; face memory
          </Button>
          <Button variant="secondary" className="w-full justify-start" onClick={() => navigate({ to: "/emergency", search: { lang } as any })} aria-label="Open emergency contacts">
            <Siren className="size-4" /> Emergency contacts
          </Button>
        </section>
      </main>
    </div>
  );
}
