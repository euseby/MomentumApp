const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createApp,
  extractJsonObject,
  normalizeOasisAnalysis,
  normalizeQuestCopy,
  normalizeQuestResponse,
  stripNumericClaims,
  addLedgerEntry,
  getWalletBalances,
} = require("./server");
const { createMemoryRepository } = require("./src/repo");
const { parseStatementCsv, parseStatementText, normalizeMerchant, categorize } = require("./src/services/statements");
const { projectAll, projectDestination, destinations } = require("./src/services/projection");

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
    const llmInput = JSON.parse(completionRequest.messages[1].content);
    assert.deepEqual(Object.keys(llmInput), ["habit", "rewards"]);
    assert.equal(llmInput.habit.total, 400);
    assert.equal(JSON.stringify(llmInput).includes("Comenzi Tazz"), false);
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

test("POST /api/oasis uses imported aggregates and returns the shared contract", async () => {
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
    await fetch(`${baseUrl}/api/statements/demo`, {
      method: "POST",
      headers: { "x-demo-user": "demo-ioana" },
    });
    const response = await fetch(`${baseUrl}/api/oasis`, { method: "POST" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      questTitle: analysis.questTitle,
      analysisMessage: "Am observat 6 cafea în 7 zile (120 RON).",
      proposalMessage: "Ce-ar fi să reduci la 4 apariții? Ai economisi 40 RON pe săptămână și ai debloca Cafenea.",
      amountToSave: 40,
      virtualReward: "Cafenea",
      rewardType: "building",
    });
    const llmInput = JSON.parse(completionRequest.messages[1].content);
    assert.equal(llmInput.habit.count, 6);
    assert.equal(llmInput.habit.total, 120);
    assert.equal(llmInput.habit.weeklySaving, 40);
    assert.equal("transactions" in llmInput, false);
    assert.equal(JSON.stringify(llmInput).includes("Starbucks"), false);
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

test("LLM quest copy strips numeric claims while code owns amounts", () => {
  const copy = normalizeQuestCopy({
    questTitle: "Misiunea 2026",
    questStory: "Economisește 40 RON pentru oraș.",
    rewardId: "cafenea",
  }, { requireStory: true });
  assert.equal(copy.questTitle, "Misiunea");
  assert.equal(copy.questStory, "Economisește pentru oraș.");
  assert.equal(stripNumericClaims("Quest 12,5 RON"), "Quest");
});

test("CSV parser handles comma delimiter, signed amounts, and skips bad rows", () => {
  const csv = Buffer.from([
    "Date,Description,Amount",
    "2026-10-19,PLATA POS 5 to go Bucuresti,-20.00",
    "bad-date,Starbucks,-20.00",
    "2026-10-20,Salariu,4000.00",
  ].join("\n"));
  const transactions = parseStatementCsv(csv);

  assert.equal(transactions.length, 2);
  assert.deepEqual(transactions[0], {
    date: "2026-10-19",
    merchantNorm: "to go",
    category: "coffee",
    amountRon: -20,
  });
  assert.equal(transactions[1].amountRon, 4000);
  assert.equal(transactions[1].category, "income");
});

test("CSV parser handles semicolon delimiter, decimal comma, and debit/credit columns", () => {
  const csv = Buffer.from([
    "Data;Descriere;Debit;Credit",
    "27.10.2026;PLATA POS Starbucks Bucuresti;20,50;",
    "27/10/2026;Salariu;;4000,00",
  ].join("\n"));
  const transactions = parseStatementCsv(csv);

  assert.equal(transactions[0].amountRon, -20.5);
  assert.equal(transactions[0].category, "coffee");
  assert.equal(transactions[1].date, "2026-10-27");
  assert.equal(transactions[1].amountRon, 4000);
});

test("CSV parser rejects empty input and anonymizes private-person transfers", () => {
  assert.throws(() => parseStatementCsv(Buffer.from("  ")), /gol/);
  assert.equal(normalizeMerchant("Transfer catre Ion Popescu"), "Transfer");
  assert.equal(normalizeMerchant("Virament Maria Ionescu"), "Transfer");
  assert.equal(categorize("Transfer"), "transfer");
});

test("demo statement produces deterministic insights and a user-scoped quest", async () => {
  const repo = createMemoryRepository();
  let llmRequest;
  const llmClient = {
    chat: {
      completions: {
        create: async (request) => {
          llmRequest = request;
          return {
            choices: [{ message: { content: JSON.stringify({ questTitle: "Operațiunea Cafea", questStory: "Fiecare alegere mică îți crește insula.", rewardId: "cafenea" }) } }],
          };
        },
      },
    },
  };
  const app = createApp(llmClient, repo);

  await withServer(app, async (baseUrl) => {
    const userHeaders = { "x-demo-user": "demo-ioana" };
    const imported = await fetch(`${baseUrl}/api/statements/demo`, { method: "POST", headers: userHeaders });
    assert.equal(imported.status, 201);
    const importResult = await imported.json();
    assert.equal(typeof importResult.statementId, "string");
    assert.equal(importResult.transactionCount, 10);

    const insightsResponse = await fetch(`${baseUrl}/api/insights`, { headers: userHeaders });
    const insights = await insightsResponse.json();
    assert.equal(insights.incomeRon, 4000);
    assert.equal(insights.spendRon, 375);
    assert.deepEqual(insights.habit, {
      category: "cafea",
      categoryId: "coffee",
      count: 6,
      total: 120,
      avgPrice: 20,
      periodDays: 7,
      suggestedReductionPct: 0.33,
      suggestedCount: 4,
      weeklySaving: 40,
    });

    const generated = await fetch(`${baseUrl}/api/quests/generate`, {
      method: "POST",
      headers: userHeaders,
    });
    const quest = await generated.json();
    assert.equal(generated.status, 201);
    assert.equal(quest.amountToSave, 40);
    assert.equal(quest.analysisMessage, "Am observat 6 cafea în 7 zile (120 RON).");
    assert.equal(quest.virtualReward, "Cafenea");

    const llmInput = JSON.parse(llmRequest.messages[1].content);
    assert.equal(llmInput.habit.weeklySaving, 40);
    assert.equal("transactions" in llmInput, false);
    assert.equal(JSON.stringify(llmInput).includes("Starbucks"), false);
    const stored = await repo.getQuest("demo-ioana", quest.id);
    assert.equal(stored.weeklySavingRon, 40);
    assert.equal(await repo.getQuest("demo-radu", quest.id), null);
    const normalized = await repo.listTransactions("demo-ioana");
    assert.equal(normalized.some((transaction) => "description" in transaction), false);
  });
});

test("statement upload accepts in-memory CSV and rejects non-CSV files", async () => {
  const app = createApp(null, createMemoryRepository());
  await withServer(app, async (baseUrl) => {
    const form = new FormData();
    form.append("file", new Blob(["Data,Descriere,Suma\n27.10.2026,Salariu,1000"]), "statement.csv");
    const response = await fetch(`${baseUrl}/api/statements/import`, {
      method: "POST",
      headers: { "x-demo-user": "demo-radu" },
      body: form,
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).transactionCount, 1);
  });
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
        investedRon: 0,
        streak: 0,
        inventory: [],
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

test("PDF text extraction accepts clear rows and rejects low-confidence text", () => {
  const transactions = parseStatementText([
    "Extras cont",
    "19.10.2026 PLATA POS Starbucks Bucuresti -20,00",
    "20.10.2026 PLATA POS Uber Bucuresti -35,50",
  ].join("\n"));
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].amountRon, -20);
  assert.equal(transactions[0].category, "coffee");
  assert.throws(() => parseStatementText("Text fără tranzacții clare"), /CSV/);
});

test("quest acceptance atomically invests, credits, rewards, and is idempotent", async () => {
  const repo = createMemoryRepository();
  const quest = await repo.createQuest("demo-ioana", {
    weeklySavingRon: 40,
    rewardId: "cafenea",
    habit_json: { category: "cafea" },
    llm_json: { questTitle: "Quest" },
  });
  const app = createApp(null, repo);

  await withServer(app, async (baseUrl) => {
    const accept = () => fetch(`${baseUrl}/api/quests/${quest.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-ioana" },
      body: JSON.stringify({ destinationId: "fidelis" }),
    });
    const first = await accept();
    assert.equal(first.status, 200);
    const accepted = await first.json();
    assert.equal(accepted.balances.RON_SIM, 4960);
    assert.equal(accepted.balances.CREDITS, 45);
    assert.equal(accepted.inventoryItem.itemId, "cafenea");
    assert.equal(accepted.quest.destinationId, "fidelis");
    assert.equal(accepted.quest.streakBonusCredits, 5);

    const retry = await accept();
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).alreadyAccepted, true);
    assert.equal(await repo.getBalance("demo-ioana", "RON_SIM"), 4960);
    assert.equal(await repo.getBalance("demo-ioana", "CREDITS"), 45);
    assert.equal((await repo.listInvestments("demo-ioana")).length, 1);
    assert.equal((await repo.listInventory("demo-ioana")).length, 1);
  });
});

test("quest acceptance rolls back if simulated balance is insufficient", async () => {
  const repo = createMemoryRepository();
  const quest = await repo.createQuest("demo-ioana", { weeklySavingRon: 6000, rewardId: "cafenea" });
  const app = createApp(null, repo);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/quests/${quest.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-ioana" },
      body: JSON.stringify({ destinationId: "fidelis" }),
    });
    assert.equal(response.status, 409);
    assert.equal(await repo.getBalance("demo-ioana", "RON_SIM"), 5000);
    assert.equal(await repo.getBalance("demo-ioana", "CREDITS"), 0);
    assert.equal((await repo.listInvestments("demo-ioana")).length, 0);
    assert.equal((await repo.getQuest("demo-ioana", quest.id)).status, "offered");
  });
});

test("destination projections handle zero rate, taxes, inflation, and the yearly series", () => {
  const zeroRate = projectDestination({
    weeklySaving: 10,
    age: 64,
    destination: { id: "zero", name: "Zero", grossAnnual: 0, taxType: "exempt", taxRate: 0 },
    inflationRate: 0,
  });
  assert.equal(zeroRate.nominalRon, Math.round(10 * 52 / 12 * 12));
  assert.equal(zeroRate.realRon, zeroRate.nominalRon);

  const projections = projectAll({ weeklySaving: 40, age: 24 });
  assert.equal(projections.length, 3);
  assert.ok(projections.every((projection) => projection.realRon < projection.nominalRon));
  assert.equal(projections[0].yearlySeries.length, 41);
  assert.ok(projections.find((projection) => projection.destinationId === "pilon-iii").deductionBenefitRon > 0);
  assert.ok(destinations.every((destination) => destination.verify === true && destination.source && destination.asOf));
});

test("GET /api/projection returns all destinations and filters a selected one", async () => {
  const app = createApp(null, createMemoryRepository());
  await withServer(app, async (baseUrl) => {
    const headers = { "x-demo-user": "demo-ioana" };
    const response = await fetch(`${baseUrl}/api/projection?weeklySaving=40&age=24`, { headers });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.projections.length, 3);
    assert.equal(body.retirementAge, 65);
    assert.match(body.projections[0].estimateDisclaimer, /nu garantată/);

    const selected = await fetch(`${baseUrl}/api/projection?weeklySaving=40&age=24&destinationId=fidelis`, { headers });
    assert.equal((await selected.json()).projections.length, 1);
    assert.equal((await fetch(`${baseUrl}/api/projection?weeklySaving=40&age=24&destinationId=unknown`, { headers })).status, 400);
  });
});

test("shop purchases debit credits idempotently and plots cannot be double occupied", async () => {
  const repo = createMemoryRepository();
  const app = createApp(null, repo);
  await addLedgerEntry(repo, {
    userId: "demo-ioana", currency: "CREDITS", amount: 100,
    kind: "test_credit", refType: "test", refId: "seed", idempotencyKey: "shop-test-credit",
  });

  await withServer(app, async (baseUrl) => {
    const buy = () => fetch(`${baseUrl}/api/shop/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-ioana" },
      body: JSON.stringify({ itemId: "pisica", idempotencyKey: "cat-purchase-1" }),
    });
    const first = await buy();
    assert.equal(first.status, 201);
    assert.equal((await first.json()).creditsBalance, 75);
    assert.equal((await buy()).status, 201);
    assert.equal(await repo.getBalance("demo-ioana", "CREDITS"), 75);
    assert.equal((await repo.listInventory("demo-ioana")).length, 1);

    const cat = (await repo.listInventory("demo-ioana"))[0];
    const place = (itemId) => fetch(`${baseUrl}/api/inventory/place`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-ioana" },
      body: JSON.stringify({ itemId, plotId: "plot-1" }),
    });
    assert.equal((await place(cat.id)).status, 200);
    await addLedgerEntry(repo, {
      userId: "demo-ioana", currency: "CREDITS", amount: 15,
      kind: "test_credit", refType: "test", refId: "seed-2", idempotencyKey: "shop-test-credit-2",
    });
    const palm = await fetch(`${baseUrl}/api/shop/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-ioana" },
      body: JSON.stringify({ itemId: "palmier", idempotencyKey: "palm-purchase-1" }),
    });
    assert.equal(palm.status, 201);
    const palmItem = (await palm.json()).item;
    assert.equal((await place(palmItem.id)).status, 409);
  });
});

test("banana is friends-only, costs 40 credits, and one active challenge blocks repeats", async () => {
  const repo = createMemoryRepository();
  await addLedgerEntry(repo, {
    userId: "demo-ioana", currency: "CREDITS", amount: 120,
    kind: "test_credit", refType: "test", refId: "banana-seed", idempotencyKey: "banana-test-credit",
  });
  const app = createApp(null, repo);

  await withServer(app, async (baseUrl) => {
    const send = (toUserId) => fetch(`${baseUrl}/api/friends/banana`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-ioana" },
      body: JSON.stringify({ toUserId }),
    });
    assert.equal((await send("demo-ioana")).status, 400);
    const sent = await send("demo-radu");
    assert.equal(sent.status, 201);
    const challenge = (await sent.json()).challenge;
    assert.equal(challenge.blockedPlot, "plot-1");
    assert.equal(await repo.getBalance("demo-ioana", "CREDITS"), 80);
    assert.equal((await send("demo-radu")).status, 409);

    const inbox = await fetch(`${baseUrl}/api/inbox`, { headers: { "x-demo-user": "demo-radu" } });
    assert.equal((await inbox.json()).length, 1);
    const tooSmall = await fetch(`${baseUrl}/api/challenges/${challenge.id}/clean`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-radu" },
      body: JSON.stringify({ destinationId: "fidelis", amountRon: 19 }),
    });
    assert.equal(tooSmall.status, 400);
    const cleaned = await fetch(`${baseUrl}/api/challenges/${challenge.id}/clean`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-radu" },
      body: JSON.stringify({ destinationId: "fidelis", amountRon: 20 }),
    });
    assert.equal(cleaned.status, 200);
    assert.equal(await repo.getBalance("demo-radu", "RON_SIM"), 4980);
    assert.equal(await repo.getBalance("demo-radu", "CREDITS"), 10);
    assert.equal(await repo.getBalance("demo-ioana", "CREDITS"), 90);
    assert.equal((await repo.listInvestments("demo-radu")).length, 1);
    const retry = await fetch(`${baseUrl}/api/challenges/${challenge.id}/clean`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-radu" },
      body: JSON.stringify({ destinationId: "fidelis", amountRon: 20 }),
    });
    assert.equal((await retry.json()).alreadyCleaned, true);
    assert.equal(await repo.getBalance("demo-radu", "CREDITS"), 10);
  });
});

test("banana mute, daily limit, and expiration are enforced", async () => {
  const mutedRepo = createMemoryRepository();
  await addLedgerEntry(mutedRepo, {
    userId: "demo-ioana", currency: "CREDITS", amount: 40,
    kind: "test_credit", refType: "test", refId: "mute-seed", idempotencyKey: "mute-credit",
  });
  await mutedRepo.setMute("demo-radu", "demo-ioana", true);
  const mutedApp = createApp(null, mutedRepo);
  await withServer(mutedApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/friends/banana`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-ioana" },
      body: JSON.stringify({ toUserId: "demo-radu" }),
    });
    assert.equal(response.status, 403);
    assert.equal(await mutedRepo.getBalance("demo-ioana", "CREDITS"), 40);
  });

  const limitedRepo = createMemoryRepository();
  await addLedgerEntry(limitedRepo, {
    userId: "demo-ioana", currency: "CREDITS", amount: 200,
    kind: "test_credit", refType: "test", refId: "limit-seed", idempotencyKey: "limit-credit",
  });
  for (let index = 0; index < 3; index += 1) {
    await limitedRepo.createChallenge({
      fromUser: "demo-ioana", toUser: "demo-radu", kind: "banana", blockedPlot: `old-${index}`,
      minInvestRon: 20, expiresAt: new Date(Date.now() - 1000).toISOString(), status: "expired",
    });
  }
  const limitedApp = createApp(null, limitedRepo);
  await withServer(limitedApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/friends/banana`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-ioana" },
      body: JSON.stringify({ toUserId: "demo-radu" }),
    });
    assert.equal(response.status, 429);
    assert.equal(await limitedRepo.getBalance("demo-ioana", "CREDITS"), 200);
    const expired = await limitedRepo.createChallenge({
      fromUser: "demo-ioana", toUser: "demo-radu", kind: "banana", blockedPlot: "plot-1",
      minInvestRon: 20, expiresAt: new Date(Date.now() - 1000).toISOString(), status: "pending",
    });
    const inbox = await fetch(`${baseUrl}/api/inbox`, { headers: { "x-demo-user": "demo-radu" } });
    assert.equal((await inbox.json()).length, 0);
    assert.equal((await limitedRepo.listChallenges("demo-radu", { direction: "incoming" })).find((item) => item.id === expired.id).status, "expired");
  });
});

test("friends endpoints resolve invite codes and allow receiver-controlled mute", async () => {
  const repo = createMemoryRepository();
  const app = createApp(null, repo);

  await withServer(app, async (baseUrl) => {
    const friendsResponse = await fetch(`${baseUrl}/api/friends`, {
      headers: { "x-demo-user": "demo-ioana" },
    });
    assert.equal((await friendsResponse.json())[0].id, "demo-radu");

    const added = await fetch(`${baseUrl}/api/friends/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-ioana" },
      body: JSON.stringify({ inviteCode: "RADU24" }),
    });
    assert.equal(added.status, 201);
    assert.equal((await added.json()).handle, "radu");

    const muted = await fetch(`${baseUrl}/api/friends/demo-ioana/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-radu" },
      body: JSON.stringify({ muted: true }),
    });
    assert.equal(muted.status, 200);
    assert.equal((await muted.json()).muted, true);
  });
});

test("Stripe demo top-up is idempotent and only changes simulated RON", async () => {
  const repo = createMemoryRepository();
  const app = createApp(null, repo);

  await withServer(app, async (baseUrl) => {
    const configResponse = await fetch(`${baseUrl}/api/stripe/config`);
    assert.deepEqual(await configResponse.json(), { stripeEnabled: false, mockEnabled: true });

    const topup = () => fetch(`${baseUrl}/api/stripe/mock-topup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-ioana" },
      body: JSON.stringify({ amountRon: 100, idempotencyKey: "checkout-demo-1" }),
    });
    const first = await topup();
    assert.equal(first.status, 200);
    assert.deepEqual((await first.json()).balances, { RON_SIM: 5100, CREDITS: 0 });
    assert.equal((await topup()).status, 200);
    assert.equal(await repo.getBalance("demo-ioana", "RON_SIM"), 5100);
    assert.equal(await repo.getBalance("demo-ioana", "CREDITS"), 0);

    const invalid = await fetch(`${baseUrl}/api/stripe/mock-topup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-ioana" },
      body: JSON.stringify({ amountRon: 55, idempotencyKey: "invalid-amount" }),
    });
    assert.equal(invalid.status, 400);
  });
});

test("Stripe test checkout confirms server-side and credits only RON_SIM once", async () => {
  const repo = createMemoryRepository();
  let createdSession;
  let checkoutRequest;
  const stripe = {
    checkout: {
      sessions: {
        create: async (request) => {
          checkoutRequest = request;
          createdSession = {
            id: "cs_test_oasis_1",
            url: "https://checkout.stripe.test/session",
            payment_status: "paid",
            metadata: request.metadata,
          };
          return createdSession;
        },
        retrieve: async (id) => id === createdSession.id ? createdSession : null,
      },
    },
  };
  const app = createApp(null, repo, stripe);

  await withServer(app, async (baseUrl) => {
    const checkout = await fetch(`${baseUrl}/api/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-user": "demo-radu" },
      body: JSON.stringify({ amountRon: 100 }),
    });
    assert.equal(checkout.status, 200);
    assert.equal((await checkout.json()).url, "https://checkout.stripe.test/session");
    assert.equal(checkoutRequest.line_items[0].price_data.currency, "ron");
    assert.equal(checkoutRequest.line_items[0].price_data.unit_amount, 10000);
    assert.equal(checkoutRequest.metadata.currency, "RON_SIM");

    const confirmUrl = `${baseUrl}/api/stripe/confirm?session_id=cs_test_oasis_1`;
    const headers = { "x-demo-user": "demo-radu" };
    assert.equal((await fetch(confirmUrl, { headers })).status, 200);
    assert.equal((await fetch(confirmUrl, { headers })).status, 200);
    assert.equal(await repo.getBalance("demo-radu", "RON_SIM"), 5100);
    assert.equal(await repo.getBalance("demo-radu", "CREDITS"), 0);
  });
});