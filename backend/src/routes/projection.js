const express = require("express");
const { getCurrentUser } = require("../services/current-user");
const { projectAll, destinations } = require("../services/projection");

function createProjectionRouter(repository) {
  const router = express.Router();
  router.get("/api/projection", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      const latestQuest = await repository.latestQuest(user.id);
      const weeklySaving = req.query.weeklySaving === undefined
        ? latestQuest?.weeklySavingRon
        : Number(req.query.weeklySaving);
      const age = req.query.age === undefined ? 24 : Number(req.query.age);
      if (weeklySaving === undefined) {
        return res.status(422).json({ error: "Generează un quest sau trimite weeklySaving pentru proiecție." });
      }
      const projections = projectAll({ weeklySaving, age });
      const destinationId = req.query.destinationId;
      if (destinationId && !destinations.some((destination) => destination.id === destinationId)) {
        return res.status(400).json({ error: "Instrument de simulare necunoscut." });
      }
      return res.json({
        retirementAge: 65,
        age,
        weeklySaving,
        inflationRate: 0.046,
        projections: destinationId ? projections.filter((entry) => entry.destinationId === destinationId) : projections,
      });
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.status ? "Utilizator demo necunoscut." : "Date invalide pentru proiecție." });
    }
  });
  return router;
}

module.exports = { createProjectionRouter };