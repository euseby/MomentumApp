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

export function deleteUserData(demoUserId: string): Promise<{ deleted: boolean }> {
  return requestJson("/api/me/data", demoUserId, { method: "DELETE" });
}
