import { getSupabaseClient } from "@/lib/supabase";

export interface OasisQuest {
  id?: string;
  questTitle: string;
  analysisMessage: string;
  proposalMessage: string;
  amountToSave: number;
  virtualReward: string;
  rewardType?: string;
}

export const OASIS_API_URL = import.meta.env["VITE_OASIS_API_URL"] ||
  (import.meta.env.DEV ? "http://localhost:8000/api/oasis" : "/api/oasis");
export const DEMO_QUEST: OasisQuest = {
  questTitle: "Operațiunea: Salvatorul de Cafea",
  analysisMessage: "Am observat că ai plătit 6 cafele săptămâna trecută (120 RON).",
  proposalMessage: "Ce-ar fi să cumperi doar 4 săptămâna asta? Cei 40 RON salvați se transformă instant într-o Pisicuță virtuală și o Cafenea pentru insula ta.",
  amountToSave: 40,
  virtualReward: "Cafenea & Pisicuță",
  rewardType: "building",
};

export function isOasisQuest(value: unknown): value is OasisQuest {
  if (!value || typeof value !== "object") return false;
  const q = value as Record<string, unknown>;
  return ["questTitle", "analysisMessage", "proposalMessage", "virtualReward"].every(
    (key) => typeof q[key] === "string" && (q[key] as string).trim().length > 0,
  ) && typeof q['amountToSave'] === "number" && Number.isFinite(q['amountToSave']) && q['amountToSave'] > 0
    && (q['rewardType'] === undefined || typeof q['rewardType'] === "string");
}

export async function fetchOasis(signal?: AbortSignal, demoUserId = "demo-ioana"): Promise<OasisQuest> {
  try {
    const supabase = getSupabaseClient();
    const { data: sessionData, error: sessionError } = supabase
      ? await supabase.auth.getSession()
      : { data: { session: null }, error: null };
    if (sessionError) throw sessionError;
    if (!sessionData.session?.access_token) throw new Error("auth");

    const response = await fetch(OASIS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
        ...(import.meta.env.DEV ? { "x-demo-user": demoUserId } : {}),
      },
      credentials: "include",
      body: JSON.stringify({}),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Serverul a răspuns cu statusul ${response.status}.`;
      throw new Error(message);
    }
    if (!isOasisQuest(data)) throw new Error("contract");
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Serverul AI nu a răspuns la timp. Încearcă din nou.");
    }
    throw error;
  }
}

export interface CityState {
  simulatedBalance: number;
  saved: number;
  cityLevel: number;
  isRuined: boolean;
  accepted: boolean;
  rewards: string[];
}
export const INITIAL_CITY: CityState = {
  simulatedBalance: 5000, saved: 0, cityLevel: 1, isRuined: false, accepted: false, rewards: [],
};
export type CityAction =
  | { type: "accept"; quest: OasisQuest }
  | { type: "withdraw" }
  | { type: "newQuest" }
  | { type: "reset" }
  | { type: "syncWallet"; simulatedBalance: number; investedRon: number; inventory: Array<{ name: string }>; accepted?: boolean };
export function cityReducer(state: CityState, action: CityAction): CityState {
  if (action.type === "reset") return INITIAL_CITY;
  if (action.type === "syncWallet") return {
    ...state,
    simulatedBalance: action.simulatedBalance,
    saved: action.investedRon,
    cityLevel: Math.max(1, action.inventory.length + 1),
    rewards: action.inventory.map((item) => item.name),
    isRuined: action.accepted ? false : state.isRuined,
    accepted: action.accepted ?? false,
  };
  if (action.type === "newQuest") return { ...state, accepted: false };
  if (action.type === "withdraw") return {
    ...INITIAL_CITY, simulatedBalance: Math.round((state.simulatedBalance + state.saved) * 100) / 100, isRuined: true,
  };
  if (state.accepted || !isOasisQuest(action.quest) || action.quest.amountToSave > state.simulatedBalance) return state;
  return {
    simulatedBalance: Math.round((state.simulatedBalance - action.quest.amountToSave) * 100) / 100,
    saved: Math.round((state.saved + action.quest.amountToSave) * 100) / 100,
    cityLevel: state.cityLevel + 1, isRuined: false, accepted: true,
    rewards: [...state.rewards, action.quest.virtualReward],
  };
}

export function rewardSymbol(reward: string, type?: string): string {
  const text = reward.toLocaleLowerCase("ro");
  if (text.includes("cafe")) return "🏪";
  if (text.includes("hotel")) return "🏨";
  if (text.includes("copac") || type === "nature") return "🌳";
  if (text.includes("pisic") || type === "pet") return "🐈";
  return "🏡";
}