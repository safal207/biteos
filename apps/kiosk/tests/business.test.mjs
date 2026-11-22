import test from "node:test";
import assert from "node:assert/strict";
import { businessCases, discoveryQuestions, discoveryExport } from "../src/businessRegistry.ts";

test("BiteOS registry contains unique cases with safe entry points", () => {
  assert.equal(businessCases.length, 4);
  assert.equal(new Set(businessCases.map((item) => item.id)).size, businessCases.length);
  for (const item of businessCases) {
    assert.ok(item.name && item.sector && item.existing.length && item.unknown.length);
    assert.match(item.url, /^(#kiosk|https:\/\/github\.com\/safal207\/|https:\/\/safal207\.github\.io\/)/);
    assert.ok(!item.url.includes("zenit-alanya"), "private project must not be linked publicly");
  }
});

test("Discovery export keeps only the selected case and provided answers", () => {
  const result = discoveryExport("miora", { need: " Семейное меню ", customer: "", economics: " " });
  assert.equal(result.schema, "biteos.discovery.v1");
  assert.equal(result.source, "owner-input-unverified");
  assert.deepEqual(result.answers, { need: "Семейное меню" });
  assert.equal(discoveryQuestions.length, 6);
  assert.throws(() => discoveryExport("unknown", {}), /Неизвестный бизнес/);
});
