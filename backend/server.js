require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const Stripe = require("stripe");
const { repository } = require("./src/repo");
const { createCoreRouter } = require("./src/routes/core");
const { createQuestsRouter } = require("./src/routes/quests");
const { createStatementsRouter } = require("./src/routes/statements");
const { createQuestActionsRouter } = require("./src/routes/quest-actions");
const { createProjectionRouter } = require("./src/routes/projection");
const { createSocialRouter } = require("./src/routes/social");
const { createStripeRouter } = require("./src/routes/stripe");
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
const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

function createApp(llmClient = openai, activeRepository = repository, stripeClientOverride = stripeClient) {
  const app = express();
  app.use(cors({
    origin(origin, callback) {
      const localDevelopmentOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
      callback(null, !origin || CORS_ORIGINS.includes(origin) || localDevelopmentOrigin);
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
  app.use(createStatementsRouter(activeRepository));
  app.use(createQuestsRouter(llmClient, activeRepository));
  app.use(createQuestActionsRouter(activeRepository));
  app.use(createProjectionRouter(activeRepository));
  app.use(createSocialRouter(activeRepository));
  app.use(createStripeRouter(activeRepository, stripeClientOverride));
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
  ...llm,
};
