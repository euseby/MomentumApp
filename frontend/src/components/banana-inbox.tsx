import { useState } from "react";
import { Banana, BellOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BananaChallenge } from "@/lib/api";

interface BananaInboxProps {
  challenges: BananaChallenge[];
  busy: boolean;
  onClean: (challengeId: string, amountRon: number, destinationId: string) => void;
  onMute: (senderId: string) => void;
}

export function BananaInbox({ challenges, busy, onClean, onMute }: BananaInboxProps) {
  const [destinations, setDestinations] = useState<Record<string, string>>({});
  return (
    <section aria-label="Inbox provocări" className="border-y border-border py-6">
      <div className="mb-4 flex items-center gap-2"><Banana className="size-4 text-neon" /><h2 className="font-bold">Inbox insulă</h2></div>
      {!challenges.length ? <p className="text-sm text-muted-foreground">Nu ai banane active. Inbox-ul se actualizează automat la 10 secunde.</p> : (
        <ul className="space-y-3">
          {challenges.map((challenge) => {
            const destinationId = destinations[challenge.id] || "fidelis";
            return <li key={challenge.id} className="rounded-md border border-border p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{challenge.sender?.displayName || "Un prieten"} ți-a lăsat o coajă de banană.</p><p className="mt-1 text-xs text-muted-foreground">Plot blocat: {challenge.blockedPlot}. Fără penalizare; expiră la {new Date(challenge.expiresAt).toLocaleString("ro-RO")}.</p></div><Button size="icon" variant="ghost" title="Mute sender" aria-label={`Dezactivează provocările de la ${challenge.sender?.displayName || "prieten"}`} onClick={() => onMute(challenge.fromUser)}><BellOff className="size-4" /></Button></div>
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <label className="text-xs text-muted-foreground">Investiție minimă: {challenge.minInvestRon} RON
                  <select value={destinationId} onChange={(event) => setDestinations((current) => ({ ...current, [challenge.id]: event.target.value }))} className="mt-1 block h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground">
                    <option value="fidelis">Fidelis</option><option value="depozit">Depozit bancar</option><option value="pilon-iii">Pilon III</option>
                  </select>
                </label>
                <Button disabled={busy} onClick={() => onClean(challenge.id, challenge.minInvestRon, destinationId)}><Check className="size-4" />Curăță și investește {challenge.minInvestRon} RON</Button>
              </div>
            </li>;
          })}
        </ul>
      )}
    </section>
  );
}
