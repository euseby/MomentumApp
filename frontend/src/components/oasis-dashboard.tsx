import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, Coffee, Coins, Leaf, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { cityReducer, INITIAL_CITY, rewardSymbol, type OasisQuest } from "@/lib/oasis";
import { acceptQuest, generateQuest, getInsights, getProjections, getWallet, importDemoStatement, uploadStatement, type InsightsData, type ProjectionValue, type WalletData } from "@/lib/api";
import { StatementUpload } from "@/components/statement-upload";
import { InsightsPanel } from "@/components/insights-panel";
import { ProjectionChart } from "@/components/projection-chart";
import island from "@/assets/oasis-island.jpg";

const ron = (value: number) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(value) + " RON";

export function OasisDashboard() {
  const [city, dispatch] = useReducer(cityReducer, INITIAL_CITY);
  const [demoUserId, setDemoUserId] = useState("demo-ioana");
  const [questData, setQuestData] = useState<OasisQuest | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [projections, setProjections] = useState<ProjectionValue[]>([]);
  const [destinationId, setDestinationId] = useState("fidelis");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const request = useRef<AbortController | null>(null);
  const loadDashboardData = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const [nextInsights, nextWallet] = await Promise.all([
        getInsights(demoUserId, controller.signal),
        getWallet(demoUserId),
      ]);
      if (controller.signal.aborted) return;
      setInsights(nextInsights);
      setWallet(nextWallet);
      dispatch({
        type: "syncWallet",
        simulatedBalance: nextWallet.balances.RON_SIM,
        investedRon: nextWallet.investedRon,
        inventory: nextWallet.inventory,
      });
      dispatch({ type: "newQuest" });
      if (!nextInsights.habit) {
        setQuestData(null);
        setProjections([]);
        setApiError("");
        return;
      }
      const nextQuest = await generateQuest(demoUserId, controller.signal);
      if (controller.signal.aborted) return;
      setQuestData(nextQuest);
      const projectionResult = await getProjections(nextQuest.amountToSave, 24, demoUserId);
      if (controller.signal.aborted) return;
      setProjections(projectionResult.projections);
      setApiError("");
    } catch (error) {
      if (controller.signal.aborted) return;
      setQuestData(null);
      setApiError(error instanceof Error ? error.message : "Nu am putut încărca misiunea.");
    }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [demoUserId]);
  useEffect(() => { void loadDashboardData(); return () => request.current?.abort(); }, [loadDashboardData]);

  const loadDemoStatement = async () => {
    setImporting(true);
    setApiError("");
    try {
      await importDemoStatement(demoUserId);
      await loadDashboardData();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Nu am putut încărca extrasul demo.");
    } finally {
      setImporting(false);
    }
  };

  const handleStatementUpload = async (file: File) => {
    setImporting(true);
    setApiError("");
    try {
      await uploadStatement(file, demoUserId);
      await loadDashboardData();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Nu am putut importa extrasul.");
    } finally {
      setImporting(false);
    }
  };

  const handleAcceptQuest = async () => {
    if (!questData?.id) {
      setApiError("Misiunea nu are un identificator valid. Generează din nou quest-ul.");
      return;
    }
    setAccepting(true);
    setApiError("");
    try {
      await acceptQuest(questData.id, destinationId, demoUserId);
      const nextWallet = await getWallet(demoUserId);
      setWallet(nextWallet);
      dispatch({
        type: "syncWallet",
        simulatedBalance: nextWallet.balances.RON_SIM,
        investedRon: nextWallet.investedRon,
        inventory: nextWallet.inventory,
        accepted: true,
      });
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Nu am putut accepta misiunea.");
    } finally {
      setAccepting(false);
    }
  };
  const latestReward = city.rewards.at(-1);
  const cityName = city.isRuined ? "Oraș Abandonat" : city.cityLevel === 1 ? "Cort pe plajă" : latestReward || "Oaza ta";
  const insufficient = questData ? questData.amountToSave > city.simulatedBalance : false;

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Leaf /></span><span className="text-2xl font-extrabold">Oasis<span className="text-primary">.</span></span></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {import.meta.env.DEV && (
              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">
                <span>Utilizator demo</span>
                <select
                  aria-label="Utilizator demo"
                  className="bg-transparent font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={demoUserId}
                  onChange={(event) => {
                    dispatch({ type: "reset" });
                    setQuestData(null);
                    setInsights(null);
                    setWallet(null);
                    setProjections([]);
                    setApiError("");
                    setDemoUserId(event.target.value);
                  }}
                >
                  <option value="demo-ioana">Ioana</option>
                  <option value="demo-radu">Radu</option>
                </select>
              </label>
            )}
            <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-neon" />Simulare financiară</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 pb-10 pt-8 sm:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div><p className="mb-2 text-xs font-semibold uppercase text-neon">UN PAS MIC. UN VIITOR MAI MARE.</p><h1 className="text-3xl font-extrabold sm:text-4xl">Oaza ta, în creștere.</h1><p className="mt-2 text-sm text-muted-foreground">Mai puține cheltuieli impulsive. Mai mult loc pentru visurile tale.</p></div>
          <span className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary" />Fără bani reali transferați</span>
        </div>
        <section aria-label="Solduri simulate" className="mb-7 grid grid-cols-2 gap-4 border-y border-border py-5 sm:grid-cols-5">
          <div><p className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="size-4" />Sold disponibil</p><p data-testid="balance" className="mt-2 text-xl font-extrabold tabular-nums sm:text-3xl">{ron(city.simulatedBalance)}</p></div>
          <div><p className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowUpRight className="size-4 text-primary" />Economii simulate</p><p data-testid="saved" className="mt-2 text-xl font-extrabold tabular-nums text-primary sm:text-3xl">{ron(city.saved)}</p></div>
          <div className="col-span-2 border-t border-border pt-4 sm:col-span-1 sm:border-t-0 sm:pt-0"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="size-4 text-neon" />Nivelul orașului</p><p data-testid="level" className="mt-2 text-xl font-extrabold sm:text-3xl">{String(city.cityLevel).padStart(2, "0")}<span className="ml-3 text-xs font-medium text-muted-foreground">{city.isRuined ? "Abandonat" : city.cityLevel === 1 ? "Început de poveste" : "În plină dezvoltare"}</span></p></div>
          <div className="border-t border-border pt-4 sm:border-t-0 sm:pt-0"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Coins className="size-4 text-neon" />Credite</p><p className="mt-2 text-xl font-extrabold tabular-nums sm:text-3xl">{wallet?.balances.CREDITS ?? 0}</p></div>
          <div className="border-t border-border pt-4 sm:border-t-0 sm:pt-0"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="size-4 text-neon" />Streak</p><p className="mt-2 text-xl font-extrabold tabular-nums sm:text-3xl">{wallet?.streak ?? 0}</p></div>
        </section>
        <StatementUpload busy={loading || importing} onDemo={() => void loadDemoStatement()} onUpload={(file) => void handleStatementUpload(file)} />
        {apiError && <p role="alert" className="mb-5 text-sm text-destructive">{apiError}</p>}
        <InsightsPanel insights={insights} loading={loading || importing} />
        <ProjectionChart projections={projections} loading={loading} />
        <div className="grid items-start gap-7 lg:grid-cols-[1.4fr_1fr]">
          <section aria-label="Orașul tău" className="min-w-0">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Insula mea</h2><span className={`flex items-center gap-1.5 text-xs ${city.isRuined ? "text-destructive" : "text-primary"}`}><span className={`size-1.5 rounded-full ${city.isRuined ? "bg-destructive" : "bg-primary"}`} />{city.isRuined ? "Abandonată" : "Înfloritoare"}</span></div>
            <div className="island-scene relative overflow-hidden rounded-lg border border-border">
              <div className={`relative transition-all duration-700 ${city.isRuined ? "grayscale opacity-40" : ""}`}>
                <img src={island} width={1536} height={1024} alt="Insulă tropicală cu un cort pe plajă și spațiu pentru un oraș" className="block aspect-[3/2] w-full object-cover" />
                <div aria-hidden className="city-buildings absolute inset-0">
                  {city.rewards.slice(-3).map((reward, i) => <span key={`${reward}-${i}`} className={`city-building city-building-${i} animate-pop`}>{rewardSymbol(reward, questData?.rewardType)}{reward.toLocaleLowerCase("ro").includes("pisic") && <span className="city-pet">🐈</span>}</span>)}
                </div>
              </div>
              <div className="absolute left-4 top-4 rounded-md border border-glass-border bg-background/80 px-3 py-2 text-xs font-semibold backdrop-blur-md">Nivel {city.cityLevel} <span className="mx-2 text-muted-foreground">/</span> {city.isRuined ? "Poveste întreruptă" : "Oaza ta"}</div>
              <div className="absolute inset-x-0 bottom-0 bg-background/90 px-5 py-4 backdrop-blur-md"><p className={`text-lg font-bold ${city.isRuined ? "text-destructive" : "text-foreground"}`}>{cityName}</p><p className="mt-1 text-xs text-muted-foreground">{city.isRuined ? "Economiile au fost retrase. O nouă provocare poate reconstrui insula." : city.cityLevel === 1 ? "Fiecare alegere bună pune o cărămidă în plus." : `${city.rewards.length} recompense adăugate pe insulă`}</p></div>
            </div>
            <div className="mt-5 flex items-center gap-3 border-b border-border pb-5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Leaf className="size-4" /></span><p className="text-sm text-muted-foreground">{city.isRuined ? "Un nou început e încă posibil." : <>Nu renunți la ce îți place. <span className="text-foreground">Doar alegi un pic mai puțin.</span></>}</p></div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{city.saved > 0 ? `${ron(city.saved)} susțin orașul tău.` : "Orașul tău începe cu prima provocare."}</p><Button variant="outline" onClick={() => setWithdrawOpen(true)} disabled={city.isRuined} className="border-destructive/30 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"><ArrowDownLeft />Sparge Economiile (Retrage)</Button></div>
          </section>
          <section aria-label="Misiunea AI" className="min-w-0">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Provocarea ta</h2><Button variant="ghost" size="icon" aria-label="Actualizează misiunea" title="Actualizează misiunea" disabled={loading} onClick={() => void loadDashboardData()}><RefreshCw className={loading ? "animate-spin" : ""} /></Button></div>
            <div className="glass rounded-lg p-5 sm:p-6" aria-busy={loading}>
              <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-bold text-neon"><Sparkles className="size-4" />OASIS GAME MASTER</span><span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">{loading ? "Se conectează…" : questData ? "AI conectat" : "Indisponibil"}</span></div>
              {questData ? <>
                <h3 className="mt-5 text-2xl font-extrabold leading-snug">{questData.questTitle}</h3>
                <div className="mt-5 border-l-2 border-neon pl-4"><p className="mb-2 flex items-center gap-2 text-xs font-semibold text-neon"><Coffee className="size-3.5" />CE AM OBSERVAT</p><p className="text-sm leading-relaxed text-muted-foreground">{questData.analysisMessage}</p></div>
                <p className="mt-5 text-sm leading-relaxed">{questData.proposalMessage}</p>
                <div className="my-6 flex items-center gap-4 border-y border-border py-4"><span aria-hidden className="text-4xl">{rewardSymbol(questData.virtualReward, questData.rewardType)}</span><div><p className="text-xs text-muted-foreground">Recompensa ta</p><p className="mt-1 font-bold">{questData.virtualReward}</p></div><span className="ml-auto text-primary"><Sparkles className="size-5" /></span></div>
                {!city.accepted && <label className="mb-3 block text-xs text-muted-foreground">Instrument simulat
                  <select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="fidelis">Fidelis</option><option value="depozit">Depozit bancar</option><option value="pilon-iii">Pilon III</option>
                  </select>
                </label>}
                <div aria-live="polite">{city.accepted ? <div className="flex items-start gap-2 rounded-md bg-primary/10 p-3 text-sm text-primary"><Check className="size-5 shrink-0" /><p><b>Provocare acceptată!</b><br />{questData.virtualReward} e pe insula ta.</p></div> : <Button onClick={() => void handleAcceptQuest()} disabled={loading || accepting || insufficient} className="h-auto min-h-14 w-full whitespace-normal px-4 py-3 text-sm font-bold glow-emerald"><Coins className="size-5" /><span>{accepting ? "Se confirmă…" : <>Acceptă Provocarea<br /><span className="font-medium">(Investește {ron(questData.amountToSave)})</span></>}</span><ChevronRight className="ml-auto" /></Button>}</div>
                {city.accepted && <Button variant="outline" disabled={loading} className="mt-3 w-full" onClick={() => void loadDashboardData()}><RefreshCw />{loading ? "Se pregătește…" : "Cere o nouă provocare"}</Button>}
                {insufficient && !city.accepted && <p role="alert" className="mt-3 text-sm text-destructive">Sold insuficient pentru această provocare.</p>}
                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3" />Acțiune simulată, fără transfer bancar</p>
              </> : <div className="py-8 text-center">
                {loading ? <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Pregătim misiunea…</p> : insights?.habit ? <><p role="alert" className="text-sm text-destructive">{apiError || "Misiunea nu este disponibilă."}</p><Button variant="outline" className="mt-4" onClick={() => void loadDashboardData()}>Încearcă din nou</Button></> : <p className="text-sm text-muted-foreground">Importă extrasul pentru a genera prima misiune.</p>}
              </div>}
            </div>
          </section>
        </div>
        <footer className="mt-9 flex items-center justify-between border-t border-border pt-5 text-xs text-muted-foreground"><span>Oasis — construiește-ți viitorul.</span><span>Prototip demonstrativ</span></footer>
      </main>
      <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-lg sm:max-w-md">
          <AlertDialogHeader><span className="mb-2 text-destructive"><TriangleAlert className="size-8" /></span><AlertDialogTitle>Retragi economiile și abandonezi orașul?</AlertDialogTitle><AlertDialogDescription>Vei pierde cele {city.rewards.length} recompense, iar orașul revine la nivelul 1 și devine abandonat. {ron(city.saved)} revin în soldul disponibil. Totul este o simulare; nu se retrag bani reali.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Păstrează orașul</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => dispatch({ type: "withdraw" })}>Confirmă retragerea</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}