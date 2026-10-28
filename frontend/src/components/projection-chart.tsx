import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProjectionValue } from "@/lib/api";

const ron = (value: number) => new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(value) + " RON";
const colors = ["#78f2b4", "#77d8f2", "#f3c969"];

interface ProjectionChartProps {
  projections: ProjectionValue[];
  loading: boolean;
}

export function ProjectionChart({ projections, loading }: ProjectionChartProps) {
  if (loading && !projections.length) {
    return <section aria-label="Proiecții la pensie" className="mb-7 border-b border-border pb-6"><h2 className="mb-3 font-bold">Viitorul tău la 65 de ani</h2><p role="status" className="text-sm text-muted-foreground">Calculăm scenariile…</p></section>;
  }
  if (!projections.length) return null;

  const yearly = new Map<number, Record<string, number>>();
  for (const projection of projections) {
    for (const point of projection.yearlySeries) {
      const row = yearly.get(point.year) || { year: point.year };
      row[projection.destinationId] = point.realRon;
      yearly.set(point.year, row);
    }
  }
  const chartData = [...yearly.values()];

  return (
    <section aria-label="Proiecții la pensie" className="mb-7 border-b border-border pb-7">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="font-bold">Viitorul tău la 65 de ani</h2><p className="mt-1 text-xs text-muted-foreground">Contribuții săptămânale estimate; simulare, nu garanție.</p></div>
        <span className="text-xs text-neon">Valori reale după inflație</span>
      </div>
      <div className="h-56 w-full" role="img" aria-label="Grafic comparativ al valorii reale anuale">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip formatter={(value: number) => [ron(value), "Valoare reală"]} labelFormatter={(year) => `Vârsta ${year}`} />
            {projections.map((projection, index) => <Line key={projection.destinationId} type="monotone" dataKey={projection.destinationId} name={projection.name} stroke={colors[index % colors.length]} strokeWidth={2} dot={false} connectNulls />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {projections.map((projection, index) => (
          <article key={projection.destinationId} className="rounded-md border border-border p-4">
            <h3 className="font-semibold" style={{ color: colors[index % colors.length] }}>{projection.name}</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Nominal</dt><dd className="font-semibold tabular-nums">{ron(projection.nominalRon)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Real</dt><dd className="font-semibold tabular-nums">{ron(projection.realRon)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Contribuit</dt><dd className="tabular-nums">{ron(projection.totalContributedRon)}</dd></div>
              {projection.deductionBenefitRon > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Deducere estimată</dt><dd className="tabular-nums">{ron(projection.deductionBenefitRon)}</dd></div>}
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{projection.source} · {projection.asOf}{projection.verify ? " · de verificat" : ""}</p>
            <p className="mt-2 text-xs text-muted-foreground">{projection.estimateDisclaimer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
