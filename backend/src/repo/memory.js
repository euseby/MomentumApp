const { randomUUID } = require("node:crypto");

const DEMO_USERS = [
  { id: "demo-ioana", displayName: "Ioana", handle: "ioana", inviteCode: "IOANA24" },
  { id: "demo-radu", displayName: "Radu", handle: "radu", inviteCode: "RADU24" },
];

const clone = (value) => structuredClone(value);

function createMemoryRepository() {
  let transactionTail = Promise.resolve();
  const state = {
    users: new Map(DEMO_USERS.map((user) => [user.id, clone(user)])),
    statements: [],
    transactions: [],
    quests: [],
    ledgerEntries: [],
    investments: [],
    inventory: [],
    friendships: [
      { userId: "demo-ioana", friendId: "demo-radu", status: "accepted" },
      { userId: "demo-radu", friendId: "demo-ioana", status: "accepted" },
    ],
    challenges: [],
    mutes: [],
  };

  for (const user of DEMO_USERS) {
    state.ledgerEntries.push({
      id: randomUUID(),
      userId: user.id,
      currency: "RON_SIM",
      amount: 5000,
      kind: "demo_seed",
      refType: "user",
      refId: user.id,
      idempotencyKey: `seed:${user.id}:RON_SIM`,
      createdAt: new Date().toISOString(),
    });
  }

  function requireUser(userId) {
    if (!state.users.has(userId)) {
      const error = new Error("User not found.");
      error.code = "USER_NOT_FOUND";
      throw error;
    }
  }

  const repository = {
    async getUser(userId) {
      return clone(state.users.get(userId) || null);
    },

    async getUserByHandle(handle) {
      const user = [...state.users.values()].find((entry) => entry.handle === handle);
      return clone(user || null);
    },

    async getUserByInviteCode(inviteCode) {
      const code = String(inviteCode || "").toUpperCase();
      const user = [...state.users.values()].find((entry) => entry.inviteCode === code);
      return clone(user || null);
    },

    async saveStatement(userId, meta) {
      requireUser(userId);
      const statement = {
        id: randomUUID(),
        userId,
        source: meta.source,
        txCount: meta.txCount || 0,
        importedAt: new Date().toISOString(),
      };
      state.statements.push(statement);
      return clone(statement);
    },

    async saveTransactions(userId, statementId, transactions) {
      requireUser(userId);
      const statement = state.statements.find((entry) => entry.id === statementId && entry.userId === userId);
      if (!statement) throw new Error("Statement not found for user.");
      const saved = transactions.map((transaction) => ({
        ...clone(transaction),
        id: transaction.id || randomUUID(),
        userId,
        statementId,
      }));
      state.transactions.push(...saved);
      statement.txCount = saved.length;
      return clone(saved);
    },

    async listTransactions(userId, { since } = {}) {
      return clone(state.transactions.filter((entry) =>
        entry.userId === userId && (!since || entry.date >= since),
      ));
    },

    async deleteAllUserData(userId) {
      requireUser(userId);
      const statementIds = new Set(state.statements.filter((entry) => entry.userId === userId).map((entry) => entry.id));
      for (const key of ["statements", "transactions", "quests", "ledgerEntries", "investments", "inventory"]) {
        state[key] = state[key].filter((entry) => entry.userId !== userId);
      }
      state.transactions = state.transactions.filter((entry) => !statementIds.has(entry.statementId));
      state.friendships = state.friendships.filter((entry) => entry.userId !== userId && entry.friendId !== userId);
      state.challenges = state.challenges.filter((entry) => entry.fromUser !== userId && entry.toUser !== userId);
      state.mutes = state.mutes.filter((entry) => entry.userId !== userId && entry.mutedUserId !== userId);
      return true;
    },

    async createQuest(userId, quest) {
      requireUser(userId);
      const created = { ...clone(quest), id: randomUUID(), userId, status: "offered", createdAt: new Date().toISOString() };
      state.quests.push(created);
      return clone(created);
    },

    async getQuest(userId, questId) {
      return clone(state.quests.find((entry) => entry.id === questId && entry.userId === userId) || null);
    },

    async updateQuest(userId, questId, updates) {
      const quest = state.quests.find((entry) => entry.id === questId && entry.userId === userId);
      if (!quest) return null;
      Object.assign(quest, clone(updates));
      return clone(quest);
    },

    async latestQuest(userId) {
      const quests = state.quests.filter((entry) => entry.userId === userId);
      return clone(quests.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null);
    },

    async countAcceptedQuests(userId) {
      requireUser(userId);
      return state.quests.filter((entry) => entry.userId === userId && entry.status === "accepted").length;
    },

    async addLedgerEntry(entry) {
      requireUser(entry.userId);
      const existing = state.ledgerEntries.find((row) => row.idempotencyKey === entry.idempotencyKey);
      if (existing) {
        const sameOperation = ["userId", "currency", "amount", "kind", "refType", "refId"]
          .every((key) => existing[key] === entry[key]);
        if (!sameOperation) {
          const error = new Error("Idempotency key was already used for a different ledger operation.");
          error.code = "IDEMPOTENCY_CONFLICT";
          throw error;
        }
        return clone(existing);
      }

      const balance = state.ledgerEntries
        .filter((row) => row.userId === entry.userId && row.currency === entry.currency)
        .reduce((total, row) => total + row.amount, 0);
      if (balance + entry.amount < 0) {
        const error = new Error("Insufficient balance.");
        error.code = "INSUFFICIENT_FUNDS";
        throw error;
      }

      const created = { id: randomUUID(), createdAt: new Date().toISOString(), ...clone(entry) };
      state.ledgerEntries.push(created);
      return clone(created);
    },

    async getBalance(userId, currency) {
      requireUser(userId);
      return state.ledgerEntries
        .filter((entry) => entry.userId === userId && entry.currency === currency)
        .reduce((total, entry) => total + entry.amount, 0);
    },

    async addInvestment(userId, investment) {
      requireUser(userId);
      const created = { ...clone(investment), id: randomUUID(), userId, createdAt: new Date().toISOString() };
      state.investments.push(created);
      return clone(created);
    },

    async listInvestments(userId) {
      return clone(state.investments.filter((entry) => entry.userId === userId));
    },

    async addInventoryItem(userId, item) {
      requireUser(userId);
      if (item.idempotencyKey) {
        const existing = state.inventory.find((entry) => entry.userId === userId && entry.idempotencyKey === item.idempotencyKey);
        if (existing) return clone(existing);
      }
      const created = { ...clone(item), id: randomUUID(), userId, placedPlot: null, acquiredAt: new Date().toISOString() };
      state.inventory.push(created);
      return clone(created);
    },

    async listInventory(userId) {
      return clone(state.inventory.filter((entry) => entry.userId === userId));
    },

    async placeItem(userId, itemId, plotId) {
      const item = state.inventory.find((entry) => entry.id === itemId && entry.userId === userId);
      if (!item) return null;
      item.placedPlot = plotId;
      return clone(item);
    },

    async listFriends(userId) {
      return clone(state.friendships
        .filter((entry) => entry.userId === userId && entry.status === "accepted")
        .map((entry) => state.users.get(entry.friendId))
        .filter(Boolean));
    },

    async addFriend(userId, friendId) {
      requireUser(userId);
      requireUser(friendId);
      if (userId === friendId) throw new Error("A user cannot add themselves as a friend.");
      const found = state.friendships.find((entry) => entry.userId === userId && entry.friendId === friendId);
      if (!found) state.friendships.push({ userId, friendId, status: "accepted" });
      return clone(state.friendships.find((entry) => entry.userId === userId && entry.friendId === friendId));
    },

    async createChallenge(challenge) {
      requireUser(challenge.fromUser);
      requireUser(challenge.toUser);
      const created = { ...clone(challenge), id: randomUUID(), status: "pending", createdAt: new Date().toISOString() };
      state.challenges.push(created);
      return clone(created);
    },

    async listChallenges(userId, { direction = "both" } = {}) {
      return clone(state.challenges.filter((entry) =>
        (direction !== "incoming" && entry.fromUser === userId) ||
        (direction !== "outgoing" && entry.toUser === userId),
      ));
    },

    async updateChallenge(userId, challengeId, updates) {
      const challenge = state.challenges.find((entry) =>
        entry.id === challengeId && (entry.fromUser === userId || entry.toUser === userId),
      );
      if (!challenge) return null;
      Object.assign(challenge, clone(updates));
      return clone(challenge);
    },

    async getMute(userId, mutedUserId) {
      return state.mutes.some((entry) => entry.userId === userId && entry.mutedUserId === mutedUserId);
    },

    async setMute(userId, mutedUserId, muted) {
      requireUser(userId);
      requireUser(mutedUserId);
      state.mutes = state.mutes.filter((entry) => !(entry.userId === userId && entry.mutedUserId === mutedUserId));
      if (muted) state.mutes.push({ userId, mutedUserId });
      return Boolean(muted);
    },
  };

  repository.transaction = async (operation) => {
    const result = transactionTail.then(async () => {
      const snapshot = structuredClone(state);
      try {
        return await operation(repository);
      } catch (error) {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, snapshot);
        throw error;
      }
    });
    transactionTail = result.catch(() => undefined);
    return result;
  };

  return repository;
}

module.exports = { createMemoryRepository, DEMO_USERS };