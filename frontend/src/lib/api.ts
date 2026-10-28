import type { OasisQuest } from "@/lib/oasis";

export interface CategoryTotal {
  category: string;
  amountRon: number;
}

export interface DetectedHabit {
  category: string;
  categoryId: string;
  count: number;
  total: number;
  avgPrice: number;
  periodDays: number;
  suggestedReductionPct: number;
  suggestedCount: number;
  weeklySaving: number;
}

export interface InsightsData {
  categoryTotals: CategoryTotal[];
  incomeRon: number;
  spendRon: number;
  habit: DetectedHabit | null;
}

export interface WalletData {
  userId: string;
  balances: { RON_SIM: number; CREDITS: number };
  investedRon: number;
  streak: number;
  inventory: Array<{ id: string; itemId: string; name: string; type: string; placedPlot: string | null }>;
}

export interface ProjectionValue {
  destinationId: string;
  name: string;
  grossAnnual: number;
  netAnnualRate: number;
  nominalRon: number;
  realRon: number;
  totalContributedRon: number;
  deductionBenefitRon: number;
  yearlySeries: Array<{ year: number; nominalRon: number; realRon: number; contributedRon: number }>;
  source: string;
  asOf: string;
  verify: boolean;
  estimateDisclaimer: string;
}

export interface QuestAcceptance {
  alreadyAccepted: boolean;
  quest: Record<string, unknown>;
  balances: { RON_SIM: number; CREDITS: number };
  investedRon: number;
  streak: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8000" : "");

async function requestJson<T>(
  path: string,
  demoUserId: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("x-demo-user", demoUserId);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
    signal: init.signal || AbortSignal.timeout(20000),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : `Serverul a răspuns cu statusul ${response.status}.`;
    throw new Error(message);
  }
  return body as T;
}

export function getInsights(demoUserId: string, signal?: AbortSignal): Promise<InsightsData> {
  return requestJson("/api/insights", demoUserId, { method: "GET", signal });
}

export function importDemoStatement(demoUserId: string): Promise<{ statementId: string; transactionCount: number }> {
  return requestJson("/api/statements/demo", demoUserId, { method: "POST", body: "{}" });
}

export function uploadStatement(file: File, demoUserId: string): Promise<{ statementId: string; transactionCount: number }> {
  const form = new FormData();
  form.append("file", file);
  return requestJson("/api/statements/import", demoUserId, { method: "POST", body: form });
}

export function generateQuest(demoUserId: string, signal?: AbortSignal): Promise<OasisQuest> {
  return requestJson("/api/quests/generate", demoUserId, { method: "POST", body: "{}", signal });
}

export function getWallet(demoUserId: string): Promise<WalletData> {
  return requestJson("/api/wallet", demoUserId, { method: "GET" });
}

export function acceptQuest(questId: string, destinationId: string, demoUserId: string): Promise<QuestAcceptance> {
  return requestJson(`/api/quests/${encodeURIComponent(questId)}/accept`, demoUserId, {
    method: "POST",
    body: JSON.stringify({ destinationId }),
  });
}

export function getProjections(weeklySaving: number, age: number, demoUserId: string): Promise<{ projections: ProjectionValue[] }> {
  const query = new URLSearchParams({ weeklySaving: String(weeklySaving), age: String(age) });
  return requestJson(`/api/projection?${query}`, demoUserId, { method: "GET" });
}

export function deleteUserData(demoUserId: string): Promise<{ deleted: boolean }> {
  return requestJson("/api/me/data", demoUserId, { method: "DELETE" });
}
