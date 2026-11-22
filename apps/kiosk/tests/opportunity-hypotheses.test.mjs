import test from "node:test";
import assert from "node:assert/strict";
import { opportunitiesFor, selectedPair } from "../src/opportunityHypotheses.ts";
import { catalogFor } from "../src/catalogIntelligence.ts";

test("Opportunity hypotheses refer to real present items with exact entered prices", () => {
  assert.equal(opportunitiesFor("miora").length, 2);
  assert.equal(opportunitiesFor("sefa-beach").length, 3);
  for (const id of ["miora", "sefa-beach"]) {
    const menu = catalogFor(id);
    for (const proposal of opportunitiesFor(id)) {
      assert.equal(proposal.evidenceStatus, "menu-based-untested");
      assert.ok(menu.items.some((p) => p.id === proposal.mainId));
      assert.ok(menu.items.some((p) => p.id === proposal.addOnId));
      assert.equal(proposal.fullPriceMinor, proposal.main.priceMinor + proposal.addOn.priceMinor);
      assert.equal(proposal.incrementalPriceMinor, proposal.addOn.priceMinor);
      assert.ok(proposal.needToTest.endsWith("?"));
      assert.ok(proposal.metric);
    }
  }
});

test("Concrete MIORA coffee and dessert pair is priced without a fictional discount", () => {
  const pair = opportunitiesFor("miora").find((p) => p.id === "miora-coffee-dessert");
  assert.equal(pair.main.name, "Caffe Latte");
  assert.equal(pair.main.priceMinor, 20000);
  assert.equal(pair.addOn.name, "San Sebastian");
  assert.equal(pair.addOn.priceMinor, 25000);
  assert.equal(pair.fullPriceMinor, 45000);
});

test("Sefa source prices stay intact for breakfast plus tea", () => {
  const pair = opportunitiesFor("sefa-beach").find((p) => p.id === "sefa-breakfast-tea");
  assert.equal(pair.main.priceMinor, 45000);
  assert.equal(pair.addOn.priceMinor, 3500);
  assert.equal(pair.fullPriceMinor, 48500);
});

test("Private Riva and demo menus cannot produce menu-derived public hypotheses", () => {
  for (const id of ["riva-bella", "robys", "bite-burger", "ai-cafe"]) {
    assert.deepEqual(opportunitiesFor(id), []);
    assert.equal(selectedPair(id, "1", "2"), null);
  }
});

test("Manual pair rejects a missing price, self pair and missing product", () => {
  assert.equal(selectedPair("sefa-beach", "84", "89"), null);
  assert.equal(selectedPair("miora", "428748", "428748"), null);
  assert.equal(selectedPair("miora", "404", "428748"), null);
  const valid = selectedPair("sefa-beach", "34", "89");
  assert.equal(valid.fullPriceMinor, 50000);
});
