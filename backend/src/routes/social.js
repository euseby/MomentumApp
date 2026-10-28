const express = require("express");
const shop = require("../rules/shop.json");
const { getCurrentUser } = require("../services/current-user");
const { buyShopItem, placeInventoryItem } = require("../services/shop");
const { sendBanana, getInbox, cleanBanana, muteFriend } = require("../services/social");

function errorResponse(res, error, fallback) {
  const status = error.status || (error.code === "INSUFFICIENT_FUNDS" ? 409 : error.code === "IDEMPOTENCY_CONFLICT" ? 409 : 500);
  return res.status(status).json({ error: error.status ? error.message : error.code === "INSUFFICIENT_FUNDS" ? "Nu ai suficiente credite sau sold simulat." : fallback });
}

function createSocialRouter(repository) {
  const router = express.Router();

  router.get("/api/shop", (req, res) => res.json(shop));

  router.post("/api/shop/buy", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      const result = await buyShopItem(repository, user.id, req.body?.itemId, req.body?.idempotencyKey);
      return res.status(201).json(result);
    } catch (error) {
      return errorResponse(res, error, "Nu am putut cumpăra item-ul.");
    }
  });

  router.post("/api/inventory/place", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      const item = await placeInventoryItem(repository, user.id, req.body?.itemId, req.body?.plotId);
      return res.json(item);
    } catch (error) {
      return errorResponse(res, error, "Nu am putut plasa item-ul.");
    }
  });

  router.get("/api/friends", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      const friends = await repository.listFriends(user.id);
      return res.json(friends.map(({ id, displayName, handle, inviteCode }) => ({ id, displayName, handle, inviteCode })));
    } catch (error) {
      return errorResponse(res, error, "Nu am putut încărca lista de prieteni.");
    }
  });

  router.post("/api/friends/add", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      const lookup = String(req.body?.handle || req.body?.inviteCode || "").trim();
      if (!lookup) return res.status(400).json({ error: "Introdu un handle sau cod de invitație." });
      const friend = req.body?.inviteCode
        ? await repository.getUserByInviteCode(lookup)
        : await repository.getUserByHandle(lookup.replace(/^@/, "").toLowerCase());
      if (!friend) return res.status(404).json({ error: "Nu am găsit acest utilizator." });
      await repository.transaction(async (tx) => {
        await tx.addFriend(user.id, friend.id);
        await tx.addFriend(friend.id, user.id);
      });
      return res.status(201).json({ id: friend.id, displayName: friend.displayName, handle: friend.handle, inviteCode: friend.inviteCode });
    } catch (error) {
      return errorResponse(res, error, "Nu am putut adăuga prietenul.");
    }
  });

  router.post("/api/friends/:friendId/mute", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      if (typeof req.body?.muted !== "boolean") return res.status(400).json({ error: "muted trebuie să fie boolean." });
      const muted = await muteFriend(repository, user.id, req.params.friendId, req.body.muted);
      return res.json({ muted });
    } catch (error) {
      return errorResponse(res, error, "Nu am putut actualiza setarea de mute.");
    }
  });

  router.post("/api/friends/banana", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      const result = await sendBanana(repository, user.id, req.body?.toUserId);
      return res.status(201).json(result);
    } catch (error) {
      return errorResponse(res, error, "Nu am putut trimite banana.");
    }
  });

  router.get("/api/inbox", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      return res.json(await getInbox(repository, user.id));
    } catch (error) {
      return errorResponse(res, error, "Nu am putut încărca inbox-ul.");
    }
  });

  router.post("/api/challenges/:id/clean", async (req, res) => {
    try {
      const user = await getCurrentUser(req, repository);
      const result = await cleanBanana(repository, user.id, req.params.id, {
        destinationId: req.body?.destinationId,
        amountRon: req.body?.amountRon,
      });
      return res.status(result.expired ? 410 : 200).json(result);
    } catch (error) {
      return errorResponse(res, error, "Nu am putut curăța banana.");
    }
  });

  return router;
}

module.exports = { createSocialRouter };
