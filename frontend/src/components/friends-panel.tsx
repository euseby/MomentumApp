import { useState } from "react";
import { Banana, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Friend } from "@/lib/api";

interface FriendsPanelProps {
  friends: Friend[];
  credits: number;
  busy: boolean;
  onAdd: (lookup: string) => void;
  onSendBanana: (friendId: string) => void;
}

export function FriendsPanel({ friends, credits, busy, onAdd, onSendBanana }: FriendsPanelProps) {
  const [lookup, setLookup] = useState("");
  return (
    <section aria-label="Prieteni" className="border-y border-border py-6">
      <div className="mb-4"><h2 className="font-bold">Insule prietene</h2><p className="mt-1 text-xs text-muted-foreground">Banană: doar între prieteni, fără penalizări și cu bonus comun la curățare.</p></div>
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); if (lookup.trim()) onAdd(lookup.trim()); }}>
        <input aria-label="Handle sau cod de invitație" value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="Handle sau cod de invitație" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <Button type="submit" variant="outline" disabled={busy || !lookup.trim()}><UserPlus className="size-4" />Adaugă</Button>
      </form>
      <ul className="divide-y divide-border">
        {friends.map((friend) => <li key={friend.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div><p className="font-semibold">{friend.displayName}</p><p className="text-xs text-muted-foreground">@{friend.handle} · cod {friend.inviteCode}</p></div>
          <Button size="sm" variant="outline" disabled={busy || credits < 40} onClick={() => onSendBanana(friend.id)}><Banana className="size-4" />Trimite · 40 credite</Button>
        </li>)}
        {!friends.length && <li className="py-3 text-sm text-muted-foreground">Adaugă un prieten pentru provocări cooperative.</li>}
      </ul>
    </section>
  );
}
