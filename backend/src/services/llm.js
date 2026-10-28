const shop = require("../rules/shop.json");

const OASIS_SYSTEM_PROMPT = `Ești Oasis, un Game Master financiar. Primești doar un obicei agregat și un catalog de recompense permise. Scrie un titlu scurt, prietenos și jucăuș și alege recompensa potrivită din catalog. Nu inventa tranzacții, numere sau recompense.

Răspunde doar cu un obiect JSON valid, fără markdown, cu exact aceste chei: questTitle (string), rewardId (string, trebuie să fie un id din catalog).`;

const MOMENTUM_SYSTEM_PROMPT = `Ești Oasis, un Game Master financiar. Scrie un titlu și o poveste scurtă, prietenoasă, bazate pe profilul primit. Alege o recompensă numai din catalog. Nu calcula, nu inventa și nu include sume sau alte numere.

Răspunde doar cu un obiect JSON valid, fără markdown, cu exact aceste chei: questTitle (string), questStory (string), rewardId (string, trebuie să fie un id din catalog).`;

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

function normalizeQuestCopy(parsed, { requireStory = false } = {}) {
  if (typeof parsed.questTitle !== "string" || !parsed.questTitle.trim()) {
    throw new Error("Câmp invalid în răspunsul modelului: questTitle.");
  }
  if (requireStory && (typeof parsed.questStory !== "string" || !parsed.questStory.trim())) {
    throw new Error("Câmp invalid în răspunsul modelului: questStory.");
  }
  if (/\d/.test(parsed.questTitle) || (requireStory && /\d/.test(parsed.questStory))) {
    throw new Error("Textul modelului nu poate conține numere calculate de AI.");
  }
  if (typeof parsed.rewardId !== "string" || !shop.some((item) => item.id === parsed.rewardId)) {
    throw new Error("Modelul a ales o recompensă care nu există în catalog.");
  }
  return {
    questTitle: parsed.questTitle.trim(),
    ...(requireStory ? { questStory: parsed.questStory.trim() } : {}),
    reward: shop.find((item) => item.id === parsed.rewardId),
  };
}

async function requestQuestCopy(llmClient, { messages, requireStory = false }) {
  let repairMessages = messages;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const completion = await llmClient.chat.completions.create({
      model: process.env.MODEL_NAME || "meta-llama/Meta-Llama-3.1-8B-Instruct",
      messages: repairMessages,
      temperature: 0.2,
      max_tokens: 500,
    });
    const raw = completion.choices[0]?.message?.content;
    try {
      if (typeof raw !== "string" || !raw.trim()) throw new Error("Modelul a returnat un răspuns gol.");
      return normalizeQuestCopy(extractJsonObject(raw), { requireStory });
    } catch (error) {
      if (attempt === 1) throw error;
      repairMessages = [
        ...messages,
        { role: "assistant", content: typeof raw === "string" ? raw : "" },
        { role: "user", content: "Răspunsul nu respectă schema. Reia cu JSON valid și rewardId existent în catalog." },
      ];
    }
  }
  throw new Error("Nu am putut valida răspunsul modelului.");
}

module.exports = {
  OASIS_SYSTEM_PROMPT,
  MOMENTUM_SYSTEM_PROMPT,
  extractJsonObject,
  normalizeQuestResponse,
  normalizeOasisAnalysis,
  normalizeQuestCopy,
  requestQuestCopy,
};