import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Coffee,
  Bike,
  Shirt,
  Wine,
  Gamepad2,
  Cigarette,
  Plane,
  Trees,
  Building2,
  Flame,
  Sparkles,
  RotateCcw,
  Zap,
} from "lucide-react";
import { fetchMomentum, type OasisResponse } from "@/lib/momentum";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oasis — Misiuni zilnice, avere reală" },
      {
        name: "description",
        content:
          "Transformă micro-acțiunile zilnice în recompense virtuale și bani reali investiți. Insula ta crește cu fiecare misiune.",
      },
      { property: "og:title", content: "Oasis — Behavioral Wealth" },
      {
        property: "og:description",
        content:
          "Misiuni zilnice gamificate care transformă cheltuielile mici în avere la 65 de ani.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ron = (n: number) =>
  new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n) + " lei";

const PLEASURES = [
  { label: "Comenzi Tazz / Food delivery", short: "Food delivery", icon: Bike },
  { label: "Cafea de specialitate", short: "Cafea", icon: Coffee },
  { label: "Ieșiri în oraș", short: "Ieșiri", icon: Wine },
  { label: "Haine & shopping", short: "Shopping", icon: Shirt },
  { label: "Gaming & abonamente", short: "Gaming", icon: Gamepad2 },
  { label: "Țigări / vape", short: "Țigări", icon: Cigarette },
];
const GOALS = [
  { id: "travel", label: "Călătorii", desc: "Lumea, fără griji", icon: Plane },
  { id: "country", label: "Casă la țară", desc: "Liniște și grădină", icon: Trees },
  { id: "city", label: "Liniște în oraș", desc: "Confort, fără rate", icon: Building2 },
];

function rewardEmoji(reward: string): string {
  const r = reward.toLowerCase();
  if (r.includes("plaj")) return "🏝️";
  if (r.includes("copac") || r.includes("pădure")) return "🌳";
  if (r.includes("castel")) return "🏰";
  if (r.includes("vilă") || r.includes("vila") || r.includes("casă") || r.includes("casa"))
    return "🏡";
  if (r.includes("barc") || r.includes("yacht")) return "⛵";
  if (r.includes("munte") || r.includes("caban")) return "⛰️";
  if (r.includes("grădin") || r.includes("gradin")) return "🌺";
  return "✨";
}

type Stage = "intro" | "wizard" | "loading" | "oasis" | "invested";

function Index() {
  const [stage, setStage] = useState<Stage>("intro");
  const [step, setStep] = useState(0);
  const [age, setAge] = useState(26);
  const [income, setIncome] = useState(5000);
  const [pleasure, setPleasure] = useState("");
  const [custom, setCustom] = useState("");
  const [spend, setSpend] = useState(400);
  const [goal, setGoal] = useState("country");
  const [quest, setQuest] = useState<OasisResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

  const guilty = pleasure === "__custom" ? custom.trim() : pleasure;
  const canNext = [true, true, !!guilty, spend > 0, !!goal][step];
  const STEPS = 5;

  const run = async () => {
    setApiError(null);
    setStage("loading");
    try {
      const data = await fetchMomentum({
        age,
        monthlyIncome: income,
        guiltyPleasure: guilty,
        monthlyGuiltyPleasureSpend: spend,
      });
      setQuest(data);
      setStage("oasis");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "A apărut o eroare neașteptată.");
      setStage("wizard");
    }
  };
  const next = () => (step < STEPS - 1 ? setStep(step + 1) : run());
  const restart = () => {
    setApiError(null);
    setStage("wizard");
    setStep(0);
  };
  const invest = () => {
    setStreak((s) => s + 1);
    setStage("invested");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background font-sans">
      {/* ambient neon blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl animate-oasis" />
        <div
          className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-neon/15 blur-3xl animate-oasis"
          style={{ animationDelay: "-7s" }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 pb-8 pt-6">
        <TopBar streak={streak} bonus={quest?.streakBonus ?? false} />

        {stage === "intro" && <Intro onStart={() => setStage("wizard")} />}

        {stage === "wizard" && (
          <div className="flex flex-1 flex-col">
            <div className="mb-8 flex gap-1.5">
              {Array.from({ length: STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i <= step ? "bg-primary" : "bg-secondary"}`}
                />
              ))}
            </div>
            <div
              key={step}
              className="flex-1 animate-in fade-in slide-in-from-right-6 duration-300"
            >
              {step === 0 && (
                <Q
                  title="Câți ani ai?"
                  hint="Calculăm cât timp lucrează banii pentru tine până la 65."
                >
                  <Big value={`${age}`} unit="ani" />
                  <Range min={18} max={60} value={age} onChange={setAge} />
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    Ai <b className="text-foreground">{65 - age} ani</b> de dobândă compusă înainte.
                  </p>
                </Q>
              )}
              {step === 1 && (
                <Q
                  title="Cât câștigi aproximativ?"
                  hint="Venit net lunar. Nu trebuie să fie exact."
                >
                  <Big value={new Intl.NumberFormat("ro-RO").format(income)} unit="lei / lună" />
                  <Range min={1500} max={30000} step={250} value={income} onChange={setIncome} />
                </Q>
              )}
              {step === 2 && (
                <Q
                  title="Care e plăcerea ta vinovată?"
                  hint="Fără judecăți. Nu o eliminăm, doar o reducem puțin."
                >
                  <div className="grid grid-cols-2 gap-3">
                    {PLEASURES.map(({ label, short, icon: Icon }) => (
                      <Choice
                        key={label}
                        active={pleasure === label}
                        onClick={() => setPleasure(label)}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-semibold">{short}</span>
                      </Choice>
                    ))}
                  </div>
                  <input
                    value={custom}
                    onFocus={() => setPleasure("__custom")}
                    onChange={(e) => {
                      setCustom(e.target.value);
                      setPleasure("__custom");
                    }}
                    placeholder="Altceva? Scrie aici…"
                    className={`mt-3 w-full rounded-2xl border bg-card px-4 py-3.5 font-medium text-foreground outline-none transition placeholder:text-muted-foreground/70 ${pleasure === "__custom" ? "border-primary ring-2 ring-ring/40" : "border-input"}`}
                  />
                </Q>
              )}
              {step === 3 && (
                <Q title="Cât cheltui lunar pe ea?" hint={guilty}>
                  <Big value={new Intl.NumberFormat("ro-RO").format(spend)} unit="lei / lună" />
                  <Range
                    min={50}
                    max={Math.max(500, Math.min(5000, Math.round(income * 0.5)))}
                    step={25}
                    value={spend}
                    onChange={setSpend}
                  />
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    Asta e <b className="text-foreground">{Math.round((spend / income) * 100)}%</b>{" "}
                    din venitul tău.
                  </p>
                </Q>
              )}
              {step === 4 && (
                <Q
                  title="Cum vrei să arate insula ta?"
                  hint="Visul tău de la 60+. Misiunile zilnice te duc acolo."
                >
                  <div className="space-y-3">
                    {GOALS.map(({ id, label, desc, icon: Icon }) => (
                      <Choice key={id} active={goal === id} onClick={() => setGoal(id)} row>
                        <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-neon">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold">{label}</p>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
                        {goal === id && <Check className="ml-auto h-5 w-5 text-emerald-glow" />}
                      </Choice>
                    ))}
                  </div>
                </Q>
              )}
            </div>
            {apiError && (
              <p
                role="alert"
                className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {apiError}
              </p>
            )}
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => (step ? setStep(step - 1) : setStage("intro"))}
                aria-label="Înapoi"
                className="grid h-14 w-14 place-items-center rounded-2xl glass text-foreground transition active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                disabled={!canNext}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-oasis font-bold text-primary-foreground glow-primary transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
              >
                {step === STEPS - 1 ? "Primește misiunea" : "Continuă"}{" "}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {stage === "loading" && <Loading />}

        {stage === "oasis" && quest && (
          <Oasis quest={quest} onInvest={invest} onRestart={restart} />
        )}

        {stage === "invested" && quest && (
          <Invested quest={quest} streak={streak} onDone={restart} />
        )}
      </div>
    </main>
  );
}

function TopBar({ streak, bonus }: { streak: number; bonus: boolean }) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-oasis glow-primary">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-extrabold tracking-tight text-foreground">Oasis</span>
      </div>
      <div className="flex items-center gap-2">
        {bonus && (
          <span className="flex items-center gap-1 rounded-full glass px-2.5 py-1 text-xs font-bold text-emerald-glow">
            <Zap className="h-3 w-3" /> Bonus
          </span>
        )}
        <span className="flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-sm font-extrabold">
          <Flame className="h-4 w-4 text-streak" />
          <span className="text-streak">
            {streak === 0 ? "Începe seria" : `${streak} ${streak === 1 ? "zi" : "zile"} la rând`}
          </span>
        </span>
      </div>
    </header>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col animate-in fade-in duration-500">
      <div className="relative mt-2 overflow-hidden rounded-3xl glass p-6 glow-primary">
        <div
          aria-hidden
          className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-2xl"
        />
        <p className="text-sm text-muted-foreground">Fiecare misiune începe cu o alegere mică</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">
          Insula ta, pas cu pas
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Recompense virtuale și proiecții adaptate răspunsurilor tale
        </p>
        <span className="absolute bottom-4 right-5 text-5xl animate-float">🏝️</span>
      </div>
      <h1 className="mt-8 text-4xl font-extrabold leading-tight tracking-tight text-foreground">
        Nu e o aplicație de buget.
        <br />
        <span className="bg-oasis bg-clip-text text-transparent">
          E insula ta. Crește cu fiecare misiune.
        </span>
      </h1>
      <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
        {[
          "Răspunzi la 5 întrebări despre stilul tău de viață",
          "Primești o misiune zilnică pe măsura ta",
          "O completezi → recompensă pe insulă + bani reali investiți",
        ].map((t, i) => (
          <li key={t} className="flex items-center gap-3">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs font-bold text-neon">
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ul>
      <button
        onClick={onStart}
        className="mt-auto flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-oasis font-bold text-primary-foreground glow-primary transition hover:brightness-110 active:scale-[0.98]"
      >
        Intră pe insulă — 1 minut <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Loading() {
  const steps = [
    "Analizăm stilul de viață...",
    "Pregătim misiunea zilei...",
    "Plantăm recompensa pe insulă...",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % steps.length), 900);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="relative grid h-20 w-20 place-items-center">
        <span className="absolute inset-0 rounded-full bg-primary/30 animate-ring" />
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-secondary border-t-primary" />
      </div>
      <p key={i} className="font-semibold text-foreground animate-in fade-in duration-300">
        {steps[i]}
      </p>
    </div>
  );
}

function Oasis({
  quest,
  onInvest,
  onRestart,
}: {
  quest: OasisResponse;
  onInvest: () => void;
  onRestart: () => void;
}) {
  const emoji = useMemo(() => rewardEmoji(quest.virtualReward), [quest.virtualReward]);
  return (
    <div className="flex flex-1 flex-col animate-in fade-in zoom-in-95 duration-500">
      {/* Insula — zona vizuală Oasis */}
      <div className="relative mt-1 overflow-hidden rounded-3xl glass p-6 glow-primary">
        <div aria-hidden className="absolute inset-0 bg-oasis opacity-20 animate-oasis" />
        <div
          aria-hidden
          className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-neon/20 blur-2xl"
        />
        <div className="relative flex flex-col items-center py-6 text-center">
          <span className="text-8xl drop-shadow-2xl animate-float">{emoji}</span>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-neon">
            Recompensa de azi
          </p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
            {quest.virtualReward}
          </p>
        </div>
      </div>

      {/* Daily Quest Card */}
      <div className="mt-4 rounded-3xl glass p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Misiunea zilei
          </p>
          <span className="rounded-full bg-emerald-glow/15 px-2.5 py-1 text-xs font-bold text-emerald-glow">
            +{ron(quest.futureRealValue)} la 65
          </span>
        </div>
        <h2 className="mt-2 text-xl font-extrabold leading-snug tracking-tight text-foreground">
          {quest.questTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{quest.questStory}</p>
      </div>
      {/* Butonul de acțiune */}
      <div className="mt-auto space-y-2 pt-6">
        <button
          onClick={onInvest}
          className="group flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-oasis text-lg font-extrabold text-primary-foreground glow-primary transition hover:scale-[1.02] hover:brightness-110 active:scale-[0.97]"
        >
          <Zap className="h-5 w-5 transition group-hover:scale-125" /> Confirmă economisirea{" "}
          {ron(quest.amountToSave)}
        </button>
        <button
          onClick={onRestart}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Altă misiune
        </button>
      </div>
    </div>
  );
}

function Invested({
  quest,
  streak,
  onDone,
}: {
  quest: OasisResponse;
  streak: number;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="relative grid h-28 w-28 place-items-center">
        <span className="absolute inset-0 rounded-full bg-emerald-glow/30 animate-ring" />
        <div className="grid h-24 w-24 place-items-center rounded-full bg-emerald-glow glow-emerald animate-pop">
          <Check className="h-12 w-12 text-background" strokeWidth={3} />
        </div>
      </div>
      <h2 className="mt-8 text-3xl font-extrabold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-2 delay-300 duration-500 fill-mode-both">
        Misiune completată!
      </h2>
      <p className="mt-3 max-w-xs text-muted-foreground animate-in fade-in delay-500 duration-500 fill-mode-both">
        Ai confirmat că pui deoparte <b className="text-foreground">{ron(quest.amountToSave)}</b>.{" "}
        <b className="text-emerald-glow">{quest.virtualReward}</b> e acum pe insula ta.
      </p>
      <div className="mt-6 flex items-center gap-2 rounded-full glass px-4 py-2 animate-in fade-in delay-700 duration-500 fill-mode-both">
        <Flame className="h-4 w-4 text-streak" />
        <span className="text-sm font-extrabold text-streak">Streak: {streak} zile</span>
        {quest.streakBonus && (
          <span className="text-xs font-bold text-emerald-glow">· bonus activ</span>
        )}
      </div>
      <button
        onClick={onDone}
        className="mt-8 w-full rounded-2xl glass py-4 font-bold text-foreground transition hover:brightness-110 active:scale-[0.98]"
      >
        Vezi misiunea de mâine
      </button>
    </div>
  );
}

function Q({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground">
        {title}
      </h2>
      {hint && <p className="mb-8 mt-2 text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
function Big({ value, unit }: { value: string; unit: string }) {
  return (
    <p className="mb-6 text-center">
      <span className="text-6xl font-extrabold tracking-tight text-foreground tabular-nums">
        {value}
      </span>{" "}
      <span className="text-lg font-semibold text-muted-foreground">{unit}</span>
    </p>
  );
}
function Range({
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={Math.min(Math.max(value, min), max)}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mt-3 w-full accent-primary"
    />
  );
}
function Choice({
  active,
  onClick,
  row,
  children,
}: {
  active: boolean;
  onClick: () => void;
  row?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full gap-3 rounded-2xl border glass p-4 text-foreground transition active:scale-[0.97] ${row ? "items-center" : "flex-col items-start"} ${active ? "border-primary ring-2 ring-ring/40" : "border-glass-border"}`}
    >
      {children}
    </button>
  );
}
