import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMomentum, projectValue } from "@/lib/momentum";

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

describe("projectValue", () => {
  it("compounds 100 lei/lună timp de 1 an la 6%", () => expect(projectValue(100, 1)).toBe(1234));
  it("returnează 0 pentru zero ani", () => expect(projectValue(200, 0)).toBe(0));
});

describe("fetchMomentum", () => {
  it("returns the live Oasis response", async () => {
    const quest = {
      questTitle: "Misiunea de azi",
      questStory: "Economisește pentru insula ta.",
      amountToSave: 25,
      virtualReward: "Casă pe Plajă",
      futureRealValue: 12500,
      streakBonus: true,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => quest });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchMomentum({
        age: 24,
        monthlyIncome: 4000,
        guiltyPleasure: "Cafea",
        monthlyGuiltyPleasureSpend: 400,
      }),
    ).resolves.toEqual(quest);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-access-token" }),
      }),
    );
  });

  it("surfaces backend errors instead of showing mock data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ error: "Provider indisponibil." }),
      }),
    );

    await expect(
      fetchMomentum({
        age: 24,
        monthlyIncome: 4000,
        guiltyPleasure: "Cafea",
        monthlyGuiltyPleasureSpend: 400,
      }),
    ).rejects.toThrow("Provider indisponibil.");
  });
});
