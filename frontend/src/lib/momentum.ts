export interface MomentumRequest {
  age: number;
  monthlyIncome: number;
  guiltyPleasure: string;
  monthlyGuiltyPleasureSpend: number;
}

/** Contractul JSON „Oasis” — sursa de adevăr cu backend-ul. */
export interface OasisResponse {
  questTitle: string;
  questStory: string;
  amountToSave: number;
  virtualReward: string;
  futureRealValue: number;
  streakBonus: boolean;
}

export const API_URL = "http://localhost:8000/api/momentum";

export const MOCK_RESPONSE: OasisResponse = {
  questTitle: "Misiunea de Vineri: Salvatorul de Dopamină",
  questStory:
    "Știu că vrei să iei un Bolt spre casă. Dacă iei metroul azi, primești o Casă pe Plajă pe insula ta și banii se duc în portofoliul tău.",
  amountToSave: 25,
  virtualReward: "Casă pe Plajă",
  futureRealValue: 12500,
  streakBonus: true,
};

function isValid(d: unknown): d is OasisResponse {
  const o = d as Partial<Record<keyof OasisResponse, unknown>>;
  return (
    !!o &&
    typeof o.questTitle === "string" &&
    typeof o.questStory === "string" &&
    typeof o.amountToSave === "number" &&
    typeof o.virtualReward === "string" &&
    typeof o.futureRealValue === "number" &&
    typeof o.streakBonus === "boolean"
  );
}

export async function fetchMomentum(
  payload: MomentumRequest,
): Promise<{ data: OasisResponse; mock: boolean }> {
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
  const r = annualRate / 12,
    n = Math.round(years * 12);
  return Math.round(monthly * ((Math.pow(1 + r, n) - 1) / r));
}
