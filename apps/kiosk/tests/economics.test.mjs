import test from "node:test";
import assert from "node:assert/strict";
import { estimateScenario, validateScenario } from "../src/economics.ts";

const assumptions = {
  ordersPerDay: 100,
  days: 30,
  baselineAttachPercent: 15,
  proposedAttachPercent: 25,
  addOnPriceMinor: 15000,
  addOnVariableCostMinor: 6000,
  campaignCostMinor: 300000,
};

test("Scenario calculates incremental revenue and contribution, not profit", () => {
  const result = estimateScenario(assumptions);
  assert.equal(result.eligibleOrders, 3000);
  assert.equal(result.expectedIncrementalUnits, 300);
  assert.equal(result.incrementalRevenueMinor, 4_500_000);
  assert.equal(result.incrementalVariableCostMinor, 1_800_000);
  assert.equal(result.incrementalContributionMinor, 2_400_000);
});

test("A worse attach rate yields negative contribution, not inflated growth", () => {
  const result = estimateScenario({ ...assumptions, proposedAttachPercent: 10 });
  assert.equal(result.expectedIncrementalUnits, -150);
  assert.equal(result.incrementalRevenueMinor, -2_250_000);
  assert.equal(result.incrementalContributionMinor, -1_650_000);
});

test("No uplift still includes incremental campaign cost", () => {
  assert.equal(estimateScenario({ ...assumptions, proposedAttachPercent: 15 }).incrementalContributionMinor, -300_000);
});

test("Scenario rejects broken input and excessive horizons", () => {
  for (const patch of [
    { ordersPerDay: NaN }, { days: 366 }, { days: 0 }, { days: 1.5 },
    { baselineAttachPercent: -1 }, { proposedAttachPercent: 105 },
    { addOnPriceMinor: 0 }, { addOnVariableCostMinor: -1 },
    { campaignCostMinor: Infinity },
  ]) {
    const bad = { ...assumptions, ...patch };
    assert.ok(validateScenario(bad));
    assert.throws(() => estimateScenario(bad));
  }
});

test("Cents are rounded after multiplying expected units, not before", () => {
  const result = estimateScenario({
    ordersPerDay: 3, days: 1,
    baselineAttachPercent: 0, proposedAttachPercent: 10,
    addOnPriceMinor: 1001, addOnVariableCostMinor: 501, campaignCostMinor: 0,
  });
  assert.equal(result.expectedIncrementalUnits, 0.3);
  assert.equal(result.incrementalRevenueMinor, 300);
  assert.equal(result.incrementalVariableCostMinor, 150);
  assert.equal(result.incrementalContributionMinor, 150);
});
