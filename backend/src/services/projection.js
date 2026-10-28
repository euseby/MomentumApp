const assumptions = require("../rules/assumptions.json");
const destinations = require("../rules/destinations.json");

function projectDestination({ weeklySaving, age, destination, inflationRate = assumptions.inflationRate }) {
  const years = Math.max(0, assumptions.retirementAge - age);
  const months = years * 12;
  const monthlyContribution = weeklySaving * 52 / 12;
  const netAnnualRate = destination.taxType === "interest"
    ? destination.grossAnnual * (1 - destination.taxRate)
    : destination.grossAnnual;
  const monthlyRate = Math.pow(1 + netAnnualRate, 1 / 12) - 1;
  let grossBalance = 0;
  const yearlySeries = [];

  for (let month = 1; month <= months; month += 1) {
    grossBalance = grossBalance * (1 + monthlyRate) + monthlyContribution;
    if (month % 12 === 0 || month === months) {
      const yearsElapsed = month / 12;
      const contributed = monthlyContribution * month;
      const valueAfterTax = destination.taxType === "gains_at_payout"
        ? grossBalance - Math.max(0, grossBalance - contributed) * destination.taxRate
        : grossBalance;
      yearlySeries.push({
        year: age + yearsElapsed,
        nominalRon: Math.round(valueAfterTax),
        realRon: Math.round(valueAfterTax / Math.pow(1 + inflationRate, yearsElapsed)),
        contributedRon: Math.round(contributed),
      });
    }
  }

  const totalContributed = monthlyContribution * months;
  const grossNominal = grossBalance;
  const nominal = destination.taxType === "gains_at_payout"
    ? grossNominal - Math.max(0, grossNominal - totalContributed) * destination.taxRate
    : grossNominal;
  const annualContribution = monthlyContribution * 12;
  const deductionBenefit = destination.id === "pilon-iii"
    ? Math.min(annualContribution, destination.deductionCapEur * assumptions.eurRon) * 0.1 * years
    : 0;

  return {
    destinationId: destination.id,
    name: destination.name,
    grossAnnual: destination.grossAnnual,
    netAnnualRate,
    nominalRon: Math.round(nominal),
    realRon: Math.round(nominal / Math.pow(1 + inflationRate, years)),
    totalContributedRon: Math.round(totalContributed),
    deductionBenefitRon: Math.round(deductionBenefit),
    yearlySeries,
    source: destination.source,
    asOf: destination.asOf,
    verify: destination.verify,
    estimateDisclaimer: "Estimare orientativă, nu garantată.",
  };
}

function projectAll({ weeklySaving, age, inflationRate }) {
  if (!Number.isFinite(weeklySaving) || weeklySaving < 0) throw new Error("weeklySaving must be a non-negative number.");
  if (!Number.isInteger(age) || age < 1 || age > assumptions.retirementAge) throw new Error("age must be between 1 and 65.");
  return destinations.map((destination) => projectDestination({ weeklySaving, age, destination, inflationRate }));
}

module.exports = { projectDestination, projectAll, destinations };