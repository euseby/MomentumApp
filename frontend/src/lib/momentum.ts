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

export async function fetchMomentum(payload: MomentumRequest): Promise<OasisResponse> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20000);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : `Backendul a răspuns cu statusul ${res.status}.`;
      throw new Error(message);
    }

    if (!isValid(data)) {
      throw new Error("Backendul a trimis un răspuns care nu respectă contractul Oasis.");
    }

    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Modelul AI nu a răspuns în 20 de secunde. Încearcă din nou.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Nu mă pot conecta la backend. Verifică dacă serverul rulează pe portul 8000.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Valoarea viitoare a unei contribuții lunare, cu dobândă compusă lunar (Tezaur ~6%/an). */
export function projectValue(monthly: number, years: number, annualRate = 0.06): number {
  if (monthly <= 0 || years <= 0) return 0;
  const r = annualRate / 12,
    n = Math.round(years * 12);
  return Math.round(monthly * ((Math.pow(1 + r, n) - 1) / r));
}
