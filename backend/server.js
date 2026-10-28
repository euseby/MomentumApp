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

const OASIS_BANK_TRANSACTIONS = [
  { date: "2026-10-19", merchant: "5 to go", amount: 20, category: "cafea" },
  { date: "2026-10-20", merchant: "Starbucks", amount: 20, category: "cafea" },
  { date: "2026-10-21", merchant: "5 to go", amount: 20, category: "cafea" },
  { date: "2026-10-22", merchant: "Starbucks", amount: 20, category: "cafea" },
  { date: "2026-10-23", merchant: "5 to go", amount: 20, category: "cafea" },
  { date: "2026-10-24", merchant: "Starbucks", amount: 20, category: "cafea" },
  { date: "2026-10-25", merchant: "Uber", amount: 38, category: "transport" },
  { date: "2026-10-26", merchant: "Uber", amount: 32, category: "transport" },
  { date: "2026-10-27", merchant: "Salariu", amount: 4000, category: "venit" },
  { date: "2026-10-27", merchant: "Kaufland", amount: 185, category: "alimente" },
];

const OASIS_SYSTEM_PROMPT = `Ești un Game Master financiar. Analizează tranzacțiile primite. Găsește un obicei repetitiv și propune reducerea lui, nu eliminarea, iar suma economisită o transformă într-un upgrade pentru orașul virtual. Folosește doar informațiile din tranzacții și calculează corect sumele.

Returnează OBLIGATORIU un singur obiect JSON valid, fără markdown și text suplimentar, cu exact aceste chei: questTitle (string, titlu jucăuș), analysisMessage (string, descrie cheltuielile observate și totalul), proposalMessage (string, propune reducerea obiceiului și recompensa), amountToSave (number în RON), virtualReward (string), rewardType (string, de exemplu building, decoration sau character).`;

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

function normalizeOasisAnalysis(parsed) {
  for (const key of ["questTitle", "analysisMessage", "proposalMessage", "virtualReward", "rewardType"]) {
    if (typeof parsed[key] !== "string" || !parsed[key].trim()) {
      throw new Error(`Câmp invalid în răspunsul Oasis: ${key}.`);
    }
  }
  if (typeof parsed.amountToSave !== "number" || !Number.isFinite(parsed.amountToSave) || parsed.amountToSave < 0) {
    throw new Error("Câmp numeric invalid în răspunsul Oasis: amountToSave.");
  }

  return {
    questTitle: parsed.questTitle.trim(),
    analysisMessage: parsed.analysisMessage.trim(),
    proposalMessage: parsed.proposalMessage.trim(),
    amountToSave: parsed.amountToSave,
    virtualReward: parsed.virtualReward.trim(),
    rewardType: parsed.rewardType.trim(),
  };
}

// ─── POST /api/momentum ─────────────────────────────────────
function createApp(llmClient = openai) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/api/oasis", async (req, res) => {
    if (!llmClient) {
      return res.status(503).json({
        error: "LLM-ul nu este configurat. Verifică API_KEY în backend/.env.",
      });
    }

    const userMessage = `Tranzacțiile fictive ale utilizatorului (sume în RON):\n${JSON.stringify(OASIS_BANK_TRANSACTIONS, null, 2)}\n\nAnalizează tranzacțiile și generează misiunea folosind contractul JSON cerut.`;

    try {
      const completion = await llmClient.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: OASIS_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 700,
        extra_body: { chat_template_kwargs: { enable_thinking: false } },
      });
      const rawResponse = completion.choices[0]?.message?.content;
      if (typeof rawResponse !== "string" || !rawResponse.trim()) {
        throw new Error("Modelul a returnat un răspuns gol.");
      }

      return res.json(normalizeOasisAnalysis(extractJsonObject(rawResponse)));
    } catch (error) {
      console.error("Eroare la generarea questului Oasis:", error.message || error);
      return res.status(502).json({
        error: "Nu am putut genera misiunea Oasis cu modelul AI. Încearcă din nou.",
      });
    }
  });

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
  normalizeOasisAnalysis,
  normalizeQuestResponse,
  OASIS_BANK_TRANSACTIONS,
  SYSTEM_PROMPT,
  OASIS_SYSTEM_PROMPT,
};
