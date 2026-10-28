const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildFallbackResponse,
  extractJsonObject,
  normalizeQuestResponse,
} = require("./server");

test("extracts a JSON object from surrounding model text", () => {
  const parsed = extractJsonObject(
    'Rezultatul misiunii: ```json\n{"questTitle":"Insula {verde}","questStory":"Pune deoparte 25 RON.","amountToSave":25,"virtualReward":"Casă pe Plajă","futureRealValue":12500,"streakBonus":true}\n```'
  );

  assert.equal(parsed.questTitle, "Insula {verde}");
  assert.equal(parsed.virtualReward, "Casă pe Plajă");
});

test("normalizes the exact Oasis response contract", () => {
  const response = normalizeQuestResponse({
    questTitle: "Misiunea de azi",
    questStory: "Economisește pentru insula ta.",
    amountToSave: 25,
    virtualReward: "Casă pe Plajă",
    futureRealValue: 12500,
    streakBonus: false,
  });

  assert.deepEqual(response, {
    questTitle: "Misiunea de azi",
    questStory: "Economisește pentru insula ta.",
    amountToSave: 25,
    virtualReward: "Casă pe Plajă",
    futureRealValue: 12500,
    streakBonus: true,
  });
  assert.throws(
    () => normalizeQuestResponse({ questTitle: "Incomplete" }),
    /questStory/
  );
});

test("fallback returns the Oasis contract with a future estimate", () => {
  const response = buildFallbackResponse({
    age: 24,
    guiltyPleasure: "comenzi de mâncare",
    monthlyGuiltyPleasureSpend: 400,
  });

  assert.deepEqual(Object.keys(response), [
    "questTitle",
    "questStory",
    "amountToSave",
    "virtualReward",
    "futureRealValue",
    "streakBonus",
  ]);
  assert.equal(response.amountToSave, 6.67);
  assert.ok(response.futureRealValue > response.amountToSave);
  assert.equal(response.streakBonus, true);
});