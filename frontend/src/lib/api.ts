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

export interface ShopItem {
  id: string;
  name: string;
  type: "building" | "decoration" | "character" | "action";
  priceCredits: number;
  sprite: string;
}

export interface Friend {
  id: string;
  displayName: string;
  handle: string;
  inviteCode: string;
}

export interface BananaChallenge {
  id: string;
  fromUser: string;
  toUser: string;
  blockedPlot: string;
  minInvestRon: number;
  expiresAt: string;
  sender?: Pick<Friend, "id" | "displayName" | "handle">;
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

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
      signal: init.signal || AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Nu mă pot conecta la backend. Pornește serverul din folderul backend și reîncarcă pagina.");
    }
    throw error;
  }
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

export function getShop(demoUserId: string): Promise<ShopItem[]> {
  return requestJson("/api/shop", demoUserId, { method: "GET" });
}

export function buyShopItem(itemId: string, idempotencyKey: string, demoUserId: string): Promise<{ item: WalletData["inventory"][number]; creditsBalance: number }> {
  return requestJson("/api/shop/buy", demoUserId, { method: "POST", body: JSON.stringify({ itemId, idempotencyKey }) });
}

export function placeInventoryItem(itemId: string, plotId: string, demoUserId: string): Promise<WalletData["inventory"][number]> {
  return requestJson("/api/inventory/place", demoUserId, { method: "POST", body: JSON.stringify({ itemId, plotId }) });
}

export function getFriends(demoUserId: string): Promise<Friend[]> {
  return requestJson("/api/friends", demoUserId, { method: "GET" });
}

export function addFriend(lookup: { handle?: string; inviteCode?: string } | string, demoUserId: string): Promise<Friend> {
  const body = typeof lookup === "string"
    ? (/^[A-Z0-9]{6,}$/.test(lookup) && /\d/.test(lookup) ? { inviteCode: lookup.toUpperCase() } : { handle: lookup.replace(/^@/, "").toLowerCase() })
    : lookup;
  return requestJson("/api/friends/add", demoUserId, { method: "POST", body: JSON.stringify(body) });
}

export function muteFriend(friendId: string, muted: boolean, demoUserId: string): Promise<{ muted: boolean }> {
  return requestJson(`/api/friends/${encodeURIComponent(friendId)}/mute`, demoUserId, { method: "POST", body: JSON.stringify({ muted }) });
}

export function sendBanana(toUserId: string, demoUserId: string): Promise<{ challenge: BananaChallenge; creditsBalance: number }> {
  return requestJson("/api/friends/banana", demoUserId, { method: "POST", body: JSON.stringify({ toUserId }) });
}

export function getInbox(demoUserId: string): Promise<BananaChallenge[]> {
  return requestJson("/api/inbox", demoUserId, { method: "GET" });
}

export function cleanBanana(challengeId: string, amountRon: number, destinationId: string, demoUserId: string) {
  return requestJson(`/api/challenges/${encodeURIComponent(challengeId)}/clean`, demoUserId, {
    method: "POST",
    body: JSON.stringify({ amountRon, destinationId }),
  });
}

export function deleteUserData(demoUserId: string): Promise<{ deleted: boolean }> {
  return requestJson("/api/me/data", demoUserId, { method: "DELETE" });
}
