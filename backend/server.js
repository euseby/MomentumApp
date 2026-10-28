require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { repository } = require("./src/repo");
const { createCoreRouter } = require("./src/routes/core");
const { createQuestsRouter, OASIS_BANK_TRANSACTIONS, analyzeDemoHabit } = require("./src/routes/quests");
const llm = require("./src/services/llm");
const { getCurrentUser } = require("./src/services/current-user");
const { addLedgerEntry, getWalletBalances } = require("./src/services/ledger");

const PORT = process.env.PORT || 8000;
const BASE_URL = process.env.BASE_URL || "https://api.featherless.ai/v1";
const MODEL_NAME = process.env.MODEL_NAME || "meta-llama/Meta-Llama-3.1-8B-Instruct";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:8080,http://127.0.0.1:8080,http://localhost:8081,http://127.0.0.1:8081")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const openai = process.env.API_KEY
  ? new OpenAI({ apiKey: process.env.API_KEY, baseURL: BASE_URL })
  : null;

function createApp(llmClient = openai, activeRepository = repository) {
  const app = express();
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || CORS_ORIGINS.includes(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "X-Demo-User"],
  }));
  app.use(express.json());
  app.get("/", (req, res) => {
    res.json({ status: "ok", service: "Momentum API", model: MODEL_NAME, timestamp: new Date().toISOString() });
  });
  app.use(createCoreRouter(activeRepository, MODEL_NAME, Boolean(llmClient)));
  app.use(createQuestsRouter(llmClient));
  return app;
}

const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Momentum API running at http://localhost:${PORT}`);
    console.log(`Model: ${MODEL_NAME}`);
    console.log(`LLM configured: ${Boolean(openai)}`);
  });
}

module.exports = {
  app,
  createApp,
  getCurrentUser,
  addLedgerEntry,
  getWalletBalances,
  OASIS_BANK_TRANSACTIONS,
  analyzeDemoHabit,
  ...llm,
};
