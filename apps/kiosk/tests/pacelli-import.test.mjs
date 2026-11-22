import test from "node:test";
import assert from "node:assert/strict";
import { parsePacelliMenu } from "../src/pacelliMenuImport.ts";
import { selectedPair } from "../src/opportunityHypotheses.ts";
import { catalogSummary } from "../src/catalogIntelligence.ts";

test("Pacelli JSON menu imports exact owner-entered prices, never real-sales claims", () => {
  const catalog = parsePacelliMenu(JSON.stringify({
    businessId: "pacelli",
    currency: "TRY",
    items: [
      { id: "espresso", name: "Кофе", category: "Напитки", price: "150,50" },
      { id: "cake", name: "Десерт", category: "Сладкое", priceMinor: 20000 },
      { id: "unpriced", name: "Спецпозиция", category: "Другое", price: null },
    ],
  }), "pacelli-menu.json");
  assert.equal(catalog.businessId, "pacelli");
  assert.equal(catalog.status, "working-menu-snapshot");
  assert.equal(catalog.items.length, 3);
  assert.equal(catalog.items[0].priceMinor, 15050);
  assert.equal(catalog.items[1].priceMinor, 20000);
  assert.equal(catalog.items[2].priceMinor, null);
  assert.deepEqual({ total: catalogSummary(catalog).total, missing: catalogSummary(catalog).missingPrice, approved: catalogSummary(catalog).ownerApproved }, { total: 3, missing: 1, approved: 0 });
  const pair = selectedPair("pacelli", "espresso", "cake", catalog);
  assert.equal(pair?.fullPriceMinor, 35050);
  assert.equal(selectedPair("pacelli", "espresso", "unpriced", catalog), null);
});

test("CSV imports both semicolon Turkish decimals and quoted commas", () => {
  const catalog = parsePacelliMenu(
    'name;category;price\n"Caffè, piccolo";"Напитки";1.500,25\n"Baklava";"Десерт";\n',
    "source.csv",
  );
  assert.equal(catalog.items[0].name, "Caffè, piccolo");
  assert.equal(catalog.items[0].priceMinor, 150025);
  assert.equal(catalog.items[1].priceMinor, null);
  assert.equal(catalog.items[0].id, "row-1");
  assert.equal(catalog.items[1].id, "row-2");
});

test("CSV imports quoted embedded newlines only when field is not a product name", () => {
  assert.throws(() => parsePacelliMenu(
    'name,category,price\n"Coffee\nHot",Drinks,100\n', "source.csv",
  ), /недопустимый символ/);
  const c = parsePacelliMenu('name,category,price\n"Coffee, filtered",Drinks,120.50', "menu.csv");
  assert.equal(c.items[0].name, "Coffee, filtered");
  assert.equal(c.items[0].priceMinor, 12050);
});

test("JSON and CSV cannot silently import another business", () => {
  assert.throws(() => parsePacelliMenu(
    JSON.stringify({ businessId: "miora", currency: "TRY", items: [{ name: "Coffee", price: 100 }] }),
    "not-pacelli.json",
  ), /другому клиенту/);
  assert.throws(() => parsePacelliMenu(
    "businessId,name,price\nmiora,Coffee,100", "not-pacelli.csv",
  ), /не к Pacelli/);
  assert.equal(selectedPair("miora", "espresso", "cake", parsePacelliMenu(
    JSON.stringify({ businessId: "pacelli", currency: "TRY", items: [
      { id: "espresso", name: "Coffee", price: 100 },
      { id: "cake", name: "Cake", price: 120 },
    ] }), "pacelli.json",
  )), null);
});

test("Reject duplicate product identifiers, invalid prices, zero and negative values", () => {
  const payload = (items) => JSON.stringify({ businessId: "pacelli", currency: "TRY", items });
  const item = (id, price) => ({ id, name: "Coffee", category: "Coffee", price });
  assert.throws(() => parsePacelliMenu(payload([item("same", 100), item("same", 120)]), "x.json"), /Повторяющиеся ID/);
  assert.throws(() => parsePacelliMenu(payload([item("foo", 0)]), "x.json"), /Цена должна/);
  assert.throws(() => parsePacelliMenu(payload([item("foo", -5)]), "x.json"), /Цена должна/);
  assert.throws(() => parsePacelliMenu(payload([item("foo", "150,123")]), "x.json"), /формат цены/);
  assert.throws(() => parsePacelliMenu(payload([item("foo", "1e4")]), "x.json"), /формат цены/);
  assert.throws(() => parsePacelliMenu(payload([item("foo", "Infinity")]), "x.json"), /формат цены/);
});

test("Reject missing file content, unsupported currency, malformed CSV and empty menus", () => {
  assert.throws(() => parsePacelliMenu("", "empty.json"), /пустой/);
  assert.throws(() => parsePacelliMenu("not-json", "source.json"), /синтаксическая/);
  assert.throws(() => parsePacelliMenu("header", "source.html"), /только локальные файлы/);
  assert.throws(() => parsePacelliMenu('name;category;price\n"Oops;Drink;100\n', "source.csv"), /незакрытые кавычки/);
  assert.throws(() => parsePacelliMenu("name;category;price\nCoffee;Drinks", "source.csv"), /число столбцов/);
  assert.throws(() => parsePacelliMenu('name;price', "source.csv"), /хотя бы одну позицию/);
  assert.throws(() => parsePacelliMenu(JSON.stringify({ businessId: "pacelli", currency: "USD", items: [] }), "source.json"), /TRY или RUB/);
  assert.throws(() => parsePacelliMenu(JSON.stringify({ businessId: "pacelli", currency: "TRY", items: [] }), "source.json"), /от 1 до 1000/);
});
