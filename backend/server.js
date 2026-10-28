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

if (!API_KEY) {
  console.error("❌  Lipsește API_KEY în .env — nu pot porni serverul.");
  process.exit(1);
}

// ─── OpenAI client pointed at Featherless ────────────────────
const openai = new OpenAI({
  apiKey: API_KEY,
  baseURL: BASE_URL,
});

// ─── Express App ─────────────────────────────────────────────
const app = express();

app.use(cors()); // permite cereri din orice origine (frontend pe alt port)
app.use(express.json());

// ─── System Prompt (conform implementationplan.md) ───────────
const SYSTEM_PROMPT = `Ești un expert financiar comportamental din România. Primești vârsta, venitul și o cheltuială recurentă a unui tânăr. Găsește o modalitate de a reduce acea cheltuială (nu de a o elimina) și calculează empiric câți bani ar strânge până la 65 de ani dacă ar investi economiile în Titluri de Stat Tezaur (aprox 6% dobândă anuală). Nu ține prelegeri. Trebuie să returnezi răspunsul OBLIGATORIU în format JSON pur, fără markdown, fără backticks, cu următoarele chei exacte:
habitToChange (string), monthlySavings (number), futureValueAt65 (number), investmentVehicle (string), actionMessage (string, mesaj motivațional scurt și prietenos), confidenceScore (number 0-100).
Răspunde DOAR cu obiectul JSON, nimic altceva.
/no_think`;

// ─── POST /api/momentum ─────────────────────────────────────
app.post("/api/momentum", async (req, res) => {
  try {
    // 1. Validare minimală
    const { age, monthlyIncome, guiltyPleasure, monthlyGuiltyPleasureSpend } =
      req.body;

    if (
      age == null ||
      monthlyIncome == null ||
      !guiltyPleasure ||
      monthlyGuiltyPleasureSpend == null
    ) {
      return res.status(400).json({
        error:
          "Toate câmpurile sunt obligatorii: age, monthlyIncome, guiltyPleasure, monthlyGuiltyPleasureSpend",
      });
    }

    // 2. Construim mesajul utilizatorului pentru LLM
    const userMessage = `
Datele utilizatorului:
- Vârstă: ${age} ani
- Venit lunar: ${monthlyIncome} RON
- Plăcere vinovată: ${guiltyPleasure}
- Cheltuială lunară pe plăcerea vinovată: ${monthlyGuiltyPleasureSpend} RON

Generează recomandarea financiară în format JSON.`.trim();

    console.log(`\n📥  Cerere primită:`, { age, monthlyIncome, guiltyPleasure, monthlyGuiltyPleasureSpend });

    // 3. Apel către Featherless AI (OpenAI-compatible)
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
    console.log(`🤖  Răspuns brut LLM:\n`, rawResponse);

    if (!rawResponse) {
      throw new Error("LLM-ul a returnat un răspuns gol.");
    }

    // 4. Parsăm JSON-ul din răspunsul LLM-ului
    //    Curățăm thinking tags (Qwen3+) și backticks
    let cleanedResponse = rawResponse.trim();

    // Eliminăm Qwen3 thinking tags dacă apar
    cleanedResponse = cleanedResponse
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim();

    // Eliminăm eventualele blocuri markdown ```json ... ```
    cleanedResponse = cleanedResponse
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedResponse);
    } catch (parseErr) {
      // Încercăm să extragem JSON-ul cu regex dacă parsarea directă eșuează
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(
          `Nu am putut parsa răspunsul LLM ca JSON: ${cleanedResponse}`
        );
      }
    }

    // 5. Validăm cheile obligatorii conform contractului
    const requiredKeys = [
      "habitToChange",
      "monthlySavings",
      "futureValueAt65",
      "investmentVehicle",
      "actionMessage",
      "confidenceScore",
    ];

    for (const key of requiredKeys) {
      if (!(key in parsed)) {
        console.warn(`⚠️  Cheia "${key}" lipsește din răspunsul LLM, se adaugă valoare default.`);
      }
    }

    // Asigurăm structura contractului cu valori fallback
    const response = {
      habitToChange: parsed.habitToChange || guiltyPleasure,
      monthlySavings: Number(parsed.monthlySavings) || 0,
      futureValueAt65: Number(parsed.futureValueAt65) || 0,
      investmentVehicle:
        parsed.investmentVehicle || "Titluri de stat Tezaur (fără taxe)",
      actionMessage:
        parsed.actionMessage || "Încearcă să reduci cheltuielile pe " + guiltyPleasure + " și investește diferența!",
      confidenceScore: Number(parsed.confidenceScore) || 75,
    };

    console.log(`✅  Răspuns trimis către frontend:`, response);
    return res.json(response);
  } catch (err) {
    console.error(`\n❌  Eroare:`, err.message || err);

    // Fallback: dacă LLM-ul pică, returnăm un răspuns calculat simplu
    const { age, monthlyIncome, guiltyPleasure, monthlyGuiltyPleasureSpend } =
      req.body;

    if (age && monthlyGuiltyPleasureSpend) {
      const monthlySavings = Math.round(monthlyGuiltyPleasureSpend * 0.5);
      const yearsToInvest = 65 - age;
      const annualRate = 0.06;
      // Future Value of Annuity formula
      const futureValue = Math.round(
        monthlySavings *
          12 *
          ((Math.pow(1 + annualRate, yearsToInvest) - 1) / annualRate)
      );

      const fallbackResponse = {
        habitToChange: guiltyPleasure || "Cheltuieli recurente",
        monthlySavings,
        futureValueAt65: futureValue,
        investmentVehicle: "Titluri de stat Tezaur (fără taxe)",
        actionMessage: `Dacă reduci cheltuielile pe ${guiltyPleasure || "plăcerea ta vinovată"} cu 50%, ai putea economisi ${monthlySavings} RON/lună. Investiți în Tezaur, la 65 de ani ai avea ~${futureValue.toLocaleString("ro-RO")} RON.`,
        confidenceScore: 60,
      };

      console.log(`🔄  Fallback matematic trimis:`, fallbackResponse);
      return res.json(fallbackResponse);
    }

    return res.status(500).json({
      error: "Eroare internă la procesarea cererii. Încearcă din nou.",
    });
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
app.listen(PORT, () => {
  console.log(`\n🚀  Momentum API rulează pe http://localhost:${PORT}`);
  console.log(`📡  Model: ${MODEL_NAME}`);
  console.log(`🔗  Base URL: ${BASE_URL}`);
  console.log(`\n📌  Endpoint: POST http://localhost:${PORT}/api/momentum`);
  console.log(`📌  Health:   GET  http://localhost:${PORT}/api/health\n`);
});
