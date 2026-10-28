const { randomUUID } = require("node:crypto");
const { addLedgerEntry } = require("./ledger");
const { PLOT_IDS } = require("./shop");
const shop = require("../rules/shop.json");

const BANANA_COST = shop.find((item) => item.id === "banana")?.priceCredits;
const DAILY_SEND_LIMIT = 3;
const DEFAULT_MIN_INVEST_RON = Number(process.env.BANANA_MIN_INVEST_RON) || 20;
const DEFAULT_TTL_MS = Number(process.env.BANANA_TTL_MS) || 24 * 60 * 60 * 1000;

function domainError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function isExpired(challenge, now = Date.now()) {
  return Date.parse(challenge.expiresAt) <= now;
}

async function sendBanana(repository, fromUser, toUser) {
  if (fromUser === toUser) throw domainError("Nu poți trimite o banană propriei insule.", 400, "SELF_CHALLENGE");
  return repository.transaction(async (tx) => {
    const friend = (await tx.listFriends(fromUser)).find((entry) => entry.id === toUser);
    if (!friend) throw domainError("Poți trimite banane doar prietenilor.", 403, "NOT_FRIEND");
    if (await tx.getMute(toUser, fromUser)) throw domainError("Acest prieten a dezactivat provocările tale.", 403, "MUTED");

    const now = Date.now();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const outgoing = await tx.listChallenges(fromUser, { direction: "outgoing" });
    const sentToday = outgoing.filter((entry) => entry.kind === "banana" && Date.parse(entry.createdAt) >= startOfDay.getTime()).length;
    if (sentToday >= DAILY_SEND_LIMIT) throw domainError("Ai atins limita de 3 banane pentru astăzi.", 429, "DAILY_LIMIT");

    const incoming = await tx.listChallenges(toUser, { direction: "incoming" });
    for (const challenge of incoming) {
      if (challenge.status === "pending" && isExpired(challenge, now)) {
        await tx.updateChallenge(toUser, challenge.id, { status: "expired" });
      }
    }
    if (incoming.some((entry) => entry.status === "pending" && !isExpired(entry, now))) {
      throw domainError("Prietenul are deja o banană activă.", 409, "ACTIVE_BANANA");
    }

    const inventory = await tx.listInventory(toUser);
    const occupied = new Set(inventory.map((entry) => entry.placedPlot).filter(Boolean));
    for (const challenge of incoming) {
      if (challenge.status === "pending" && !isExpired(challenge, now)) occupied.add(challenge.blockedPlot);
    }
    const blockedPlot = PLOT_IDS.find((plotId) => !occupied.has(plotId));
    if (!blockedPlot) throw domainError("Insula prietenului nu are un plot liber pentru provocare.", 409, "NO_FREE_PLOT");

    const challenge = await tx.createChallenge({
      fromUser,
      toUser,
      kind: "banana",
      status: "pending",
      blockedPlot,
      minInvestRon: DEFAULT_MIN_INVEST_RON,
      expiresAt: new Date(now + DEFAULT_TTL_MS).toISOString(),
    });
    await addLedgerEntry(tx, {
      userId: fromUser,
      currency: "CREDITS",
      amount: -BANANA_COST,
      kind: "banana_sent",
      refType: "challenge",
      refId: challenge.id,
      idempotencyKey: `banana:${challenge.id}:sender-cost`,
    });
    return { challenge, creditsBalance: await tx.getBalance(fromUser, "CREDITS") };
  });
}

async function getInbox(repository, userId) {
  return repository.transaction(async (tx) => {
    const incoming = await tx.listChallenges(userId, { direction: "incoming" });
    const visible = [];
    const now = Date.now();
    for (const challenge of incoming) {
      if (challenge.status !== "pending") continue;
      if (isExpired(challenge, now)) {
        await tx.updateChallenge(userId, challenge.id, { status: "expired" });
        continue;
      }
      if (await tx.getMute(userId, challenge.fromUser)) continue;
      const sender = await tx.getUser(challenge.fromUser);
      visible.push({ ...challenge, sender: sender && { id: sender.id, displayName: sender.displayName, handle: sender.handle } });
    }
    return visible;
  });
}

async function cleanBanana(repository, receiverId, challengeId, { destinationId, amountRon }) {
  return repository.transaction(async (tx) => {
    const challenge = (await tx.listChallenges(receiverId, { direction: "incoming" })).find((entry) => entry.id === challengeId);
    if (!challenge) throw domainError("Provocarea nu a fost găsită.", 404, "CHALLENGE_NOT_FOUND");
    if (challenge.status === "cleaned") {
      return { alreadyCleaned: true, challenge, creditsBalance: await tx.getBalance(receiverId, "CREDITS") };
    }
    if (challenge.status !== "pending") throw domainError("Provocarea nu mai este activă.", 409, "CHALLENGE_INACTIVE");
    if (isExpired(challenge)) {
      await tx.updateChallenge(receiverId, challengeId, { status: "expired" });
      return { expired: true, challenge: { ...challenge, status: "expired" } };
    }
    if (await tx.getMute(receiverId, challenge.fromUser)) {
      throw domainError("Ai dezactivat provocările acestui prieten.", 403, "MUTED");
    }
    if (typeof amountRon !== "number" || !Number.isFinite(amountRon) || amountRon < challenge.minInvestRon) {
      throw domainError(`Investiția minimă pentru curățare este ${challenge.minInvestRon} RON.`, 400, "MIN_INVESTMENT");
    }
    const destination = ["fidelis", "depozit", "pilon-iii"].includes(destinationId);
    if (!destination) throw domainError("Alege un instrument de simulare valid.", 400, "INVALID_DESTINATION");

    await addLedgerEntry(tx, {
      userId: receiverId,
      currency: "RON_SIM",
      amount: -amountRon,
      kind: "banana_clean_investment",
      refType: "challenge",
      refId: challengeId,
      idempotencyKey: `banana:${challengeId}:receiver-investment`,
    });
    await tx.addInvestment(receiverId, { destinationId, amountRon, source: "challenge", refId: challengeId });
    for (const userId of [receiverId, challenge.fromUser]) {
      await addLedgerEntry(tx, {
        userId,
        currency: "CREDITS",
        amount: 10,
        kind: "banana_clean_bonus",
        refType: "challenge",
        refId: challengeId,
        idempotencyKey: `banana:${challengeId}:cleaned:${userId}`,
      });
    }
    const updated = await tx.updateChallenge(receiverId, challengeId, {
      status: "cleaned",
      destinationId,
      investedRon: amountRon,
      cleanedAt: new Date().toISOString(),
    });
    return {
      alreadyCleaned: false,
      challenge: updated,
      creditsBalance: await tx.getBalance(receiverId, "CREDITS"),
      senderCreditsBalance: await tx.getBalance(challenge.fromUser, "CREDITS"),
    };
  });
}

async function muteFriend(repository, userId, friendId, muted) {
  const friend = (await repository.listFriends(userId)).find((entry) => entry.id === friendId);
  if (!friend) throw domainError("Poți dezactiva provocările doar pentru prieteni.", 403, "NOT_FRIEND");
  return repository.setMute(userId, friendId, muted);
}

module.exports = {
  BANANA_COST,
  DAILY_SEND_LIMIT,
  DEFAULT_MIN_INVEST_RON,
  DEFAULT_TTL_MS,
  sendBanana,
  getInbox,
  cleanBanana,
  muteFriend,
};
