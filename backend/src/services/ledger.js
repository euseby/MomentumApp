const CURRENCIES = new Set(["RON_SIM", "CREDITS"]);

async function addLedgerEntry(repository, entry) {
  if (!CURRENCIES.has(entry.currency)) throw new Error("Unsupported ledger currency.");
  if (!Number.isFinite(entry.amount) || entry.amount === 0) {
    throw new Error("Ledger amount must be a non-zero finite number.");
  }
  if (typeof entry.idempotencyKey !== "string" || !entry.idempotencyKey.trim()) {
    throw new Error("Ledger idempotencyKey is required.");
  }
  return repository.addLedgerEntry({ ...entry, idempotencyKey: entry.idempotencyKey.trim() });
}

async function getWalletBalances(repository, userId) {
  const [ronSim, credits] = await Promise.all([
    repository.getBalance(userId, "RON_SIM"),
    repository.getBalance(userId, "CREDITS"),
  ]);
  return { RON_SIM: ronSim, CREDITS: credits };
}

module.exports = { addLedgerEntry, getWalletBalances };