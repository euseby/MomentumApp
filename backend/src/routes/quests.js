const express = require("express");
const assumptions = require("../rules/assumptions.json");
const shop = require("../rules/shop.json");
const {
  OASIS_SYSTEM_PROMPT,
  MOMENTUM_SYSTEM_PROMPT,
  requestQuestCopy,
} = require("../services/llm");

const OASIS_BANK_TRANSACTIONS = [
  { date: "2026-10-19", merchant: "5 to go", amount: 20, category: "coffee" },
  { date: "2026-10-20", merchant: "Starbucks", amount: 20, category: "coffee" },
  { date: "2026-10-21", merchant: "5 to go", amount: 20, category: "coffee" },
  { date: "2026-10-22", merchant: "Starbucks", amount: 20, category: "coffee" },
  { date: "2026-10-23", merchant: "5 to go", amount: 20, category: "coffee" },
  { date: "2026-10-24", merchant: "Starbucks", amount: 20, category: "coffee" },
  { date: "2026-10-25", merchant: "Uber", amount: 38, category: "ride_hailing" },
  { date: "2026-10-26", merchant: "Uber", amount: 32, category: "ride_hailing" },
  { date: "2026-10-27", merchant: "Salariu", amount: 4000, category: "income" },
  { date: "2026-10-27", merchant: "Kaufland", amount: 185, category: "groceries" },
];

function analyzeDemoHabit(transactions = OASIS_BANK_TRANSACTIONS) {
  const coffee = transactions.filter((entry) => entry.category === "coffee" && entry.amount > 0);
  const count = coffee.length;
  const total = coffee.reduce((sum, entry) => sum + entry.amount, 0);
  const suggestedCount = Math.max(1, Math.round(count * (1 - assumptions.suggestedReductionPct)));
  const averagePrice = count ? total / count : 0;
  return {
    category: "cafea",
    count,
    total,
    avgPrice: averagePrice,
    periodDays: 7,
    suggestedReductionPct: assumptions.suggestedReductionPct,
    suggestedCount,
    weeklySaving: Math.round((total - suggestedCount * averagePrice) * 100) / 100,
  };
}

function createQuestsRouter(llmClient) {
  const router = express.Router();

  router.post("/api/oasis", async (req, res) => {
    if (!llmClient) {
      return res.status(503).json({ error: "LLM-ul nu este configurat. Verifică API_KEY în backend/.env." });
    }
    const habit = analyzeDemoHabit();
    const allowedRewards = shop.filter((item) => item.type !== "action").map(({ id, name, type }) => ({ id, name, type }));
    try {
      const copy = await requestQuestCopy(llmClient, {
        messages: [
          { role: "system", content: OASIS_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ habit, rewards: allowedRewards }) },
        ],
      });
      return res.json({
        questTitle: copy.questTitle,
        analysisMessage: `Am observat ${habit.count} cafele săptămâna trecută (${habit.total} RON).`,
        proposalMessage: `Ce-ar fi să cumperi doar ${habit.suggestedCount} săptămâna asta? Cei ${habit.weeklySaving} RON economisiți se transformă într-un ${copy.reward.name} pentru insula ta.`,
        amountToSave: habit.weeklySaving,
        virtualReward: copy.reward.name,
        rewardType: copy.reward.type,
      });
    } catch (error) {
      console.error("Eroare la generarea questului Oasis:", error.message || error);
      return res.status(502).json({ error: "Nu am putut genera misiunea Oasis cu modelul AI. Încearcă din nou." });
    }
  });

  router.post("/api/momentum", async (req, res) => {
    const body = req.body || {};
    const { age, monthlyIncome, guiltyPleasure, monthlyGuiltyPleasureSpend } = body;
    if (!Number.isInteger(age) || age < 1 || age > 120 || typeof monthlyIncome !== "number" || !Number.isFinite(monthlyIncome) || monthlyIncome < 0 || typeof guiltyPleasure !== "string" || !guiltyPleasure.trim() || typeof monthlyGuiltyPleasureSpend !== "number" || !Number.isFinite(monthlyGuiltyPleasureSpend) || monthlyGuiltyPleasureSpend < 0) {
      return res.status(400).json({ error: "Toate câmpurile sunt obligatorii și trebuie să aibă valori valide." });
    }
    if (!llmClient) return res.status(503).json({ error: "LLM-ul nu este configurat. Verifică API_KEY în backend/.env." });

    const monthlySaving = Math.round(monthlyGuiltyPleasureSpend * assumptions.suggestedReductionPct * 100) / 100;
    const amountToSave = Math.round((monthlySaving / 30) * 100) / 100;
    const months = Math.max(0, (assumptions.retirementAge - age) * 12);
    const monthlyRate = Math.pow(1.06, 1 / 12) - 1;
    const futureRealValue = Math.round(monthlySaving * (monthlyRate ? (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate : months));
    const allowedRewards = shop.filter((item) => item.type !== "action").map(({ id, name, type }) => ({ id, name, type }));
    try {
      const copy = await requestQuestCopy(llmClient, {
        requireStory: true,
        messages: [
          { role: "system", content: MOMENTUM_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ age, monthlyIncome, guiltyPleasure, rewards: allowedRewards }) },
        ],
      });
      return res.json({
        questTitle: copy.questTitle,
        questStory: copy.questStory,
        amountToSave,
        virtualReward: copy.reward.name,
        futureRealValue,
        streakBonus: true,
      });
    } catch (error) {
      console.error("Eroare la generarea misiunii Momentum:", error.message || error);
      return res.status(502).json({ error: "Nu am putut genera misiunea cu modelul AI. Încearcă din nou." });
    }
  });

  return router;
}

module.exports = { createQuestsRouter, analyzeDemoHabit, OASIS_BANK_TRANSACTIONS };