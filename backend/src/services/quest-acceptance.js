const assumptions = require("../rules/assumptions.json");
const shop = require("../rules/shop.json");
const destinations = require("../rules/destinations.json");
const { addLedgerEntry, getWalletBalances } = require("./ledger");

function createDomainError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function acceptQuest(repository, userId, questId, destinationId) {
  const destination = destinations.find((item) => item.id === destinationId);
  if (!destination) throw createDomainError("Alege un instrument de simulare valid.", 400, "INVALID_DESTINATION");

  return repository.transaction(async (tx) => {
    const quest = await tx.getQuest(userId, questId);
    if (!quest) throw createDomainError("Quest-ul nu a fost găsit.", 404, "QUEST_NOT_FOUND");
    if (quest.status === "accepted") {
      return {
        alreadyAccepted: true,
        quest,
        balances: await getWalletBalances(tx, userId),
        investedRon: (await tx.listInvestments(userId)).reduce((sum, item) => sum + item.amountRon, 0),
      };
    }
    if (quest.status !== "offered") throw createDomainError("Quest-ul nu mai poate fi acceptat.", 409, "QUEST_NOT_OFFERED");

    const amount = quest.weeklySavingRon;
    if (!Number.isFinite(amount) || amount <= 0) throw createDomainError("Quest-ul nu are o sumă validă.", 422, "INVALID_QUEST_AMOUNT");
    const reward = shop.find((item) => item.id === quest.rewardId && item.type !== "action");
    if (!reward) throw createDomainError("Recompensa questului nu mai există în catalog.", 422, "INVALID_REWARD");

    const acceptedCount = await tx.countAcceptedQuests(userId);
    const streakStep = Math.min(acceptedCount + 1, assumptions.maxStreakBonusCredits / assumptions.streakBonusCredits);
    const streakBonusCredits = streakStep * assumptions.streakBonusCredits;
    const baseCredits = Math.round(amount * assumptions.creditsPerRon);

    await addLedgerEntry(tx, {
      userId,
      currency: "RON_SIM",
      amount: -amount,
      kind: "quest_investment",
      refType: "quest",
      refId: questId,
      idempotencyKey: `quest:${questId}:ron-sim`,
    });
    await tx.addInvestment(userId, {
      destinationId,
      amountRon: amount,
      source: "quest",
      refId: questId,
    });
    if (baseCredits > 0) {
      await addLedgerEntry(tx, {
        userId,
        currency: "CREDITS",
        amount: baseCredits,
        kind: "quest_credits",
        refType: "quest",
        refId: questId,
        idempotencyKey: `quest:${questId}:credits`,
      });
    }
    await addLedgerEntry(tx, {
      userId,
      currency: "CREDITS",
      amount: streakBonusCredits,
      kind: "streak_bonus",
      refType: "quest",
      refId: questId,
      idempotencyKey: `quest:${questId}:streak`,
    });
    const inventoryItem = await tx.addInventoryItem(userId, {
      itemId: reward.id,
      name: reward.name,
      type: reward.type,
      sprite: reward.sprite,
      source: "quest",
      refId: questId,
    });
    const acceptedQuest = await tx.updateQuest(userId, questId, {
      status: "accepted",
      destinationId,
      acceptedAt: new Date().toISOString(),
      inventoryItemId: inventoryItem.id,
      baseCredits,
      streakBonusCredits,
      streakStep,
    });

    return {
      alreadyAccepted: false,
      quest: acceptedQuest,
      inventoryItem,
      balances: await getWalletBalances(tx, userId),
      investedRon: (await tx.listInvestments(userId)).reduce((sum, item) => sum + item.amountRon, 0),
      streak: acceptedCount + 1,
    };
  });
}

module.exports = { acceptQuest };