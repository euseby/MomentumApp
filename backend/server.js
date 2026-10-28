// ──────────────────────────────────────────────────────────────
//  Momentum Backend — Featherless AI (OpenAI‑compatible)
//  Stack: Node.js + Express
//  Endpoint: POST /api/momentum
// ──────────────────────────────────────────────────────────────

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

// ─── Config ──────────────────────────────────────────────────
const PORT = process.env.PORT || 8000;
const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.BASE_URL || "https://api.featherless.ai/v1";
const MODEL_NAME =
  process.env.MODEL_NAME || "meta-llama/Meta-Llama-3.1-8B-Instruct";

// ─── OpenAI client pointed at Featherless ────────────────────
const openai = API_KEY
  ? new OpenAI({
      apiKey: API_KEY,
      baseURL: BASE_URL,
    })
  : null;

// ─── System Prompt (conform implementationplan.md) ───────────
const SYSTEM_PROMPT = `Ești Oasis, un Game Master pentru un joc de simulare financiară în care utilizatorul construiește o insulă virtuală. Creează o Misiune Zilnică prietenoasă, legată de obiceiul și cheltuiala utilizatorului. Propune o economie realistă pentru azi și o recompensă virtuală tangibilă pe insulă. Estimează valoarea nominală la vârsta de 65 de ani presupunând că suma propusă este economisită zilnic și investită cu un randament orientativ de 6% pe an în titluri de stat. Menționează că proiecția este orientativă și nu garantată. Nu inventa date despre utilizator.

Returnează un singur obiect JSON valid, fără markdown și fără text suplimentar, cu exact aceste chei și tipuri: questTitle (string), questStory (string), amountToSave (number în RON, pentru o zi), virtualReward (string), futureRealValue (number în RON, la 65 de ani), streakBonus (boolean, întotdeauna true). Răspunde DOAR cu JSON-ul.
/no_think`;

function extractJsonObject(text) {
  const content = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  for (let start = 0; start < content.length; start += 1) {
    if (content[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < content.length; index += 1) {
      const character = content[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}" && --depth === 0) {
        try {
          const value = JSON.parse(content.slice(start, index + 1));
          if (value && typeof value === "object" && !Array.isArray(value)) return value;
        } catch {
          break;
        }
      }
    }
  }

  throw new Error("Modelul nu a returnat un obiect JSON valid.");
}

function normalizeQuestResponse(parsed) {
  for (const key of ["questTitle", "questStory", "virtualReward"]) {
    if (typeof parsed[key] !== "string" || !parsed[key].trim()) {
      throw new Error(`Câmp invalid în răspunsul modelului: ${key}.`);
    }
  }
  for (const key of ["amountToSave", "futureRealValue"]) {
    if (typeof parsed[key] !== "number" || !Number.isFinite(parsed[key]) || parsed[key] < 0) {
      throw new Error(`Câmp numeric invalid în răspunsul modelului: ${key}.`);
    }
  }
  return {
    questTitle: parsed.questTitle.trim(),
    questStory: parsed.questStory.trim(),
    amountToSave: parsed.amountToSave,
    virtualReward: parsed.virtualReward.trim(),
    futureRealValue: parsed.futureRealValue,
    streakBonus: true,
  };
}

// ─── POST /api/momentum ─────────────────────────────────────
function createApp(llmClient = openai) {
  const app = express();
  app.use(cors());
  app.use(express.json());

app.post("/api/momentum", async (req, res) => {
  try {
    // 1. Validare minimală
    const { age, monthlyIncome, guiltyPleasure, monthlyGuiltyPleasureSpend } =
      req.body;

    if (
      !Number.isInteger(age) ||
      age < 1 ||
      age > 120 ||
      typeof monthlyIncome !== "number" ||
      !Number.isFinite(monthlyIncome) ||
      monthlyIncome < 0 ||
      typeof guiltyPleasure !== "string" ||
      !guiltyPleasure.trim() ||
      typeof monthlyGuiltyPleasureSpend !== "number" ||
      !Number.isFinite(monthlyGuiltyPleasureSpend) ||
      monthlyGuiltyPleasureSpend < 0
    ) {
      return res.status(400).json({
        error:
          "Toate câmpurile sunt obligatorii: age, monthlyIncome, guiltyPleasure, monthlyGuiltyPleasureSpend",
      });
    }

    if (!llmClient) {
      return res.status(503).json({
        error: "LLM-ul nu este configurat. Verifică API_KEY în backend/.env.",
      });
    }

    // 2. Construim mesajul utilizatorului pentru LLM
    const userMessage = `Datele utilizatorului:
  - Vârstă: ${age} ani
  - Venit lunar: ${monthlyIncome} RON
  - Obicei: ${guiltyPleasure}
  - Cheltuială lunară pentru acest obicei: ${monthlyGuiltyPleasureSpend} RON

  Generează misiunea Oasis în formatul JSON cerut.`;

    console.log(`\n📥  Cerere primită:`, { age, monthlyIncome, guiltyPleasure, monthlyGuiltyPleasureSpend });

    // 3. Apel către Featherless AI (OpenAI-compatible)
    const completion = await llmClient.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
      extra_body: {
        chat_template_kwargs: { enable_thinking: false },
      },
    });

    const rawResponse = completion.choices[0]?.message?.content;
    console.log(`🤖  Răspuns brut LLM:\n`, rawResponse);

    if (!rawResponse) {
      throw new Error("LLM-ul a returnat un răspuns gol.");
    }

    return res.json(normalizeQuestResponse(extractJsonObject(rawResponse)));
  } catch (err) {
    console.error(`\n❌  Eroare:`, err.message || err);
    return res.status(502).json({
      error: "Nu am putut genera misiunea cu modelul AI. Verifică backendul și configurația Featherless, apoi încearcă din nou.",
    });
  }
});

  app.get("/", (req, res) => {
    res.json({
      status: "ok",
      service: "Momentum API",
      model: MODEL_NAME,
      timestamp: new Date().toISOString(),
    });
  });

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", model: MODEL_NAME });
});

// ─── Start Server ────────────────────────────────────────────
  return app;
}

const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Momentum API rulează pe http://localhost:${PORT}`);
    console.log(`Model: ${MODEL_NAME}`);
    console.log(`LLM configurat: ${Boolean(openai)}`);
  });
}

module.exports = {
  app,
  createApp,
  extractJsonObject,
  normalizeQuestResponse,
  SYSTEM_PROMPT,
};
