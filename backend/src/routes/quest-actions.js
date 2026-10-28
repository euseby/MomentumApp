const express = require("express");
const { getCurrentUser } = require("../services/current-user");
const { acceptQuest } = require("../services/quest-acceptance");

function createQuestActionsRouter(repository) {
  const router = express.Router();
  router.post("/api/quests/:id/accept", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      const destinationId = req.body?.destinationId;
      if (typeof destinationId !== "string") {
        return res.status(400).json({ error: "destinationId este obligatoriu." });
      }
      const result = await acceptQuest(repository, user.id, req.params.id, destinationId);
      return res.json(result);
    } catch (error) {
      const status = error.status || (error.code === "INSUFFICIENT_FUNDS" ? 409 : 500);
      const message = error.code === "INSUFFICIENT_FUNDS"
        ? "Sold simulat insuficient pentru această investiție."
        : error.status
          ? error.message
          : "Nu am putut accepta quest-ul.";
      return res.status(status).json({ error: message });
    }
  });
  return router;
}

module.exports = { createQuestActionsRouter };