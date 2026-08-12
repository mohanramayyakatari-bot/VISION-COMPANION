import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Languages, Volume2, Square, Users, Siren,
  AlertCircle, AlertTriangle, CheckCircle2, ExternalLink, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { say, stopSpeaking } from "@/lib/speech-manager";
import { getLang, setLang as setGlobalLang, onLangChange, LANG_LABEL, type Lang } from "@/lib/language";
import { getCreditStatus, onCreditStatusChange, clearCreditStatus, type CreditStatus } from "@/lib/credit-status";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  validateSearch: (s: Record<string, unknown>) => ({
    lang: typeof s.lang === "string" ? (s.lang as Lang) : undefined,
    tab: typeof s.tab === "string" ? (s.tab as "language" | "speech" | "credits") : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Settings — Vision Companion" },
      { name: "description", content: "Choose your language, manage spoken feedback, credit status and open your people and emergency settings by voice or touch." },
      { property: "og:title", content: "Settings — Vision Companion" },
      { property: "og:description", content: "Language, speech, credit status and accessibility settings for the Vision Companion voice assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PLANS_URL = "https://docs.lovable.dev/introduction/plans-and-credits";

const STATUS_TEXT: Record<CreditStatus, Record<Lang, { title: string; body: string }>> = {
  ok: {
    en: { title: "AI service active", body: "You have AI credits available and the vision gateway is responding." },
    te: { title: "AI సేవా క్రియాశీలకంగా ఉంది", body: "మీకు AI క్రెడిట్లు అందుబాటులో ఉన్నాయి మరియు విజన్ గేట్వే స్పందిస్తోంది." },
    hi: { title: "AI सेवा सक्रिय है", body: "आपके पास AI क्रेडिट उपलब्ध हैं और विजन गेटवे प्रतिक्रिया दे रहा है।" },
  },
  rate_limit: {
    en: { title: "AI rate limit", body: "Requests are being throttled. The app will slow down automatically." },
    te: { title: "AI రేట్ పరిమితి", body: "అభ్యర్థనలు పరిమితం చేయబడ్డాయి. యాప్ స్వయంచాలకంగా నెమ్మదిస్తుంది." },
    hi: { title: "AI रेट सीमा", body: "अनुरोध थ्रॉटल किए जा रहे हैं। ऐप स्वचालित रूप से धीमा हो जाएगा।" },
  },
  no_credits: {
    en: { title: "AI credits exhausted", body: "Add credits to continue using live vision, navigation, and voice analysis." },
    te: { title: "AI క్రెడిట్లు అయిపోయాయి", body: "లైవ్ విజన్, నావిగేషన్ మరియు వాయిస్ విశ్లేషణను కొనసాగించడానికి క్రెడిట్లు జోడించండి." },
    hi: { title: "AI क्रेडिट समाप्त", body: "लाइव विजन, नेविगेशन और वॉयस विश्लेषण का उपयोग जारी रखने के लिए क्रेडिट जोड़ें।" },
  },
};

const INTRO: Record<Lang, string> = {
  en: "Settings. Say change language to Hindi, English or Telugu. Say go back to return.",
  te: "సెట్టింగ్‌లు. భాషను మార్చడానికి తెలుగు, హిందీ లేదా ఇంగ్లీష్ అని చెప్పండి. వెనక్కి వెళ్లడానికి వెనక్కి అని చెప్పండి.",
  hi: "सेटिंग्स। भाषा बदलने के लिए हिंदी, अंग्रेज़ी या तेलुगु कहें। वापस जाने के लिए पीछे कहें।",
};

function SettingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [lang, setLangState] = useState<Lang>(search.lang ?? getLang());
  const [status, setStatus] = useState<CreditStatus>("ok");
  const creditsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const initial: Lang = search.lang ?? getLang();
    if (search.lang) setGlobalLang(search.lang);
    say(INTRO[initial], initial, "general", { force: true });
    return onLangChange(setLangState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setStatus(getCreditStatus());
    return onCreditStatusChange((s) => setStatus(s));
  }, []);

  useEffect(() => {
    if (search.tab === "credits" && creditsRef.current) {
      creditsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [search.tab]);

  const isIssue = status === "rate_limit" || status === "no_credits";
  const statusText = STATUS_TEXT[status][lang];
  const StatusIcon = status === "ok" ? CheckCircle2 : status === "rate_limit" ? AlertTriangle : AlertCircle;
  const statusClass = status === "ok" ? "text-success" : status === "rate_limit" ? "text-warning" : "text-destructive";

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

        <section
          ref={creditsRef as any}
          className="glass-card rounded-2xl p-4 space-y-3"
          aria-labelledby="credits-h"
        >
          <h2 id="credits-h" className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="size-4 text-primary-glow" /> AI Credits &amp; Status
          </h2>

          <div className={`flex items-start gap-3 rounded-xl p-3 border border-border ${status === "no_credits" ? "bg-destructive/10" : status === "rate_limit" ? "bg-warning/10" : "bg-secondary/50"}`}>
            <StatusIcon className={`size-5 shrink-0 ${statusClass}`} aria-hidden />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${statusClass}`}>{statusText.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{statusText.body}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href={PLANS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary text-primary-foreground px-4 py-3 text-sm font-semibold shadow-glow hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="size-4" />
              {lang === "te" ? "ప్లాన్‌లు & క్రెడిట్లు" : lang === "hi" ? "प्लान और क्रेडिट" : "Plans & credits"}
            </a>
            {isIssue && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  clearCreditStatus();
                  say(
                    lang === "te" ? "AI స్థితిని తిరిగి పరిశీలిస్తున్నాను."
                      : lang === "hi" ? "AI स्थिति फिर से जाँच रहा हूँ।"
                      : "Rechecking AI credit status.",
                    lang, "general", { force: true },
                  );
                }}
                aria-label="Recheck AI credit status"
              >
                <RefreshCw className="size-4" /> Recheck status
              </Button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
