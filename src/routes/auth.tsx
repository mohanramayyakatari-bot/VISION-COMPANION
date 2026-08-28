import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, LogIn, UserRound, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { loadProfile, setGuest, getSessionUser } from "@/lib/session";
import { say } from "@/lib/speech-manager";
import { getLang, onLangChange, t } from "@/lib/language";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Welcome to Vision Companion — Sign in or continue as guest" },
      { name: "description", content: "Sign in to Vision Companion so face recognition knows your name, or continue as a guest to use object detection, reading, currency and navigation." },
      { property: "og:title", content: "Welcome to Vision Companion" },
      { property: "og:description", content: "Sign in, continue as guest, or skip for now to start using your AI eyes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const COPY = {
  en: {
    title: "Welcome to Vision Companion",
    sub: "Sign in so face recognition knows your name, or continue without an account.",
    login: "Login or Sign Up",
    guest: "Continue as Guest",
    skip: "Skip for Now",
    google: "Continue with Google",
    email: "Email",
    pass: "Password",
    name: "Your name",
    signIn: "Sign In",
    signUp: "Create Account",
    toggleUp: "New here? Create an account",
    toggleIn: "Already have an account? Sign in",
    back: "Back",
    note: "Guests can use object detection, reading, currency, navigation and voice. Personal features like your own profile need an account.",
    spoken: "Welcome to Vision Companion. You can log in, continue as guest, or skip for now.",
  },
  te: {
    title: "విజన్ కంపానియన్‌కు స్వాగతం",
    sub: "ముఖ గుర్తింపు మీ పేరు తెలుసుకోవడానికి సైన్ ఇన్ చేయండి, లేదా ఖాతా లేకుండా కొనసాగండి.",
    login: "లాగిన్ / సైన్ అప్",
    guest: "అతిథిగా కొనసాగండి",
    skip: "ప్రస్తుతానికి దాటవేయండి",
    google: "గూగుల్‌తో కొనసాగండి",
    email: "ఇమెయిల్",
    pass: "పాస్‌వర్డ్",
    name: "మీ పేరు",
    signIn: "సైన్ ఇన్",
    signUp: "ఖాతా సృష్టించండి",
    toggleUp: "కొత్తవారా? ఖాతా సృష్టించండి",
    toggleIn: "ఖాతా ఉందా? సైన్ ఇన్ చేయండి",
    back: "వెనుకకు",
    note: "అతిథులు వస్తువుల గుర్తింపు, చదవడం, కరెన్సీ, నావిగేషన్ వాడవచ్చు. వ్యక్తిగత ఫీచర్లకు ఖాతా అవసరం.",
    spoken: "విజన్ కంపానియన్‌కు స్వాగతం. లాగిన్ చేయండి, అతిథిగా కొనసాగండి, లేదా దాటవేయండి.",
  },
  hi: {
    title: "विज़न कंपैनियन में आपका स्वागत है",
    sub: "साइन इन करें ताकि चेहरा पहचान आपका नाम जान सके, या बिना खाते के जारी रखें।",
    login: "लॉगिन / साइन अप",
    guest: "अतिथि के रूप में जारी रखें",
    skip: "अभी छोड़ें",
    google: "गूगल से जारी रखें",
    email: "ईमेल",
    pass: "पासवर्ड",
    name: "आपका नाम",
    signIn: "साइन इन",
    signUp: "खाता बनाएँ",
    toggleUp: "नए हैं? खाता बनाएँ",
    toggleIn: "पहले से खाता है? साइन इन करें",
    back: "वापस",
    note: "अतिथि वस्तु पहचान, पाठ, मुद्रा, नेविगेशन उपयोग कर सकते हैं। व्यक्तिगत सुविधाओं के लिए खाता चाहिए।",
    spoken: "विज़न कंपैनियन में स्वागत है। लॉगिन करें, अतिथि के रूप में जारी रखें, या अभी छोड़ें।",
  },
} as const;

function AuthPage() {
  const navigate = useNavigate();
  const [lang, setLangState] = useState(getLang());
  useEffect(() => { setLangState(getLang()); return onLangChange(setLangState); }, []);
  const c = t(COPY as any, lang) as unknown as (typeof COPY)["en"];
  const [mode, setMode] = useState<"choose" | "form">("choose");
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    say(c.spoken, lang, "general");
    // Already signed in (e.g. returning from Google) → go straight in.
    getSessionUser().then(async (u) => {
      if (u) {
        await loadProfile();
        navigate({ to: "/" });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enter = async (guest: boolean) => {
    setGuest(guest);
    navigate({ to: "/" });
  };

  const google = async () => {
    setErr(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) { setErr(String(result.error)); return; }
      if (result.redirected) return;
      await loadProfile();
      setGuest(false);
      navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (signup) {
        const { error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) { setErr(error.message); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) { setErr(error.message); return; }
      }
      const profile = await loadProfile();
      if (!profile) {
        setErr("Check your email to confirm your account, then sign in.");
        return;
      }
      setGuest(false);
      say(`Signed in as ${profile.display_name}.`, lang, "general");
      navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <main className="w-full max-w-lg glass-card rounded-3xl p-8 border-2 border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-14 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
            <Eye className="size-7 text-primary-foreground" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-black leading-tight">{c.title}</h1>
            <p className="text-sm text-muted-foreground">{c.sub}</p>
          </div>
        </div>

        {mode === "choose" ? (
          <div className="space-y-3">
            <Button
              onClick={() => setMode("form")}
              className="w-full min-h-14 text-lg font-bold rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <LogIn className="size-5" aria-hidden /> {c.login}
            </Button>
            <Button
              onClick={() => enter(true)}
              variant="secondary"
              className="w-full min-h-14 text-lg font-bold rounded-2xl border-2 border-border"
            >
              <UserRound className="size-5" aria-hidden /> {c.guest}
            </Button>
            <Button
              onClick={() => enter(true)}
              variant="ghost"
              className="w-full min-h-12 text-base font-semibold rounded-2xl"
            >
              {c.skip} <ArrowRight className="size-4" aria-hidden />
            </Button>
            <p className="text-sm text-muted-foreground pt-2 leading-relaxed">{c.note}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Button
              type="button"
              onClick={google}
              disabled={busy}
              variant="secondary"
              className="w-full min-h-13 font-bold rounded-2xl border-2 border-border"
            >
              {c.google}
            </Button>
            <div className="text-center text-xs text-muted-foreground">———</div>
            {signup && (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={c.name}
                aria-label={c.name}
                className="min-h-12 text-base"
              />
            )}
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={c.email}
              aria-label={c.email}
              className="min-h-12 text-base"
            />
            <Input
              type="password"
              required
              minLength={6}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={c.pass}
              aria-label={c.pass}
              className="min-h-12 text-base"
            />
            {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
            <Button
              type="submit"
              disabled={busy}
              className="w-full min-h-14 text-lg font-bold rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {signup ? c.signUp : c.signIn}
            </Button>
            <div className="flex items-center justify-between gap-2 pt-1">
              <button type="button" onClick={() => setMode("choose")} className="text-sm font-semibold underline min-h-11">
                {c.back}
              </button>
              <button type="button" onClick={() => setSignup((s) => !s)} className="text-sm font-semibold underline min-h-11">
                {signup ? c.toggleIn : c.toggleUp}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
