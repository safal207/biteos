import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../../../services/api/catalog.json" with { type: "json" };
import { createDemoApi } from "../src/demo.ts";
import { applyDeliveryAction, initialDeliveryState } from "../src/delivery.ts";
import {
  applyKioskOffer,
  cheaperKioskFallback,
  filterNativeKioskGateOffers,
  kioskGateCandidates,
  kioskOfferCost,
  readConfiguredKioskOffers,
  readKioskOfferEvents,
  recordKioskOfferEvent,
} from "../src/kioskOfferFlow.ts";

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

test("pre-checkout combo quotes every portion and fallback is cheaper", () => {
  const api = createDemoApi(catalog);
  const input = basket({ quantity: 2 });
  const current = api("quote", input);
  const offers = api("recommendations", input).offers;
  const gate = kioskGateCandidates(
    catalog,
    input.items,
    readConfiguredKioskOffers(catalog, input.items),
    offers,
  );
  assert.equal(gate[0].kind, "combo");
  assert.equal(gate[1].productId, "fries");
  assert.ok(gate[1].price < kioskOfferCost(input.items, gate[0]));
  const combo = offers[0];
  const upgraded = applyKioskOffer(input.items, combo);
  assert.equal(combo.kind, "combo");
  assert.equal(kioskOfferCost(input.items, combo), 41600);
  assert.equal(upgraded[0].quantity, 2);
  assert.equal(upgraded[0].combo, true);
  const comboQuote = api("quote", { ...input, items: upgraded });
  assert.equal(comboQuote.total - current.total, 41600);
  const priced = offers.map((offer) => {
    const items = applyKioskOffer(input.items, offer);
    const quote = api("quote", { ...input, items });
    return { offer, delta: quote.total - current.total };
  });
  const fallback = cheaperKioskFallback(priced);
  assert.ok(fallback);
  assert.equal(fallback.offer.kind, "add");
  assert.ok(fallback.delta < priced[0].delta);
  assert.equal(cheaperKioskFallback(priced.slice(0, 1)), null);
});

test("Bite Burger manager rules control gate and inline kiosk candidates", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const items = basket().items;
  const native = createDemoApi(catalog)("recommendations", basket()).offers;
  let state = initialDeliveryState();
  const save = () =>
    storage.setItem("biteos-delivery-v1", JSON.stringify(state));
  assert.deepEqual(
    readConfiguredKioskOffers(catalog, items, storage).map(
      (offer) => offer.productId,
    ),
    ["fries", "cola"],
  );
  assert.deepEqual(
    kioskGateCandidates(
      catalog,
      items,
      readConfiguredKioskOffers(catalog, items, storage),
      native,
      storage,
    ).map((offer) => (offer.kind === "combo" ? "combo" : offer.productId)),
    ["combo", "fries"],
  );

  const removedComponent = applyDeliveryAction(state, {
    type: "offer.remove",
    restaurantId: "bite-burger",
    ruleId: "offer-smash-fries",
  });
  storage.setItem("biteos-delivery-v1", JSON.stringify(removedComponent));
  assert.equal(
    kioskGateCandidates(
      catalog,
      items,
      readConfiguredKioskOffers(catalog, items, storage),
      native,
      storage,
    )[0].productId,
    "cola",
  );
  assert.deepEqual(
    kioskGateCandidates(
      catalog,
      items,
      readConfiguredKioskOffers(catalog, items, storage),
      native,
      storage,
    ).map((offer) => offer.productId),
    ["cola"],
  );

  state = applyDeliveryAction(state, {
    type: "offer.toggle",
    restaurantId: "bite-burger",
    ruleId: "offer-smash-fries",
  });
  save();
  assert.equal(
    readConfiguredKioskOffers(catalog, items, storage)[0].productId,
    "cola",
  );
  assert.equal(
    kioskGateCandidates(
      catalog,
      items,
      readConfiguredKioskOffers(catalog, items, storage),
      native,
      storage,
    )[0].productId,
    "cola",
  );

  state = applyDeliveryAction(state, {
    type: "offer.add",
    restaurantId: "bite-burger",
    id: "offer-smash-nuggets",
    triggerId: "smash",
    addOnId: "nuggets",
  });
  save();
  assert.equal(
    readConfiguredKioskOffers(catalog, items, storage)[0].productId,
    "nuggets",
  );

  state = applyDeliveryAction(state, {
    type: "offer.toggle",
    restaurantId: "bite-burger",
    ruleId: "offer-smash-cola",
  });
  state = applyDeliveryAction(state, {
    type: "offer.remove",
    restaurantId: "bite-burger",
    ruleId: "offer-smash-nuggets",
  });
  state = applyDeliveryAction(state, {
    type: "offer.remove",
    restaurantId: "bite-burger",
    ruleId: "offer-smash-fries",
  });
  save();
  assert.deepEqual(readConfiguredKioskOffers(catalog, items, storage), []);
  assert.deepEqual(
    kioskGateCandidates(catalog, items, [], native, storage),
    [],
  );
  assert.deepEqual(filterNativeKioskGateOffers(native, items, storage), []);
});

test("kiosk ignores foreign product IDs and saved prices", () => {
  const state = initialDeliveryState();
  const burger = state.restaurants.find(
    (restaurant) => restaurant.id === "bite-burger",
  );
  burger.dishes.find((dish) => dish.id === "fries").price = 1;
  burger.offerRules[0].price = 1;
  burger.dishes.push({ id: "foreign-item", available: true, price: 1 });
  burger.offerRules.unshift({
    id: "foreign-rule",
    triggerId: "smash",
    addOnId: "foreign-item",
    active: true,
    price: 1,
  });
  const storage = {
    getItem: (key) =>
      key === "biteos-delivery-v1" ? JSON.stringify(state) : null,
    setItem: () => {},
  };
  const candidates = readConfiguredKioskOffers(
    catalog,
    basket().items,
    storage,
  );
  assert.equal(candidates[0].productId, "fries");
  assert.equal(
    candidates[0].price,
    catalog.products.find((p) => p.id === "fries").price,
  );
  assert.equal(
    candidates.some((offer) => offer.productId === "foreign-item"),
    false,
  );
});

test("kiosk offer events stay local, bounded, and ignore invalid data", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  for (let index = 0; index < 205; index++)
    recordKioskOfferEvent(
      {
        type: "shown",
        offerKey: "combo:smash:0",
        attemptId: `attempt-${index.toString().padStart(4, "0")}`,
        at: Date.now(),
      },
      storage,
    );
  assert.equal(readKioskOfferEvents(storage).length, 200);
  recordKioskOfferEvent(
    {
      type: "accepted",
      offerKey: "bad\nkey",
      attemptId: "attempt-9999",
      at: Date.now(),
    },
    storage,
  );
  assert.equal(readKioskOfferEvents(storage).length, 200);
  values.set("biteos.kiosk.offer-events.v1", "not json");
  assert.deepEqual(readKioskOfferEvents(storage), []);
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
