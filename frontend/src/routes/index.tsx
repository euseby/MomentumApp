import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Check, Coffee, Bike, Shirt, Wine, Gamepad2, Cigarette,
  Plane, Trees, Building2, ShieldCheck, Sparkles, Landmark, RotateCcw,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { fetchMomentum, projectValue, type MomentumResponse } from "@/lib/momentum";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Momentum — Stilul tău de viață, transformat în avere" },
      { name: "description", content: "Micro-acțiuni automate care transformă cheltuielile zilnice în titluri de stat și siguranță financiară." },
      { property: "og:title", content: "Momentum — Behavioral Wealth" },
      { property: "og:description", content: "Micro-acțiuni automate care transformă cheltuielile zilnice în siguranță financiară." },
    ],
  }),
  component: Index,
});

const ron = (n: number) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n) + " lei";

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

type Stage = "intro" | "wizard" | "loading" | "result" | "activated";

function Index() {
  const [stage, setStage] = useState<Stage>("intro");
  const [step, setStep] = useState(0);
  const [age, setAge] = useState(26);
  const [income, setIncome] = useState(5000);
  const [pleasure, setPleasure] = useState("");
  const [custom, setCustom] = useState("");
  const [spend, setSpend] = useState(400);
  const [goal, setGoal] = useState("country");
  const [result, setResult] = useState<MomentumResponse | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [saving, setSaving] = useState(0);

  const guilty = pleasure === "__custom" ? custom.trim() : pleasure;
  const canNext = [true, true, !!guilty, spend > 0, !!goal][step];
  const STEPS = 5;

  const run = async () => {
    setStage("loading");
    const { data, mock } = await fetchMomentum({ age, monthlyIncome: income, guiltyPleasure: guilty, monthlyGuiltyPleasureSpend: spend });
    setResult(data); setIsMock(mock); setSaving(Math.min(data.monthlySavings, spend)); setStage("result");
  };
  const next = () => (step < STEPS - 1 ? setStep(step + 1) : run());
  const restart = () => { setStage("wizard"); setStep(0); };

  return (
    <main className="min-h-screen bg-background font-sans">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-8 pt-6">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-momentum"><Sparkles className="h-4 w-4 text-primary-foreground" /></div>
            <span className="text-lg font-extrabold tracking-tight text-foreground">Momentum</span>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Garantat de stat</span>
        </header>

        {stage === "intro" && <Intro onStart={() => setStage("wizard")} />}

        {stage === "wizard" && (
          <div className="flex flex-1 flex-col">
            <div className="mb-8 flex gap-1.5">
              {Array.from({ length: STEPS }).map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i <= step ? "bg-primary" : "bg-border"}`} />
              ))}
            </div>
            <div key={step} className="flex-1 animate-in fade-in slide-in-from-right-6 duration-300">
              {step === 0 && (
                <Q title="Câți ani ai?" hint="Calculăm cât timp lucrează banii pentru tine până la 65.">
                  <Big value={`${age}`} unit="ani" />
                  <Range min={18} max={60} value={age} onChange={setAge} />
                  <p className="mt-4 text-center text-sm text-muted-foreground">Ai <b className="text-foreground">{65 - age} ani</b> de dobândă compusă înainte.</p>
                </Q>
              )}
              {step === 1 && (
                <Q title="Cât câștigi aproximativ?" hint="Venit net lunar. Nu trebuie să fie exact.">
                  <Big value={new Intl.NumberFormat("ro-RO").format(income)} unit="lei / lună" />
                  <Range min={1500} max={30000} step={250} value={income} onChange={setIncome} />
                </Q>
              )}
              {step === 2 && (
                <Q title="Care e plăcerea ta vinovată?" hint="Fără judecăți. Nu o eliminăm, doar o reducem puțin.">
                  <div className="grid grid-cols-2 gap-3">
                    {PLEASURES.map(({ label, short, icon: Icon }) => (
                      <Choice key={label} active={pleasure === label} onClick={() => setPleasure(label)}>
                        <Icon className="h-5 w-5" /><span className="font-semibold">{short}</span>
                      </Choice>
                    ))}
                  </div>
                  <input value={custom} onFocus={() => setPleasure("__custom")} onChange={(e) => { setCustom(e.target.value); setPleasure("__custom"); }}
                    placeholder="Altceva? Scrie aici…"
                    className={`mt-3 w-full rounded-2xl border bg-card px-4 py-3.5 font-medium text-foreground outline-none transition placeholder:text-muted-foreground/70 ${pleasure === "__custom" ? "border-primary ring-2 ring-ring/30" : "border-input"}`} />
                </Q>
              )}
              {step === 3 && (
                <Q title="Cât cheltui lunar pe ea?" hint={guilty}>
                  <Big value={new Intl.NumberFormat("ro-RO").format(spend)} unit="lei / lună" />
                  <Range min={50} max={Math.max(500, Math.min(5000, Math.round(income * 0.5)))} step={25} value={spend} onChange={setSpend} />
                  <p className="mt-4 text-center text-sm text-muted-foreground">Asta e <b className="text-foreground">{Math.round((spend / income) * 100)}%</b> din venitul tău.</p>
                </Q>
              )}
              {step === 4 && (
                <Q title="Cum vrei să arate viața ta la 60+?" hint="Asta e motivația ta. O vom ține în fața ochilor.">
                  <div className="space-y-3">
                    {GOALS.map(({ id, label, desc, icon: Icon }) => (
                      <Choice key={id} active={goal === id} onClick={() => setGoal(id)} row>
                        <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></div>
                        <div className="text-left"><p className="font-bold">{label}</p><p className="text-sm text-muted-foreground">{desc}</p></div>
                        {goal === id && <Check className="ml-auto h-5 w-5 text-primary" />}
                      </Choice>
                    ))}
                  </div>
                </Q>
              )}
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={() => (step ? setStep(step - 1) : setStage("intro"))} aria-label="Înapoi"
                className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card text-foreground transition active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
              <button onClick={next} disabled={!canNext}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-momentum font-bold text-primary-foreground shadow-momentum transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none">
                {step === STEPS - 1 ? "Găsește-mi Momentumul" : "Continuă"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {stage === "loading" && <Loading />}

        {stage === "result" && result && (
          <Result result={result} isMock={isMock} age={age} spend={spend} goal={goal} saving={saving} setSaving={setSaving}
            onActivate={() => setStage("activated")} onRestart={restart} />
        )}

        {stage === "activated" && result && (
          <Activated saving={saving} habit={result.habitToChange} vehicle={result.investmentVehicle} onDone={restart} />
        )}
      </div>
    </main>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col animate-in fade-in duration-500">
      <div className="relative mt-4 overflow-hidden rounded-3xl bg-momentum p-6 text-primary-foreground shadow-momentum">
        <p className="text-sm opacity-80">Doar din cafeaua de dimineață</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">{ron(projectValue(150, 38))}</p>
        <p className="mt-1 text-sm opacity-80">la 65 de ani, în titluri de stat</p>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-foreground/10" />
      </div>
      <h1 className="mt-8 text-4xl font-extrabold leading-tight tracking-tight text-foreground">
        Nu te învățăm să economisești.<br /><span className="bg-momentum bg-clip-text text-transparent">Îți transformăm viața în avere.</span>
      </h1>
      <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
        {["Răspunzi la 5 întrebări despre stilul tău de viață", "AI-ul găsește o micro-acțiune pe măsura ta", "Banii merg automat în Titluri de Stat Tezaur"].map((t, i) => (
          <li key={t} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-xs font-bold text-primary">{i + 1}</span>{t}</li>
        ))}
      </ul>
      <button onClick={onStart} className="mt-auto flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-momentum font-bold text-primary-foreground shadow-momentum transition active:scale-[0.98]">
        Începe — durează 1 minut <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Loading() {
  const steps = ["Analizăm stilul de viață...", "Căutăm micro-acțiunea potrivită...", "Calculăm dobânda compusă..."];
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % steps.length), 900); return () => clearInterval(t); }, [steps.length]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="relative grid h-20 w-20 place-items-center">
        <span className="absolute inset-0 rounded-full bg-primary/30 animate-ring" />
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
      <p key={i} className="font-semibold text-foreground animate-in fade-in duration-300">{steps[i]}</p>
    </div>
  );
}

function Result({ result, isMock, age, spend, goal, saving, setSaving, onActivate, onRestart }: {
  result: MomentumResponse; isMock: boolean; age: number; spend: number; goal: string; saving: number;
  setSaving: (n: number) => void; onActivate: () => void; onRestart: () => void;
}) {
  const years = Math.max(1, 65 - age);
  const adjusted = saving !== result.monthlySavings;
  const total = adjusted ? projectValue(saving, years) : result.futureValueAt65;
  const data = useMemo(() => Array.from({ length: years + 1 }, (_, y) => ({ age: age + y, v: projectValue(saving, y) })), [saving, years, age]);
  const goalLabel = GOALS.find((g) => g.id === goal)?.label ?? "";
  const invested = saving * 12 * years;

  return (
    <div className="flex flex-1 flex-col animate-in fade-in zoom-in-95 duration-500">
      <div className="rounded-3xl bg-momentum p-6 text-primary-foreground shadow-momentum">
        <div className="flex items-center justify-between text-sm">
          <span className="opacity-80">Obicei de ajustat</span>
          <span className="rounded-full bg-primary-foreground/20 px-2.5 py-1 text-xs font-bold">{result.confidenceScore}% potrivire</span>
        </div>
        <p className="mt-1 text-xl font-bold">{result.habitToChange}</p>
        <p className="mt-6 text-sm opacity-80">La 65 de ani · pentru „{goalLabel}”</p>
        <p className="text-5xl font-extrabold tracking-tight tabular-nums">{ron(total)}</p>
        <p className="mt-1 text-xs opacity-70">din care tu pui doar {ron(invested)} — restul e dobândă</p>
        <div className="-mx-2 mt-4 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity={0.5} /><stop offset="100%" stopColor="currentColor" stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="age" hide />
              <Tooltip cursor={false} contentStyle={{ borderRadius: 12, border: "none", color: "var(--foreground)" }} formatter={(v: number) => ron(v)} labelFormatter={(l) => `La ${l} ani`} />
              <Area type="monotone" dataKey="v" stroke="currentColor" strokeWidth={2.5} fill="url(#g)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center gap-2 border-t border-primary-foreground/20 pt-4 text-sm">
          <Landmark className="h-4 w-4 opacity-80" /><span className="font-semibold">{result.investmentVehicle}</span>
        </div>
      </div>

      <p className="mt-6 text-lg font-medium leading-relaxed text-foreground">{result.actionMessage}</p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-muted-foreground">Cât redirecționezi lunar</span>
          <span className="text-lg font-extrabold text-primary tabular-nums">{ron(saving)}</span>
        </div>
        <Range min={25} max={Math.max(spend, result.monthlySavings)} step={25} value={saving} onChange={setSaving} />
        <p className="mt-2 text-xs text-muted-foreground">Trage ca să vezi cum se schimbă viitorul tău.</p>
      </div>
      {isMock && <p className="mt-3 text-xs text-muted-foreground">Date demonstrative — serverul AI nu a răspuns.</p>}

      <div className="mt-6 space-y-2">
        <button onClick={onActivate} className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-lg font-bold text-background transition active:scale-[0.98]">
          <Sparkles className="h-5 w-5" /> Activează Regula
        </button>
        <button onClick={onRestart} className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" /> Încearcă alt obicei</button>
      </div>
    </div>
  );
}

function Activated({ saving, habit, vehicle, onDone }: { saving: number; habit: string; vehicle: string; onDone: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="relative grid h-28 w-28 place-items-center">
        <span className="absolute inset-0 rounded-full bg-primary/30 animate-ring" />
        <div className="grid h-24 w-24 place-items-center rounded-full bg-momentum shadow-momentum animate-pop"><Check className="h-12 w-12 text-primary-foreground" strokeWidth={3} /></div>
      </div>
      <h2 className="mt-8 text-3xl font-extrabold tracking-tight text-foreground animate-in fade-in slide-in-from-bottom-2 delay-300 duration-500 fill-mode-both">Regula e activă</h2>
      <p className="mt-3 max-w-xs text-muted-foreground animate-in fade-in delay-500 duration-500 fill-mode-both">
        În fiecare lună, <b className="text-foreground">{ron(saving)}</b> economisiți din „{habit}” vor merge automat în {vehicle}.
      </p>
      <div className="mt-8 w-full space-y-2 rounded-2xl border border-border bg-card p-4 text-left text-sm animate-in fade-in delay-700 duration-500 fill-mode-both">
        {[["Transfer automat", "Lunar, pe 1"], ["Poți opri oricând", "Fără penalizări"], ["Protecție", "Garantat de statul român"]].map(([a, b]) => (
          <div key={a} className="flex justify-between"><span className="text-muted-foreground">{a}</span><span className="font-semibold text-foreground">{b}</span></div>
        ))}
      </div>
      <button onClick={onDone} className="mt-8 w-full rounded-2xl border border-border bg-card py-4 font-bold text-foreground transition active:scale-[0.98]">Adaugă încă o regulă</button>
    </div>
  );
}

function Q({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (<div><h2 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground">{title}</h2>{hint && <p className="mb-8 mt-2 text-muted-foreground">{hint}</p>}{children}</div>);
}
function Big({ value, unit }: { value: string; unit: string }) {
  return <p className="mb-6 text-center"><span className="text-6xl font-extrabold tracking-tight text-foreground tabular-nums">{value}</span> <span className="text-lg font-semibold text-muted-foreground">{unit}</span></p>;
}
function Range({ min, max, step = 1, value, onChange }: { min: number; max: number; step?: number; value: number; onChange: (n: number) => void }) {
  return <input type="range" min={min} max={max} step={step} value={Math.min(Math.max(value, min), max)} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-primary" />;
}
function Choice({ active, onClick, row, children }: { active: boolean; onClick: () => void; row?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full gap-3 rounded-2xl border bg-card p-4 text-foreground transition active:scale-[0.97] ${row ? "items-center" : "flex-col items-start"} ${active ? "border-primary ring-2 ring-ring/30" : "border-border"}`}>
      {children}
    </button>
  );
}
