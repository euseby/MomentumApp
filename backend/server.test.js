const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createApp,
  extractJsonObject,
  normalizeOasisAnalysis,
  normalizeQuestResponse,
  OASIS_BANK_TRANSACTIONS,
} = require("./server");

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

const verifyTestToken = async (token) =>
  token === "valid-test-token" ? { id: "test-user" } : null;

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

test("POST /api/momentum forwards user data and returns the Oasis contract", async () => {
  let completionRequest;
  const app = createApp({
    chat: {
      completions: {
        create: async (request) => {
          completionRequest = request;
          return {
            choices: [{ message: { content: JSON.stringify(oasisResponse) } }],
          };
        },
      },
    },
  }, verifyTestToken);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/momentum`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-test-token",
      },
      body: JSON.stringify(requestBody),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), oasisResponse);
    assert.match(completionRequest.messages[1].content, /Comenzi Tazz/);
  });
});

test("invalid request data is rejected before calling the LLM", async () => {
  let llmCalled = false;
  const app = createApp({
    chat: { completions: { create: async () => { llmCalled = true; } } },
  }, verifyTestToken);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/momentum`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-test-token",
      },
      body: JSON.stringify({ ...requestBody, age: 0 }),
    });

    assert.equal(response.status, 400);
    assert.equal(llmCalled, false);
  });
});

test("LLM errors are returned instead of a hardcoded mission", async () => {
  const app = createApp({
    chat: { completions: { create: async () => { throw new Error("provider unavailable"); } } },
  }, verifyTestToken);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/momentum`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-test-token",
      },
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
  const analysis = {
    questTitle: "Operațiunea: Salvatorul de Cafea",
    analysisMessage: "Ai cumpărat 6 cafele, în total 120 RON.",
    proposalMessage: "Redu cu două cafele și deblochează o cafenea.",
    amountToSave: 40,
    virtualReward: "Cafenea & Pisicuță",
    rewardType: "building",
  };
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
  }, verifyTestToken);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/oasis`, {
      method: "POST",
      headers: { Authorization: "Bearer valid-test-token" },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), analysis);
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
    assert.match(completionRequest.messages[1].content, /Salariu/);
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

test("AI endpoints reject missing or invalid Supabase tokens", async () => {
  const app = createApp(null, verifyTestToken);

  await withServer(app, async (baseUrl) => {
    for (const path of ["/api/momentum", "/api/oasis"]) {
      const missingToken = await fetch(`${baseUrl}${path}`, { method: "POST" });
      assert.equal(missingToken.status, 401, `${path} should reject missing token`);

      const invalidToken = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: "Bearer invalid-test-token" },
      });
      assert.equal(invalidToken.status, 401, `${path} should reject invalid token`);
    }
  });
});