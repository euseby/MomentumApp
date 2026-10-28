import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptQuest, getInsights, getProjections, importDemoStatement, uploadStatement } from "@/lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("Phase 1 API client", () => {
  it("loads user-scoped insights", async () => {
    const insights = {
      categoryTotals: [{ category: "coffee", amountRon: -120 }],
      incomeRon: 4000,
      spendRon: 120,
      habit: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(insights), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getInsights("demo-radu")).resolves.toEqual(insights);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/insights");
    expect(options.method).toBe("GET");
    expect(options.credentials).toBe("include");
    expect(new Headers(options.headers).get("x-demo-user")).toBe("demo-radu");
  });

  it("sends demo and uploaded statements to separate endpoints", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ statementId: "demo-1", transactionCount: 10 }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ statementId: "csv-1", transactionCount: 2 }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(importDemoStatement("demo-ioana")).resolves.toEqual({ statementId: "demo-1", transactionCount: 10 });
    const file = new File(["Data,Descriere,Suma\n"], "extras.csv", { type: "text/csv" });
    await expect(uploadStatement(file, "demo-ioana")).resolves.toEqual({ statementId: "csv-1", transactionCount: 2 });

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/api/statements/demo");
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:8000/api/statements/import");
    expect(fetchMock.mock.calls[1][1]?.body).toBeInstanceOf(FormData);
  });

  it("sends quest acceptance and projection requests with the selected user", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ alreadyAccepted: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projections: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await acceptQuest("quest-1", "fidelis", "demo-radu");
    await getProjections(40, 24, "demo-radu");

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/api/quests/quest-1/accept");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ destinationId: "fidelis" });
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("x-demo-user")).toBe("demo-radu");
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:8000/api/projection?weeklySaving=40&age=24");
  });
});
