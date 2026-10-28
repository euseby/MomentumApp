const assert = require("node:assert/strict");
const test = require("node:test");
const { createApp, extractJsonObject, normalizeQuestResponse } = require("./server");

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
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/momentum`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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