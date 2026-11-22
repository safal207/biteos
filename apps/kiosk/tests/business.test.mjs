import test from "node:test";
import assert from "node:assert/strict";
import { businessCases, discoveryQuestions, discoveryExport } from "../src/businessRegistry.ts";

test("BiteOS registry contains unique cases with safe entry points", () => {
  assert.equal(businessCases.length, 7);
  assert.equal(new Set(businessCases.map((item) => item.id)).size, businessCases.length);
  for (const item of businessCases) {
    assert.ok(item.name && item.sector && item.existing.length && item.unknown.length);
    if (item.url) assert.match(item.url, /^(#kiosk|https:\/\/github\.com\/safal207\/|https:\/\/safal207\.github\.io\/)/);
    assert.ok(!item.url?.includes("zenit-alanya"), "private project must not be linked publicly");
  }
});

test("Sefa and Riva Bella have distinct public safe demos and unverified data notes", () => {
  const sefa = businessCases.find((item) => item.id === "sefa-beach");
  const riva = businessCases.find((item) => item.id === "riva-bella");
  assert.equal(sefa?.url, "https://safal207.github.io/sefa-beach/");
  assert.equal(riva?.url, "https://safal207.github.io/riva-bella-revenue/");
  assert.match(sefa.summary, /Рабочее QR-меню/);
  assert.match(riva.summary, /вымышленных/);
  assert.ok(!businessCases.some((item) => item.url?.includes("riva-bella-gazipasa-concept")));
  assert.equal(discoveryExport("sefa-beach", { need: "Проверить семейные запросы" }).businessId, "sefa-beach");
  assert.equal(discoveryExport("riva-bella", { goal: "Проверить воронку" }).businessId, "riva-bella");
});

test("Pacelli is a discovery-only client with no invented public URL or menu", () => {
  const client = businessCases.find((item) => item.id === "pacelli");
  assert.equal(client?.connection, "discovery");
  assert.equal(client?.url, undefined);
  assert.equal(client?.linkLabel, undefined);
  assert.match(client?.summary ?? "", /нет подтверждённого исходного меню/);
  assert.equal(discoveryExport("pacelli", { need: "Тестовая потребность" }).businessId, "pacelli");
});

test("Discovery export keeps only the selected case and provided answers", () => {
  const result = discoveryExport("miora", { need: " Семейное меню ", customer: "", economics: " " });
  assert.equal(result.schema, "biteos.discovery.v1");
  assert.equal(result.source, "owner-input-unverified");
  assert.deepEqual(result.answers, { need: "Семейное меню" });
  assert.equal(discoveryQuestions.length, 6);
  assert.throws(() => discoveryExport("unknown", {}), /Неизвестный бизнес/);
});
