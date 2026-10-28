import { afterEach, describe, expect, it, vi } from "vitest";
import { cityReducer, INITIAL_CITY, DEMO_QUEST, fetchOasis, isOasisQuest } from "@/lib/oasis";

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "test-access-token" } },
        error: null,
      }),
    },
  }),
}));

afterEach(() => vi.unstubAllGlobals());
describe("Oasis simulation", () => {
  it("starts with 5000 RON, level 1, and an intact city", () => {
    expect(INITIAL_CITY.simulatedBalance).toBe(5000);
    expect(INITIAL_CITY.cityLevel).toBe(1);
    expect(INITIAL_CITY.isRuined).toBe(false);
  });
  it("deducts the proposed 40 RON, increases the level and adds the reward", () => {
    const next = cityReducer(INITIAL_CITY, { type: "accept", quest: DEMO_QUEST });
    expect(next.simulatedBalance).toBe(4960);
    expect(next.saved).toBe(40);
    expect(next.cityLevel).toBe(2);
    expect(next.rewards).toEqual(["Cafenea & Pisicuță"]);
  });
  it("does not charge the same accepted challenge twice", () => {
    const next = cityReducer(INITIAL_CITY, { type: "accept", quest: DEMO_QUEST });
    expect(cityReducer(next, { type: "accept", quest: DEMO_QUEST })).toEqual(next);
  });
  it("withdrawal ruins and resets the city and restores simulated savings", () => {
    const next = cityReducer(INITIAL_CITY, { type: "accept", quest: DEMO_QUEST });
    const withdrawn = cityReducer(next, { type: "withdraw" });
    expect(withdrawn.isRuined).toBe(true);
    expect(withdrawn.cityLevel).toBe(1);
    expect(withdrawn.rewards).toEqual([]);
    expect(withdrawn.simulatedBalance).toBe(5000);
    expect(withdrawn.saved).toBe(0);
  });
  it("prevents investing more than the available balance", () => {
    expect(cityReducer(INITIAL_CITY, { type: "accept", quest: { ...DEMO_QUEST, amountToSave: 5001 } })).toEqual(INITIAL_CITY);
  });
  it("accepts backend JSON without optional rewardType", () => {
    const { rewardType: _, ...quest } = DEMO_QUEST;
    expect(isOasisQuest(quest)).toBe(true);
    expect(isOasisQuest({ ...quest, amountToSave: -40 })).toBe(false);
    expect(isOasisQuest({ ...quest, amountToSave: Infinity })).toBe(false);
    expect(isOasisQuest({ ...quest, analysisMessage: undefined })).toBe(false);
  });
  it("posts to /api/oasis with cookies and consumes the exact response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(DEMO_QUEST), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchOasis()).toEqual({ data: DEMO_QUEST, mock: false });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/oasis", expect.objectContaining({
      method: "POST",
      body: "{}",
      credentials: "include",
      headers: expect.objectContaining({ Authorization: "Bearer test-access-token" }),
    }));
  });
  it("falls back for network errors and incompatible JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await fetchOasis()).mock).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ questStory: "old contract" }))));
    expect((await fetchOasis()).data).toEqual(DEMO_QUEST);
  });
});