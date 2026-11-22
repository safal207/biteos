/**
 * Hypothetical incremental contribution from a relevant, optional add-on.
 * No POS data, conversion measurement, fixed operating cost, VAT or tax is inferred.
 * All monetary inputs and outputs use minor currency units.
 */
export type Scenario = {
  ordersPerDay: number;
  days: number;
  baselineAttachPercent: number;
  proposedAttachPercent: number;
  addOnPriceMinor: number;
  addOnVariableCostMinor: number;
  campaignCostMinor: number;
};

export type ScenarioResult = {
  eligibleOrders: number;
  expectedIncrementalUnits: number;
  incrementalRevenueMinor: number;
  incrementalVariableCostMinor: number;
  incrementalContributionMinor: number;
};

export function validateScenario(v: Scenario): string | null {
  if (!Object.values(v).every(Number.isFinite)) return "Введите все показатели числами.";
  if (!Number.isSafeInteger(v.ordersPerDay) || v.ordersPerDay <= 0 || v.ordersPerDay > 1_000_000)
    return "Заказов в день должно быть от 1 до 1 000 000.";
  if (!Number.isSafeInteger(v.days) || v.days < 1 || v.days > 365)
    return "Горизонт — от 1 до 365 дней.";
  if ([v.baselineAttachPercent, v.proposedAttachPercent].some((rate) => rate < 0 || rate > 100))
    return "Доли допродажи должны быть от 0 до 100%.";
  for (const minor of [v.addOnPriceMinor, v.addOnVariableCostMinor, v.campaignCostMinor]) {
    if (!Number.isSafeInteger(minor) || minor < 0 || minor > 1_000_000_000)
      return "Денежные суммы должны быть неотрицательными и ограниченными.";
  }
  if (v.addOnPriceMinor === 0) return "Цена дополнения должна быть больше нуля.";
  return null;
}

export function estimateScenario(v: Scenario): ScenarioResult {
  const error = validateScenario(v);
  if (error) throw new Error(error);
  const eligibleOrders = v.ordersPerDay * v.days;
  const expectedIncrementalUnits =
    (eligibleOrders * (v.proposedAttachPercent - v.baselineAttachPercent)) / 100;
  const incrementalRevenueMinor = Math.round(expectedIncrementalUnits * v.addOnPriceMinor);
  const incrementalVariableCostMinor = Math.round(expectedIncrementalUnits * v.addOnVariableCostMinor);
  return {
    eligibleOrders,
    expectedIncrementalUnits,
    incrementalRevenueMinor,
    incrementalVariableCostMinor,
    incrementalContributionMinor:
      incrementalRevenueMinor - incrementalVariableCostMinor - v.campaignCostMinor,
  };
}
