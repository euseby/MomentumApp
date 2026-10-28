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

// ─── Express App ─────────────────────────────────────────────
const app = express();

app.use(cors()); // permite cereri din orice origine (frontend pe alt port)
app.use(express.json());

// ─── System Prompt ───────────────────────────────────────────
const SYSTEM_PROMPT = `Ești Oasis, un Game Master pentru un joc de simulare financiară în care utilizatorul construiește o insulă virtuală. Folosește datele utilizatorului pentru a crea o Misiune Zilnică prietenoasă, legată de un obicei și de o mică economie posibilă azi. Oferă o recompensă virtuală tangibilă pentru insulă și estimează valoarea nominală a economiilor investite până la vârsta de 65 de ani, folosind orientativ un randament anual de 6% pentru Titluri de stat. Proiecția este o estimare, nu o garanție. Nu oferi prelegeri și nu inventa date despre utilizator.

Returnează OBLIGATORIU un singur obiect JSON valid, fără markdown, fără backticks și fără text suplimentar, cu exact aceste chei și tipuri:
questTitle (string), questStory (string), amountToSave (number, sumă propusă spre economisire azi în RON), virtualReward (string), futureRealValue (number, estimare în RON la 65 de ani), streakBonus (boolean, întotdeauna true).
Răspunde DOAR cu obiectul JSON.
/no_think`;

function extractJsonObject(text) {
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(text.slice(start, index + 1));
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              return parsed;
            }
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("Nu am putut extrage un obiect JSON valid din răspunsul LLM.");
}

function normalizeQuestResponse(parsed) {
  const requiredStrings = ["questTitle", "questStory", "virtualReward"];
  for (const key of requiredStrings) {
    if (typeof parsed[key] !== "string" || !parsed[key].trim()) {
      throw new Error(`Răspunsul LLM nu conține un câmp valid: ${key}.`);
    }
  }

  const amountToSave = Number(parsed.amountToSave);
  const futureRealValue = Number(parsed.futureRealValue);
  if (
    !Number.isFinite(amountToSave) ||
    amountToSave < 0 ||
    !Number.isFinite(futureRealValue) ||
    futureRealValue < 0
  ) {
    throw new Error("Răspunsul LLM conține valori numerice invalide.");
  }

  return {
    questTitle: parsed.questTitle.trim(),
    questStory: parsed.questStory.trim(),
    amountToSave,
    virtualReward: parsed.virtualReward.trim(),
    futureRealValue,
    streakBonus: true,
  };
}

function buildFallbackResponse({ age, guiltyPleasure, monthlyGuiltyPleasureSpend }) {
  const amountToSave = Math.round((monthlyGuiltyPleasureSpend / 60) * 100) / 100;
  const monthsToInvest = Math.max(0, Math.floor((65 - age) * 12));
  const monthlyRate = Math.pow(1.06, 1 / 12) - 1;
  const monthlyContribution = amountToSave * 30;
  const futureRealValue =
    monthlyRate === 0
      ? monthlyContribution * monthsToInvest
      : monthlyContribution *
        ((Math.pow(1 + monthlyRate, monthsToInvest) - 1) / monthlyRate);

  return {
    questTitle: "Misiunea de azi: O alegere pentru insula ta",
    questStory: `Pune deoparte ${amountToSave} RON azi, reducând puțin cheltuielile pentru ${guiltyPleasure}. Economiile regulate pot crește în timp, dar rezultatul nu este garantat.`,
    amountToSave,
    virtualReward: "Oază cu palmieri",
    futureRealValue: Math.round(futureRealValue),
    streakBonus: true,
  };
}

// ─── POST /api/momentum ─────────────────────────────────────
app.post("/api/momentum", async (req, res) => {
  const body = req.body || {};
  const age = Number(body.age);
  const monthlyIncome = Number(body.monthlyIncome);
  const monthlyGuiltyPleasureSpend = Number(body.monthlyGuiltyPleasureSpend);
  const guiltyPleasure =
    typeof body.guiltyPleasure === "string" ? body.guiltyPleasure.trim() : "";

  if (
    !Number.isInteger(age) ||
    age < 1 ||
    age > 120 ||
    !Number.isFinite(monthlyIncome) ||
    monthlyIncome < 0 ||
    !guiltyPleasure ||
    !Number.isFinite(monthlyGuiltyPleasureSpend) ||
    monthlyGuiltyPleasureSpend < 0
  ) {
    return res.status(400).json({
      error:
        "Trimite age (1-120), monthlyIncome, guiltyPleasure și monthlyGuiltyPleasureSpend cu valori valide.",
    });
  }

  const input = {
    age,
    monthlyIncome,
    guiltyPleasure,
    monthlyGuiltyPleasureSpend,
  };

  try {
    if (!openai) {
      throw new Error("API_KEY nu este configurată; se folosește fallback-ul local.");
    }

    const userMessage = `
Datele utilizatorului:
- Vârstă: ${age} ani
- Venit lunar: ${monthlyIncome} RON
- Plăcere vinovată: ${guiltyPleasure}
- Cheltuială lunară pe plăcerea vinovată: ${monthlyGuiltyPleasureSpend} RON

Generează recomandarea financiară în format JSON.`.trim();

  console.log("\n📥  Cerere de misiune primită.");

    const completion = await openai.chat.completions.create({
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
    if (typeof rawResponse !== "string" || !rawResponse.trim()) {
      throw new Error("LLM-ul a returnat un răspuns gol.");
    }

    const response = normalizeQuestResponse(extractJsonObject(rawResponse));

    console.log(`✅  Răspuns trimis către frontend:`, response);
    return res.json(response);
  } catch (err) {
    console.error(`\n❌  Eroare:`, err.message || err);

    const fallbackResponse = buildFallbackResponse(input);
    console.log("🔄  Misiune calculată local:", fallbackResponse);
    return res.json(fallbackResponse);
  }
});

// ─── Health Check ────────────────────────────────────────────
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
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀  Momentum API rulează pe http://localhost:${PORT}`);
    console.log(`📡  Model: ${MODEL_NAME}`);
    console.log(`🔗  Base URL: ${BASE_URL}`);
    if (!API_KEY) console.warn("⚠️  API_KEY lipsește; endpointul va folosi fallback-ul local.");
    console.log(`\n📌  Endpoint: POST http://localhost:${PORT}/api/momentum`);
    console.log(`📌  Health:   GET  http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = {
  app,
  SYSTEM_PROMPT,
  extractJsonObject,
  normalizeQuestResponse,
  buildFallbackResponse,
};
