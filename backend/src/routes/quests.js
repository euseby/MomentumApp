const express = require("express");
const assumptions = require("../rules/assumptions.json");
const shop = require("../rules/shop.json");
const {
  OASIS_SYSTEM_PROMPT,
  MOMENTUM_SYSTEM_PROMPT,
  requestQuestCopy,
} = require("../services/llm");
const { getCurrentUser } = require("../services/current-user");
const { buildInsights } = require("../services/insights");

function createQuestsRouter(llmClient, repository) {
  const router = express.Router();

  router.post("/api/oasis", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      if (!llmClient) {
        return res.status(503).json({ error: "LLM-ul nu este configurat. Verifică API_KEY în backend/.env." });
      }
      const since = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
      const transactions = await repository.listTransactions(user.id, { since });
      const habit = buildInsights(transactions).habit;
      if (!habit) return res.status(422).json({ error: "Importă tranzacții și detectează un obicei înainte de a cere un quest." });
      const allowedRewards = shop.filter((item) => item.type !== "action").map(({ id, name, type }) => ({ id, name, type }));
      const copy = await requestQuestCopy(llmClient, {
        messages: [
          { role: "system", content: OASIS_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ habit, rewards: allowedRewards }) },
        ],
      });
      await repository.createQuest(user.id, {
        habit_json: habit,
        llm_json: { questTitle: copy.questTitle, rewardId: copy.reward.id },
        weeklySavingRon: habit.weeklySaving,
        rewardId: copy.reward.id,
      });
      return res.json({
        questTitle: copy.questTitle,
        analysisMessage: `Am observat ${habit.count} ${habit.category} în ${habit.periodDays} zile (${habit.total} RON).`,
        proposalMessage: `Ce-ar fi să reduci la ${habit.suggestedCount} apariții? Ai economisi ${habit.weeklySaving} RON pe săptămână și ai debloca ${copy.reward.name}.`,
        amountToSave: habit.weeklySaving,
        virtualReward: copy.reward.name,
        rewardType: copy.reward.type,
      });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: "Utilizator demo necunoscut." });
      console.error("Eroare la generarea questului Oasis:", error.message || error);
      return res.status(502).json({ error: "Nu am putut genera misiunea Oasis cu modelul AI. Încearcă din nou." });
    }
  });

  router.post("/api/quests/generate", async (req, res) => {
    let user;
    try {
      user = await getCurrentUser(req, repository);
      if (!llmClient) {
        return res.status(503).json({ error: "LLM-ul nu este configurat. Verifică API_KEY în backend/.env." });
      }
      const since = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
      const transactions = await repository.listTransactions(user.id, { since });
      const habit = buildInsights(transactions).habit;
      if (!habit) {
        return res.status(422).json({ error: "Nu am găsit încă un obicei repetitiv. Importă mai multe tranzacții și încearcă din nou." });
      }

      const allowedRewards = shop
        .filter((item) => item.type !== "action")
        .map(({ id, name, type }) => ({ id, name, type }));
      const copy = await requestQuestCopy(llmClient, {
        requireStory: true,
        messages: [
          { role: "system", content: MOMENTUM_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ habit, rewards: allowedRewards }) },
        ],
      });
      const analysisMessage = `Am observat ${habit.count} ${habit.category} în ${habit.periodDays} zile (${habit.total} RON).`;
      const proposalMessage = `Ce-ar fi să reduci la ${habit.suggestedCount} apariții? Ai economisi aproximativ ${habit.weeklySaving} RON pe săptămână și ai debloca ${copy.reward.name}.`;
      const stored = await repository.createQuest(user.id, {
        habit_json: habit,
        llm_json: { questTitle: copy.questTitle, questStory: copy.questStory, rewardId: copy.reward.id },
        weeklySavingRon: habit.weeklySaving,
        rewardId: copy.reward.id,
      });

      return res.status(201).json({
        id: stored.id,
        questTitle: copy.questTitle,
        questStory: copy.questStory,
        analysisMessage,
        proposalMessage,
        amountToSave: habit.weeklySaving,
        virtualReward: copy.reward.name,
        rewardType: copy.reward.type,
        habit,
      });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: "Utilizator demo necunoscut." });
      console.error("Eroare la generarea questului din insight:", error.message || error);
      return res.status(502).json({ error: "Nu am putut genera questul. Încearcă din nou." });
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
    const suggestedCount = Math.max(0, Math.round(30 * (1 - assumptions.suggestedReductionPct)));
    const habit = {
      category: "obicei recurent",
      count: 30,
      total: monthlyGuiltyPleasureSpend,
      avgPrice: Math.round((monthlyGuiltyPleasureSpend / 30) * 100) / 100,
      periodDays: 30,
      suggestedReductionPct: assumptions.suggestedReductionPct,
      suggestedCount,
      weeklySaving: Math.round((monthlySaving * 7 / 30) * 100) / 100,
    };
    const allowedRewards = shop.filter((item) => item.type !== "action").map(({ id, name, type }) => ({ id, name, type }));
    try {
      const copy = await requestQuestCopy(llmClient, {
        requireStory: true,
        messages: [
          { role: "system", content: MOMENTUM_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ habit, rewards: allowedRewards }) },
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

module.exports = { createQuestsRouter };