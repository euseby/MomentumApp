import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { fetchMomentum, type MomentumResponse } from "@/lib/momentum";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Momentum — Găsește-ți obiceiul care valorează o avere" },
      { name: "description", content: "Reduce o cheltuială mică și vezi cât strângi până la 65 de ani." },
      { property: "og:title", content: "Momentum" },
      { property: "og:description", content: "Reduce o cheltuială mică și vezi cât strângi până la 65 de ani." },
    ],
  }),
  component: Index,
});

const ron = (n: number) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(n) + " lei";
type Stage = "form" | "loading" | "result";

function Index() {
  const [stage, setStage] = useState<Stage>("form");
  const [form, setForm] = useState({ age: "", monthlyIncome: "", guiltyPleasure: "", monthlyGuiltyPleasureSpend: "" });
  const [error, setError] = useState("");
  const [result, setResult] = useState<MomentumResponse | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [activated, setActivated] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const age = Number(form.age), monthlyIncome = Number(form.monthlyIncome), spend = Number(form.monthlyGuiltyPleasureSpend);
    if (!age || age < 14 || age > 64) return setError("Introdu o vârstă între 14 și 64.");
    if (!(monthlyIncome > 0)) return setError("Introdu un venit lunar valid.");
    if (!form.guiltyPleasure.trim()) return setError("Spune-ne ce plăcere vinovată ai.");
    if (!(spend > 0)) return setError("Introdu suma cheltuită lunar.");
    setError("");
    setStage("loading");
    const { data, mock } = await fetchMomentum({ age, monthlyIncome, guiltyPleasure: form.guiltyPleasure.trim(), monthlyGuiltyPleasureSpend: spend });
    setResult(data); setIsMock(mock); setActivated(false); setStage("result");
  };

  const field = (key: keyof typeof form, label: string, placeholder: string, type = "number", suffix?: string) => (
    <label className="block">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex items-center rounded-2xl border border-input bg-card px-4 focus-within:ring-2 focus-within:ring-ring">
        <input
          type={type} inputMode={type === "number" ? "numeric" : undefined} min={type === "number" ? 0 : undefined}
          value={form[key]} placeholder={placeholder}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full bg-transparent py-3.5 text-base font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/60"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );

  return (
    <main className="min-h-screen bg-background font-sans">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <header className="mb-10 flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-momentum" />
          <span className="text-lg font-extrabold tracking-tight text-foreground">Momentum</span>
        </header>

        {stage === "form" && (
          <form onSubmit={submit} className="flex flex-1 flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground">
              Un obicei mic.<br /><span className="bg-momentum bg-clip-text text-transparent">O avere mare.</span>
            </h1>
            <p className="mt-3 text-muted-foreground">Patru întrebări și îți arătăm ce valorează plăcerea ta vinovată la 65 de ani.</p>
            <div className="mt-8 space-y-4">
              {field("age", "Vârstă", "24", "number", "ani")}
              {field("monthlyIncome", "Venit lunar", "4000", "number", "lei")}
              {field("guiltyPleasure", "Plăcerea vinovată", "ex: Cafea, Comenzi Tazz", "text")}
              {field("monthlyGuiltyPleasureSpend", "Cât cheltui lunar pe ea", "400", "number", "lei")}
            </div>
            {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}
            <button type="submit" className="mt-auto w-full rounded-2xl bg-momentum py-4 text-base font-bold text-primary-foreground shadow-momentum transition active:scale-[0.98] sm:mt-10">
              Găsește-mi Momentumul
            </button>
          </form>
        )}

        {stage === "loading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-border border-t-primary" />
            <p className="font-semibold text-foreground">Analizăm stilul de viață...</p>
          </div>
        )}

        {stage === "result" && result && (
          <div className="flex flex-1 flex-col animate-in fade-in zoom-in-95 duration-500">
            <div className="rounded-3xl bg-momentum p-6 text-primary-foreground shadow-momentum">
              <div className="flex items-center justify-between text-sm opacity-80">
                <span>Obicei de schimbat</span>
                <span className="rounded-full bg-primary-foreground/20 px-2.5 py-1 text-xs font-bold">{result.confidenceScore}% încredere</span>
              </div>
              <p className="mt-1 text-xl font-bold">{result.habitToChange}</p>
              <p className="mt-8 text-sm opacity-80">La 65 de ani vei avea</p>
              <p className="text-5xl font-extrabold tracking-tight">{ron(result.futureValueAt65)}</p>
              <div className="mt-8 grid grid-cols-2 gap-4 border-t border-primary-foreground/20 pt-4 text-sm">
                <div><p className="opacity-70">Economisești lunar</p><p className="text-lg font-bold">{ron(result.monthlySavings)}</p></div>
                <div><p className="opacity-70">Investit în</p><p className="font-bold leading-snug">{result.investmentVehicle}</p></div>
              </div>
            </div>
            <p className="mt-6 text-lg font-medium leading-relaxed text-foreground">{result.actionMessage}</p>
            {isMock && <p className="mt-3 text-xs text-muted-foreground">Date demonstrative — serverul nu a răspuns.</p>}
            <div className="mt-auto space-y-3 pt-8">
              <button onClick={() => setActivated(true)} disabled={activated}
                className="w-full rounded-2xl bg-foreground py-4 text-base font-bold text-background transition active:scale-[0.98] disabled:bg-electric">
                {activated ? "✓ Regula este activă" : "Activează Regula"}
              </button>
              <button onClick={() => setStage("form")} className="w-full py-2 text-sm font-medium text-muted-foreground">Încearcă alt obicei</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
