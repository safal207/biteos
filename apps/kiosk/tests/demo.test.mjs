import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../../../services/api/catalog.json" with { type: "json" };
import { createDemoApi } from "../src/demo.ts";

const basket = (patch = {}) => ({
  mode: "dine-in",
  items: [
    { productId: "smash", quantity: 1, optionIds: [], combo: false, ...patch },
  ],
});

test("combo price includes modifiers and discounts every portion", () => {
  const api = createDemoApi(catalog);
  assert.deepEqual(
    api("quote", basket({ combo: true, quantity: 2, optionIds: ["cheese"] })),
    { subtotal: 133200, discount: 14000, total: 119200, count: 2 },
  );
  for (const [productId, total] of [
    ["smash", 55700],
    ["chicken", 49700],
    ["bbq", 59700],
  ]) {
    assert.equal(api("quote", basket({ productId, combo: true })).total, total);
  }
});

test("combo upgrade is first and never repeats included components", () => {
  const api = createDemoApi(catalog);
  const offers = api("recommendations", basket()).offers;
  assert.equal(offers.length, 2);
  assert.equal(offers[0].kind, "combo");
  assert.equal(offers[0].price, 20800);
  assert.equal(offers[0].itemIndex, 0);
  assert.deepEqual(api("recommendations", basket({ combo: true })).offers, []);
  const withDrink = basket();
  withDrink.items.push({
    productId: "cola",
    quantity: 1,
    optionIds: [],
    combo: false,
  });
  assert.ok(
    api("recommendations", withDrink).offers.every(
      (o) => o.kind !== "combo" && o.productId !== "cola",
    ),
  );
});

test("unavailable components block purchase and combo offers", () => {
  const changed = structuredClone(catalog);
  changed.products.find((p) => p.id === "fries").available = false;
  const api = createDemoApi(changed);
  assert.throws(
    () => api("quote", basket({ combo: true })),
    /Комбо недоступно/,
  );
  assert.ok(
    api("recommendations", basket()).offers.every(
      (o) => o.kind !== "combo" && o.productId !== "fries",
    ),
  );
});

test("invalid quantities, products, and modifiers are rejected", () => {
  const api = createDemoApi(catalog);
  for (const patch of [
    { quantity: 0 },
    { quantity: 21 },
    { quantity: 1.5 },
    { productId: "missing" },
    { optionIds: ["sauce"] },
    { optionIds: ["cheese", "cheese"] },
    { productId: "cola", combo: true },
  ]) {
    assert.throws(() => api("quote", basket(patch)));
  }
  const huge = basket({ quantity: 20 });
  huge.items = Array.from({ length: 3 }, () => ({ ...huge.items[0] }));
  assert.throws(() => api("quote", huge), /50/);
});

test("demo receipts are idempotent within one tab session", () => {
  const api = createDemoApi(catalog);
  const first = api("orders", basket({ combo: true }), "demo-key-001");
  assert.equal(first.number, 1);
  assert.equal(first.status, "demo");
  assert.deepEqual(
    api("orders", basket({ combo: true }), "demo-key-001"),
    first,
  );
  assert.throws(
    () => api("orders", basket(), "demo-key-001"),
    /другого заказа/,
  );
  assert.equal(api("orders", basket(), "demo-key-002").number, 2);
  assert.throws(() =>
    api("orders", { mode: "dine-in", items: [] }, "demo-key-empty"),
  );
  const nextTab = createDemoApi(catalog);
  assert.equal(nextTab("orders", basket(), "demo-key-003").number, 1);
});
