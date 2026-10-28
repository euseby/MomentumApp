const shop = require("../rules/shop.json");
const { addLedgerEntry } = require("./ledger");

const PLOT_IDS = ["plot-1", "plot-2", "plot-3", "plot-4"];

function domainError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function buyShopItem(repository, userId, itemId, idempotencyKey) {
  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw domainError("Trimite un idempotencyKey pentru cumpărare.", 400, "IDEMPOTENCY_REQUIRED");
  }
  const item = shop.find((entry) => entry.id === itemId);
  if (!item || item.type === "action") throw domainError("Item-ul nu poate fi cumpărat din shop.", 404, "ITEM_NOT_FOUND");

  return repository.transaction(async (tx) => {
    await addLedgerEntry(tx, {
      userId,
      currency: "CREDITS",
      amount: -item.priceCredits,
      kind: "shop_purchase",
      refType: "shop_item",
      refId: item.id,
      idempotencyKey: `shop:${idempotencyKey}`,
    });
    const inventoryItem = await tx.addInventoryItem(userId, {
      itemId: item.id,
      name: item.name,
      type: item.type,
      sprite: item.sprite,
      source: "shop",
      idempotencyKey: `shop:${idempotencyKey}`,
    });
    return {
      item: inventoryItem,
      creditsBalance: await tx.getBalance(userId, "CREDITS"),
    };
  });
}

async function placeInventoryItem(repository, userId, inventoryId, plotId) {
  if (!PLOT_IDS.includes(plotId)) throw domainError("Plot invalid.", 400, "INVALID_PLOT");
  return repository.transaction(async (tx) => {
    const inventory = await tx.listInventory(userId);
    const item = inventory.find((entry) => entry.id === inventoryId);
    if (!item || item.type === "action") throw domainError("Item-ul nu este în inventarul tău.", 404, "ITEM_NOT_FOUND");
    if (item.placedPlot && item.placedPlot !== plotId) throw domainError("Item-ul este deja plasat. Mută-l din plot-ul actual.", 409, "ITEM_ALREADY_PLACED");

    const challenges = await tx.listChallenges(userId, { direction: "incoming" });
    const now = Date.now();
    const blocked = new Set();
    for (const challenge of challenges) {
      if (challenge.status === "pending" && Date.parse(challenge.expiresAt) <= now) {
        await tx.updateChallenge(userId, challenge.id, { status: "expired" });
      } else if (challenge.status === "pending") {
        blocked.add(challenge.blockedPlot);
      }
    }
    if (blocked.has(plotId)) throw domainError("Acest plot este blocat de o banană.", 409, "PLOT_BLOCKED");
    const occupied = inventory.some((entry) => entry.id !== inventoryId && entry.placedPlot === plotId);
    if (occupied) throw domainError("Plot-ul este deja ocupat.", 409, "PLOT_OCCUPIED");
    return tx.placeItem(userId, inventoryId, plotId);
  });
}

module.exports = { buyShopItem, placeInventoryItem, PLOT_IDS };
