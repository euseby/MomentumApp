const express = require("express");
const multer = require("multer");
const fs = require("node:fs");
const path = require("node:path");
const { getCurrentUser } = require("../services/current-user");
const { parseStatementCsv, parseStatementPdf } = require("../services/statements");
const { buildInsights } = require("../services/insights");

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const samplePath = path.join(__dirname, "../../samples/extras-demo.csv");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const validCsv = extension === ".csv" && ["text/csv", "application/vnd.ms-excel", "application/octet-stream", "text/plain"].includes(file.mimetype);
    const validPdf = extension === ".pdf" && file.mimetype === "application/pdf";
    if (!validCsv && !validPdf) {
      return callback(new Error("Încarcă un fișier CSV sau PDF."));
    }
    return callback(null, true);
  },
});

async function persistStatement(repository, userId, buffer, source) {
  const transactions = source === "pdf" ? await parseStatementPdf(buffer) : parseStatementCsv(buffer);
  const statement = await repository.saveStatement(userId, { source, txCount: transactions.length });
  const saved = await repository.saveTransactions(userId, statement.id, transactions);
  return { statementId: statement.id, transactionCount: saved.length };
}

function createStatementsRouter(repository) {
  const router = express.Router();

  router.post("/api/statements/import", (req, res, next) => {
    upload.single("file")(req, res, async (uploadError) => {
      if (uploadError) {
        const status = uploadError.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ error: uploadError.message || "Nu am putut primi fișierul." });
      }
      if (!req.file) return res.status(400).json({ error: "Alege un fișier CSV pentru import." });
      try {
        const user = await getCurrentUser(req, repository);
        const source = path.extname(req.file.originalname).toLowerCase() === ".pdf" ? "pdf" : "csv";
        const result = await persistStatement(repository, user.id, req.file.buffer, source);
        return res.status(201).json(result);
      } catch (error) {
        return res.status(400).json({ error: error.message || "Nu am putut importa extrasul." });
      }
    });
  });

  router.post("/api/statements/demo", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      const result = await persistStatement(repository, user.id, fs.readFileSync(samplePath), "demo");
      return res.status(201).json(result);
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || "Nu am putut încărca extrasul demo." });
    }
  });

  router.get("/api/insights", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      const since = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
      const transactions = await repository.listTransactions(user.id, { since });
      return res.json(buildInsights(transactions));
    } catch (error) {
      return res.status(error.status || 500).json({ error: "Nu am putut calcula sumarul cheltuielilor." });
    }
  });

  router.delete("/api/me/data", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      await repository.deleteAllUserData(user.id);
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(error.status || 500).json({ error: "Nu am putut șterge datele utilizatorului." });
    }
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(error.status || 400).json({ error: "Nu am putut procesa extrasul." });
  });

  return router;
}

module.exports = { createStatementsRouter, persistStatement, MAX_FILE_BYTES };