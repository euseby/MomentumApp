export interface MomentumRequest {
  age: number;
  monthlyIncome: number;
  guiltyPleasure: string;
  monthlyGuiltyPleasureSpend: number;
}
export interface MomentumResponse {
  habitToChange: string;
  monthlySavings: number;
  futureValueAt65: number;
  investmentVehicle: string;
  actionMessage: string;
  confidenceScore: number;
}
export const API_URL = "http://localhost:8000/api/momentum";
export const MOCK_RESPONSE: MomentumResponse = {
  habitToChange: "Comenzi de mâncare",
  monthlySavings: 200,
  futureValueAt65: 125000,
  investmentVehicle: "Titluri de stat Tezaur (fără taxe)",
  actionMessage:
    "Dacă înlocuiești 2 comenzi Tazz pe săptămână cu gătitul acasă, la 65 de ani vei avea echivalentul unui apartament.",
  confidenceScore: 85,
};
function isValid(d: unknown): d is MomentumResponse {
  const o = d as Partial<Record<keyof MomentumResponse, unknown>>;
  return !!o && typeof o.habitToChange === "string" && typeof o.monthlySavings === "number" &&
    typeof o.futureValueAt65 === "number" && typeof o.investmentVehicle === "string" &&
    typeof o.actionMessage === "string" && typeof o.confidenceScore === "number";
}
export async function fetchMomentum(payload: MomentumRequest): Promise<{ data: MomentumResponse; mock: boolean }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    if (!isValid(data)) throw new Error("invalid");
    return { data, mock: false };
  } catch {
    await new Promise((r) => setTimeout(r, 1200));
    return { data: MOCK_RESPONSE, mock: true };
  }
}

/** Valoarea viitoare a unei contribuții lunare, cu dobândă compusă lunar (Tezaur ~6%/an). */
export function projectValue(monthly: number, years: number, annualRate = 0.06): number {
  if (monthly <= 0 || years <= 0) return 0;
  const r = annualRate / 12, n = Math.round(years * 12);
  return Math.round(monthly * ((Math.pow(1 + r, n) - 1) / r));
}
