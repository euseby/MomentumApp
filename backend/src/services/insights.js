const assumptions = require("../rules/assumptions.json");

const DISCRETIONARY = new Set(["coffee", "food_delivery", "ride_hailing", "subscriptions"]);
const CATEGORY_LABELS = {
  coffee: "cafea",
  food_delivery: "food delivery",
  ride_hailing: "ride-hailing",
  subscriptions: "abonamente",
};

function detectHabit(transactions) {
  const expenses = transactions.filter((entry) => entry.amountRon < 0 && DISCRETIONARY.has(entry.category));
  const groups = new Map();
  for (const transaction of expenses) {
    const group = groups.get(transaction.category) || [];
    group.push(transaction);
    groups.set(transaction.category, group);
  }

  const habits = [...groups.entries()]
    .map(([category, entries]) => {
      const count = entries.length;
      const total = Math.round(entries.reduce((sum, entry) => sum + Math.abs(entry.amountRon), 0) * 100) / 100;
      const dates = entries.map((entry) => entry.date).sort();
      const observedSpan = dates.length > 1
        ? Math.ceil((Date.parse(`${dates.at(-1)}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) / 86400000) + 1
        : 7;
      const periodDays = Math.min(28, Math.max(7, observedSpan));
      const suggestedCount = Math.max(0, Math.round(count * (1 - assumptions.suggestedReductionPct)));
      const avgPrice = count ? Math.round((total / count) * 100) / 100 : 0;
      const weeklySaving = Math.round((count - suggestedCount) * avgPrice * 7 / periodDays * 100) / 100;
      return {
        category: CATEGORY_LABELS[category] || category,
        categoryId: category,
        count,
        total,
        avgPrice,
        periodDays,
        suggestedReductionPct: assumptions.suggestedReductionPct,
        suggestedCount,
        weeklySaving,
      };
    })
    .filter((habit) => habit.count >= 4)
    .sort((a, b) => b.total - a.total);

  return habits[0] || null;
}

function buildInsights(transactions) {
  const totals = new Map();
  let income = 0;
  let spend = 0;
  for (const transaction of transactions) {
    totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.amountRon);
    if (transaction.amountRon > 0) income += transaction.amountRon;
    else spend += Math.abs(transaction.amountRon);
  }
  return {
    categoryTotals: [...totals.entries()].map(([category, amountRon]) => ({ category, amountRon: Math.round(amountRon * 100) / 100 })),
    incomeRon: Math.round(income * 100) / 100,
    spendRon: Math.round(spend * 100) / 100,
    habit: detectHabit(transactions),
  };
}

module.exports = { detectHabit, buildInsights, DISCRETIONARY };