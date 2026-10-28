const express = require("express");
const { getCurrentUser } = require("../services/current-user");
const { getWalletBalances } = require("../services/ledger");

function createCoreRouter(repository, modelName, llmConfigured) {
  const router = express.Router();

  router.get("/api/health", (req, res) => {
    res.json({ status: "ok", model: modelName, llmConfigured });
  });

  router.get("/api/me", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      return res.json({ id: user.id, displayName: user.displayName, handle: user.handle, inviteCode: user.inviteCode });
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.status ? "Utilizator demo necunoscut." : "Nu am putut încărca utilizatorul." });
    }
  });

  router.get("/api/wallet", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      const balances = await getWalletBalances(repository, user.id);
      const [investments, streak, inventory] = await Promise.all([
        repository.listInvestments(user.id),
        repository.countAcceptedQuests(user.id),
        repository.listInventory(user.id),
      ]);
      const investedRon = investments.reduce((sum, entry) => sum + entry.amountRon, 0);
      return res.json({ userId: user.id, balances, investedRon, streak, inventory });
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.status ? "Utilizator demo necunoscut." : "Nu am putut încărca soldul." });
    }
  });

  return router;
}

module.exports = { createCoreRouter };