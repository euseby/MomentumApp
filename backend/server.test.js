const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createApp,
  extractJsonObject,
  normalizeOasisAnalysis,
  normalizeQuestCopy,
  normalizeQuestResponse,
  OASIS_BANK_TRANSACTIONS,
  addLedgerEntry,
  getWalletBalances,
} = require("./server");
const { createMemoryRepository } = require("./src/repo");

const requestBody = {
  age: 24,
  monthlyIncome: 4000,
  guiltyPleasure: "Comenzi Tazz",
  monthlyGuiltyPleasureSpend: 400,
};

const oasisResponse = {
  questTitle: "Misiunea de azi",
  questStory: "Pune deoparte o sumă mică pentru insula ta.",
  amountToSave: 25,
  virtualReward: "Casă pe Plajă",
  futureRealValue: 12500,
  streakBonus: true,
};

async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("POST /api/momentum computes money values in code and forwards user data", async () => {
  let completionRequest;
  const app = createApp({
    chat: {
      completions: {
        create: async (request) => {
          completionRequest = request;
          return {
            choices: [{ message: { content: JSON.stringify({ questTitle: "Misiunea de azi", questStory: "Redu puțin obiceiul.", rewardId: "cafenea" }) } }],
          };
        },
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/momentum`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.questTitle, "Misiunea de azi");
  assert.equal(result.questStory, "Redu puțin obiceiul.");
  assert.equal(result.amountToSave, 4.4);
  assert.equal(result.virtualReward, "Cafenea");
  assert.equal(typeof result.futureRealValue, "number");
  assert.equal(result.streakBonus, true);
    assert.match(completionRequest.messages[1].content, /Comenzi Tazz/);
  assert.doesNotMatch(completionRequest.messages[1].content, /400 RON/);
  });
});

test("invalid request data is rejected before calling the LLM", async () => {
  let llmCalled = false;
  const app = createApp({
    chat: { completions: { create: async () => { llmCalled = true; } } },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/momentum`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...requestBody, age: 0 }),
    });

    assert.equal(response.status, 400);
    assert.equal(llmCalled, false);
  });
});

test("LLM errors are returned instead of a hardcoded mission", async () => {
  const app = createApp({
    chat: { completions: { create: async () => { throw new Error("provider unavailable"); } } },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/momentum`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const payload = await response.json();

    assert.equal(response.status, 502);
    assert.equal(typeof payload.error, "string");
    assert.equal("questTitle" in payload, false);
  });
});

test("extracts JSON from surrounding model text and markdown", () => {
  const parsed = extractJsonObject(
    `Rezultat:\n\`\`\`json\n${JSON.stringify(oasisResponse)}\n\`\`\``
  );

  assert.deepEqual(parsed, oasisResponse);
});

test("normalizes the Oasis response and rejects missing fields", () => {
  assert.deepEqual(
    normalizeQuestResponse({ ...oasisResponse, streakBonus: false }),
    oasisResponse,
  );
  assert.throws(
    () => normalizeQuestResponse({ questTitle: "Incomplete" }),
    /questStory/,
  );
});

test("POST /api/oasis sends ten transactions and returns the shared contract", async () => {
  const analysis = { questTitle: "Operațiunea: Salvatorul de Cafea", rewardId: "cafenea" };
  let completionRequest;
  const app = createApp({
    chat: {
      completions: {
        create: async (request) => {
          completionRequest = request;
          return { choices: [{ message: { content: JSON.stringify(analysis) } }] };
        },
      },
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/oasis`, { method: "POST" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      questTitle: analysis.questTitle,
      analysisMessage: "Am observat 6 cafele săptămâna trecută (120 RON).",
      proposalMessage: "Ce-ar fi să cumperi doar 4 săptămâna asta? Cei 40 RON economisiți se transformă într-un Cafenea pentru insula ta.",
      amountToSave: 40,
      virtualReward: "Cafenea",
      rewardType: "building",
    });
    assert.equal(OASIS_BANK_TRANSACTIONS.length, 10);
    assert.equal(
      OASIS_BANK_TRANSACTIONS.filter((transaction) =>
        ["Starbucks", "5 to go"].includes(transaction.merchant),
      ).length,
      6,
    );
    assert.equal(
      OASIS_BANK_TRANSACTIONS
        .filter((transaction) => ["Starbucks", "5 to go"].includes(transaction.merchant))
        .reduce((sum, transaction) => sum + transaction.amount, 0),
      120,
    );
    const llmInput = JSON.parse(completionRequest.messages[1].content);
    assert.deepEqual(llmInput.habit, {
      category: "cafea",
      count: 6,
      total: 120,
      avgPrice: 20,
      periodDays: 7,
      suggestedReductionPct: 0.33,
      suggestedCount: 4,
      weeklySaving: 40,
    });
    assert.equal("transactions" in llmInput, false);
  });
});

test("Oasis contract rejects responses without rewardType", () => {
  assert.throws(
    () => normalizeOasisAnalysis({
      questTitle: "Quest",
      analysisMessage: "Analysis",
      proposalMessage: "Proposal",
      amountToSave: 40,
      virtualReward: "Cafenea",
    }),
    /rewardType/,
  );
});

test("LLM quest copy cannot inject numeric claims", () => {
  assert.throws(
    () => normalizeQuestCopy({ questTitle: "Economisește 40 RON", rewardId: "cafenea" }),
    /nu poate conține numere/,
  );
});

test("GET /api/wallet is scoped to either seeded demo user", async () => {
  const repo = createMemoryRepository();
  const app = createApp(null, repo);

  await withServer(app, async (baseUrl) => {
    for (const userId of ["demo-ioana", "demo-radu"]) {
      const response = await fetch(`${baseUrl}/api/wallet`, {
        headers: { "x-demo-user": userId },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        userId,
        balances: { RON_SIM: 5000, CREDITS: 0 },
      });
    }
  });
});

test("CORS allows the local frontend origin, credentials, and demo user header", async () => {
  const app = createApp(null, createMemoryRepository());

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/wallet`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:8080",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "x-demo-user",
      },
    });

    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:8080");
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.match(response.headers.get("access-control-allow-headers"), /x-demo-user/i);
  });
});

test("ledger is idempotent, sums entries, and never permits a negative balance", async () => {
  const repo = createMemoryRepository();
  const entry = {
    userId: "demo-ioana",
    currency: "RON_SIM",
    amount: -125,
    kind: "test_spend",
    refType: "test",
    refId: "quest-1",
    idempotencyKey: "test:quest-1",
  };

  const first = await addLedgerEntry(repo, entry);
  const duplicate = await addLedgerEntry(repo, entry);
  assert.equal(first.id, duplicate.id);
  assert.equal(await repo.getBalance("demo-ioana", "RON_SIM"), 4875);
  assert.deepEqual(await getWalletBalances(repo, "demo-ioana"), {
    RON_SIM: 4875,
    CREDITS: 0,
  });
  await assert.rejects(
    addLedgerEntry(repo, { ...entry, amount: -5000, idempotencyKey: "test:overspend" }),
    (error) => error.code === "INSUFFICIENT_FUNDS",
  );
  await assert.rejects(
    addLedgerEntry(repo, { ...entry, amount: -1 }),
    (error) => error.code === "IDEMPOTENCY_CONFLICT",
  );
});

test("repository records cannot be moved into another user's scope", async () => {
  const repo = createMemoryRepository();
  const quest = await repo.createQuest("demo-ioana", {
    userId: "demo-radu",
    questTitle: "Ioana's quest",
  });

  assert.equal(quest.userId, "demo-ioana");
  assert.equal(await repo.getQuest("demo-radu", quest.id), null);
  assert.equal((await repo.getQuest("demo-ioana", quest.id)).questTitle, "Ioana's quest");
});