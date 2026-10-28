import { ChartNoAxesColumn, TrendingDown, TrendingUp } from "lucide-react";
import type { InsightsData } from "@/lib/api";

const ron = (value: number) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(value) + " RON";

interface InsightsPanelProps {
  insights: InsightsData | null;
  loading: boolean;
}

export function InsightsPanel({ insights, loading }: InsightsPanelProps) {
  const maxAmount = Math.max(1, ...(insights?.categoryTotals.map((item) => Math.abs(item.amountRon)) || []));

  return (
    <section aria-label="Sumarul tranzacțiilor" className="mb-7 border-b border-border pb-6">
      <div className="mb-4 flex items-center gap-2">
        <ChartNoAxesColumn className="size-4 text-neon" />
        <h2 className="font-bold">Sumarul ultimelor 28 de zile</h2>
      </div>
      {loading && !insights ? (
        <p role="status" className="text-sm text-muted-foreground">Analizăm tranzacțiile…</p>
      ) : !insights || !insights.categoryTotals.length ? (
        <p className="text-sm text-muted-foreground">Importă un extras pentru a vedea categoriile și obiceiurile detectate.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(16rem,1fr)]">
          <div className="space-y-3">
            {insights.categoryTotals.map((item) => (
              <div key={item.category} className="grid grid-cols-[7rem_minmax(0,1fr)_6.5rem] items-center gap-3 text-xs">
                <span className="truncate capitalize text-muted-foreground">{item.category.replaceAll("_", " ")}</span>
                <span className="h-2 overflow-hidden rounded-full bg-secondary">
                  <span className="block h-full rounded-full bg-neon" style={{ width: `${Math.max(3, Math.abs(item.amountRon) / maxAmount * 100)}%` }} />
                </span>
                <span className="text-right tabular-nums">{ron(Math.abs(item.amountRon))}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-5 md:justify-end">
            <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="size-3 text-primary" />Venituri</p><p className="mt-1 font-bold tabular-nums">{ron(insights.incomeRon)}</p></div>
            <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingDown className="size-3 text-destructive" />Cheltuieli</p><p className="mt-1 font-bold tabular-nums">{ron(insights.spendRon)}</p></div>
            {insights.habit && <div><p className="text-xs text-neon">Obicei observat</p><p className="mt-1 font-bold">{insights.habit.count} × {insights.habit.category}</p><p className="text-xs text-muted-foreground">{ron(insights.habit.total)}</p></div>}
          </div>
        </div>
      )}
    </section>
  );
}
