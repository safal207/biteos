import test from "node:test";
import assert from "node:assert/strict";
import { catalogFor, catalogSummary } from "../src/catalogIntelligence.ts";

test("Read-only source catalogs keep counts and expose all prices as unverified", () => {
  const miora = catalogFor("miora");
  const sefa = catalogFor("sefa-beach");
  assert.equal(miora.items.length, 93);
  assert.equal(sefa.items.length, 123);
  assert.equal(catalogSummary(miora).missingPrice, 2);
  assert.equal(catalogSummary(sefa).missingPrice, 5);
  for (const c of [miora, sefa]) {
    assert.equal(c.status, "unverified-source-snapshot");
    assert.match(c.sourceSha ?? "", /^[0-9a-f]{40}$/);
    assert.equal(catalogSummary(c).ownerApproved, 0);
    assert.equal(new Set(c.items.map((item) => item.id)).size, c.items.length);
    assert.ok(c.items.every((item) => item.priceMinor === null || (Number.isSafeInteger(item.priceMinor) && item.priceMinor > 0)));
  }
});

test("Riva approved menu stays empty; private concept is not leaked", () => {
  const riva = catalogFor("riva-bella");
  assert.equal(riva.items.length, 0);
  assert.equal(riva.status, "no-approved-products");
  assert.ok(!riva.source.includes("riva-bella-gazipasa-concept"));
});

test("Native Bite Burger and Roby's are explicitly demo-only", () => {
  const burger = catalogFor("bite-burger");
  const robys = catalogFor("robys");
  assert.equal(burger.status, "demo-only");
  assert.equal(robys.status, "demo-only");
  assert.ok(robys.items.length > 0);
  assert.equal(catalogSummary(burger).ownerApproved, 0);
});

test("Pilot business without catalog has a distinct status", () => {
  assert.equal(catalogFor("ai-cafe").status, "not-applicable");
  assert.equal(catalogFor("ai-cafe").items.length, 0);
});
