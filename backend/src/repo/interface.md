# Repository Interface

The active repository is an asynchronous, user-scoped adapter. Methods must not expose another user's records.

- Users: `getUser(userId)`, `getUserByHandle(handle)`
- Statements: `saveStatement(userId, meta)`, `saveTransactions(userId, statementId, transactions)`, `listTransactions(userId, { since })`, `deleteAllUserData(userId)`
- Quests: `createQuest(userId, quest)`, `getQuest(userId, questId)`, `updateQuest(userId, questId, updates)`, `latestQuest(userId)`
- Ledger: `addLedgerEntry(entry)`, `getBalance(userId, currency)`
- Investments: `addInvestment(userId, investment)`, `listInvestments(userId)`
- Inventory: `addInventoryItem(userId, item)`, `listInventory(userId)`, `placeItem(userId, itemId, plotId)`
- Friends: `listFriends(userId)`, `addFriend(userId, friendId)`
- Challenges: `createChallenge(challenge)`, `listChallenges(userId, { direction })`, `updateChallenge(userId, challengeId, updates)`
- Mutes: `getMute(userId, mutedUserId)`, `setMute(userId, mutedUserId, muted)`

Balances are derived from ledger entries. Adding a ledger entry is idempotent by `idempotencyKey` and rejects debits that would make a balance negative.