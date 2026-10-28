import { useEffect, useState } from "react";
import { CreditCard, LoaderCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmStripeCheckout, createStripeCheckout, getStripeConfig, mockStripeTopUp } from "@/lib/api";

interface SimulatedTopUpProps {
  demoUserId: string;
  onConfirmed: () => void;
}

export function SimulatedTopUp({ demoUserId, onConfirmed }: SimulatedTopUpProps) {
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [mockEnabled, setMockEnabled] = useState(false);
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    void getStripeConfig().then((config) => {
      if (!mounted) return;
      setStripeEnabled(config.stripeEnabled);
      setMockEnabled(config.mockEnabled);
    }).catch((error: unknown) => {
      if (mounted) setMessage(error instanceof Error ? error.message : "Nu am putut verifica Stripe.");
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId || !stripeEnabled) return;
    let mounted = true;
    setBusy(true);
    void confirmStripeCheckout(sessionId, demoUserId).then(() => {
      if (!mounted) return;
      setMessage("Alimentare Stripe test confirmată. Soldul este simulat.");
      onConfirmed();
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url);
    }).catch((error: unknown) => {
      if (mounted) setMessage(error instanceof Error ? error.message : "Nu am putut confirma Stripe.");
    }).finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, [demoUserId, onConfirmed, stripeEnabled]);

  const topUp = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (stripeEnabled) {
        const checkout = await createStripeCheckout(amount, demoUserId);
        window.location.assign(checkout.url);
        return;
      }
      if (!mockEnabled) throw new Error("Alimentarea nu este configurată în acest mediu.");
      await mockStripeTopUp(amount, crypto.randomUUID(), demoUserId);
      setMessage("Soldul simulat a fost alimentat. Nu s-au debitat bani reali.");
      onConfirmed();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nu am putut alimenta soldul.");
    } finally {
      setBusy(false);
    }
  };

  if (!stripeEnabled && !mockEnabled) return null;

  return (
    <section aria-label="Alimentare portofel simulat" className="mb-7 border-y border-border py-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-bold"><Wallet className="size-4 text-primary" />Alimentează portofelul simulat</h2>
          <p className="mt-1 text-xs text-muted-foreground">Nu se cumpără credite și nu se fac investiții reale.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">Sumă<select aria-label="Sumă alimentare" className="mt-1 block h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground" value={amount} onChange={(event) => setAmount(Number(event.target.value))}>
            {[50, 100, 200].map((value) => <option key={value} value={value}>{value} RON</option>)}
          </select></label>
          <Button disabled={busy} onClick={() => void topUp()}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            {stripeEnabled ? "Stripe test" : "Alimentează demo"}
          </Button>
        </div>
      </div>
      {stripeEnabled && <p className="mt-3 text-xs text-muted-foreground">Mod test Stripe — nu se debitează bani reali. Card de test: 4242 4242 4242 4242.</p>}
      {!stripeEnabled && mockEnabled && <p className="mt-3 text-xs text-neon">Checkout mock, etichetat ca simulare.</p>}
      {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
    </section>
  );
}
