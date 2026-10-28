import { Coins, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ShopItem } from "@/lib/api";

interface ShopProps {
  items: ShopItem[];
  credits: number;
  loading: boolean;
  onBuy: (itemId: string) => void;
}

export function Shop({ items, credits, loading, onBuy }: ShopProps) {
  return (
    <section aria-label="Shop insulă" className="border-y border-border py-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><h2 className="font-bold">Shop-ul insulei</h2><p className="mt-1 text-xs text-muted-foreground">Item-urile se cumpără cu credite câștigate din investiții simulate.</p></div>
        <span className="flex items-center gap-1 text-sm font-bold text-neon"><Coins className="size-4" />{credits}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <article key={item.id} className="flex flex-col justify-between rounded-md border border-border p-3">
            <div><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{item.type}</p></div>
            {item.type === "action" ? <p className="mt-3 text-xs text-muted-foreground">Trimite-o unui prieten din panoul social.</p> : (
              <Button className="mt-3 w-full" variant="outline" disabled={loading || credits < item.priceCredits} onClick={() => onBuy(item.id)}>
                <ShoppingBag className="size-4" />{item.priceCredits} credite
              </Button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
