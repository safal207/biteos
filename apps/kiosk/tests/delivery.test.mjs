import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDeliveryAction,
  checkoutOffers,
  comboOffer,
  deliveryQuote,
  dishAvailable,
  dishPrice,
  initialDeliveryState,
  migrateDeliveryState,
} from "../src/delivery.ts";
import { recommendRobys } from "../src/robysChoice.ts";

const restaurant = (state, id = "bite-burger") =>
  state.restaurants.find((r) => r.id === id);
const at = "2026-09-22T12:00:00.000Z";
const place = (state, patch = {}) =>
  applyDeliveryAction(
    state,
    {
      type: "order.place",
      restaurantId: "bite-burger",
      id: "order-1",
      items: [{ productId: "combo-smash", quantity: 1 }],
      address: "Москва, Лесная 10, кв. 8",
      note: "Позвонить у подъезда",
      ...patch,
    },
    at,
  );

test("buyer order keeps a price snapshot through restaurant and courier handoff", () => {
  let state = initialDeliveryState();
  const burger = restaurant(state);
  assert.equal(state.restaurants.length, 4);
  assert.equal(
    dishPrice(
      burger,
      burger.dishes.find((d) => d.id === "combo-smash"),
    ),
    55700,
  );
  assert.deepEqual(
    deliveryQuote(burger, [{ productId: "combo-smash", quantity: 1 }]),
    {
      lines: [{ name: "Двойной смэш комбо", quantity: 1, unitPrice: 55700 }],
      subtotal: 55700,
      deliveryFee: 9900,
      total: 65600,
      missing: 0,
    },
  );

  state = place(state);
  assert.equal(state.orders[0].status, "new");
  assert.equal(state.orders[0].restaurantName, "Bite Burger");
  assert.equal(state.orders[0].currency, "RUB");
  assert.equal(state.orders[0].pickup, burger.address);
  assert.equal(state.orders[0].total, 65600);
  assert.equal(state.orders[0].number, 1);
  assert.deepEqual(state.orders[0].history, [{ status: "new", at }]);

  const next = (action) => {
    state = applyDeliveryAction(state, { orderId: "order-1", ...action }, at);
  };
  next({ type: "order.prepare", restaurantId: "bite-burger" });
  next({ type: "order.ready", restaurantId: "bite-burger" });
  next({ type: "order.claim", courierId: "courier-1" });
  next({ type: "order.pickup", courierId: "courier-1" });
  next({ type: "order.deliver", courierId: "courier-1" });
  assert.deepEqual(
    state.orders[0].history.map((event) => event.status),
    ["new", "preparing", "ready", "assigned", "picked-up", "delivered"],
  );
  assert.equal(state.orders[0].courierId, "courier-1");
  assert.equal(state.orders[0].total, 65600);
  assert.equal(state.orders[0].lines[0].unitPrice, 55700);
  assert.throws(
    () => next({ type: "order.deliver", courierId: "courier-1" }),
    /Нельзя пропустить этап/,
  );
});

test("Roby's confirmed menu keeps original TRY prices and set total", () => {
  const state = initialDeliveryState();
  const roby = restaurant(state, "robys-coffee-house");
  assert.equal(roby.currency, "TRY");
  assert.equal(roby.cuisine, "cafe");
  assert.equal(roby.dishes.length, 12);
  assert.equal(
    roby.dishes.find((dish) => dish.id === "desserts--macaron").price,
    3000,
  );
  assert.equal(
    roby.dishes.find((dish) => dish.id === "food--sesame-simit").price,
    3500,
  );
  assert.equal(
    roby.dishes.find((dish) => dish.id === "refreshers--cool-lime").price,
    19000,
  );
  const set = roby.dishes.find(
    (dish) => dish.id === "combo-iced-san-sebastian",
  );
  assert.equal(dishPrice(roby, set), 37000);
  assert.equal(set.discount, undefined);
  assert.equal(
    comboOffer(roby, [
      { productId: "cold-coffee--iced-caffe-latte", quantity: 1 },
    ]),
    null,
  );
  assert.equal(
    roby.dishes.some((dish) => dish.id === "combo-cool-lime-macaron"),
    false,
  );
  const ordered = place(state, {
    restaurantId: roby.id,
    items: [{ productId: set.id, quantity: 1 }],
  });
  assert.equal(ordered.orders[0].currency, "TRY");
  assert.equal(ordered.orders[0].subtotal, 37000);
  assert.equal(ordered.orders[0].total, 37000);
});

test("Roby's Smart Choice respects answers, stock, source status and budget", () => {
  const roby = restaurant(initialDeliveryState(), "robys-coffee-house");
  const answers = {
    intent: "coffee",
    temperature: "cold",
    taste: "any",
    partySize: "one",
    budget: 40000,
  };
  let result = recommendRobys(roby, answers);
  assert.equal(result.best?.dish.id, "combo-iced-san-sebastian");
  assert.equal(result.best?.quantity, 1);
  assert.equal(result.best?.price, 37000);
  assert.equal(result.economy?.dish.id, "cold-coffee--iced-caffe-latte");
  assert.equal(result.economy?.price, 18000);
  assert.equal(result.premium, null);
  result = recommendRobys(roby, { ...answers, budget: 20000 });
  assert.equal(result.best?.dish.id, "cold-coffee--iced-caffe-latte");
  assert.equal(result.best?.price, 18000);
  assert.equal(result.economy, null);
  assert.equal(result.premium, null);
  const unavailable = structuredClone(roby);
  unavailable.dishes.find(
    (dish) => dish.id === "desserts--san-sebastian-cheesecake",
  ).available = false;
  assert.equal(
    recommendRobys(unavailable, answers).best?.dish.id,
    "cold-coffee--iced-caffe-latte",
  );
  const unconfirmed = structuredClone(roby);
  unconfirmed.dishes.find(
    (dish) => dish.id === "combo-iced-san-sebastian",
  ).choice.sourceStatus = "provisional";
  assert.equal(
    recommendRobys(unconfirmed, answers).best?.dish.id,
    "cold-coffee--iced-caffe-latte",
  );
  assert.deepEqual(recommendRobys(roby, { ...answers, budget: 1000 }), {
    best: null,
    economy: null,
    premium: null,
  });
});

test("Smart Choice prices multiple single-item portions within the whole group budget", () => {
  const roby = restaurant(initialDeliveryState(), "robys-coffee-house");
  const two = recommendRobys(roby, {
    intent: "coffee",
    temperature: "hot",
    taste: "any",
    partySize: "two",
    budget: 40000,
  });
  assert.ok(two.best);
  assert.equal(two.best.quantity, 2);
  assert.equal(two.best.price, two.best.unitPrice * 2);
  assert.ok(two.best.price <= 40000);
  assert.match(two.best.reason, /2 порции/);

  const twoSets = recommendRobys(roby, {
    intent: "coffee",
    temperature: "cold",
    taste: "any",
    partySize: "two",
    budget: 80000,
  });
  assert.equal(twoSets.best?.dish.id, "combo-iced-san-sebastian");
  assert.equal(twoSets.best?.quantity, 2);
  assert.equal(twoSets.best?.price, 74000);
  assert.match(twoSets.best?.reason, /2 сета/);
  const twoOnBudget = recommendRobys(roby, {
    intent: "coffee",
    temperature: "cold",
    taste: "any",
    partySize: "two",
    budget: 40000,
  });
  assert.equal(twoOnBudget.best?.dish.id, "cold-coffee--iced-caffe-latte");
  assert.equal(twoOnBudget.best?.quantity, 2);
  assert.equal(twoOnBudget.best?.price, 36000);

  const familyAnswers = {
    intent: "refresh",
    temperature: "cold",
    taste: "sweet",
    partySize: "family",
    budget: 60000,
  };
  const family = recommendRobys(roby, familyAnswers);
  assert.equal(family.best?.dish.id, "refreshers--cool-lime");
  assert.equal(family.best?.quantity, 3);
  assert.equal(family.best?.unitPrice, 19000);
  assert.equal(family.best?.price, 57000);
  assert.deepEqual(recommendRobys(roby, { ...familyAnswers, budget: 50000 }), {
    best: null,
    economy: null,
    premium: null,
  });
});

test("existing session data gains currencies and Roby's without losing orders", () => {
  const current = place(initialDeliveryState());
  const legacy = structuredClone(current);
  legacy.restaurants = legacy.restaurants.filter(
    (entry) => entry.id !== "robys-coffee-house",
  );
  for (const entry of legacy.restaurants) delete entry.currency;
  for (const order of legacy.orders) delete order.currency;
  const migrated = migrateDeliveryState(legacy);
  assert.equal(migrated.restaurants.length, 4);
  assert.equal(
    migrated.restaurants.find((entry) => entry.id === "bite-burger").currency,
    "RUB",
  );
  assert.equal(
    migrated.restaurants.find((entry) => entry.id === "robys-coffee-house")
      .currency,
    "TRY",
  );
  assert.equal(migrated.orders[0].currency, "RUB");
  assert.equal(migrated.orders[0].id, "order-1");
  assert.equal(migrateDeliveryState(migrated).restaurants.length, 4);
});

test("restaurants keep independent menus, stock, and orders", () => {
  let state = initialDeliveryState();
  const input = {
    name: "Новый ресторан",
    description: "Горячий обед",
    cuisine: "other",
    address: "Москва, Садовая 15",
    deliveryFee: 6900,
    minimum: 15000,
    eta: 35,
  };
  state = applyDeliveryAction(state, {
    type: "restaurant.add",
    id: "new-place",
    input,
  });
  state = applyDeliveryAction(state, {
    type: "dish.add",
    restaurantId: "new-place",
    id: "smash",
    input: {
      name: "Свой смэш",
      description: "Своя рецептура",
      price: 19900,
      image: 0,
    },
  });
  assert.equal(restaurant(state, "new-place").dishes.length, 1);
  assert.equal(
    deliveryQuote(restaurant(state, "new-place"), [
      { productId: "smash", quantity: 1 },
    ]).total,
    26800,
  );
  assert.equal(
    deliveryQuote(restaurant(state), [{ productId: "smash", quantity: 1 }])
      .total,
    44800,
  );

  state = place(state, {
    id: "order-new",
    restaurantId: "new-place",
    items: [{ productId: "smash", quantity: 1 }],
  });
  const saved = structuredClone(state.orders[0]);
  assert.equal(saved.restaurantId, "new-place");
  assert.equal(saved.lines[0].unitPrice, 19900);
  assert.throws(
    () =>
      applyDeliveryAction(state, {
        type: "order.prepare",
        restaurantId: "bite-burger",
        orderId: "order-new",
      }),
    /другого ресторана/,
  );

  state = structuredClone(state);
  restaurant(state, "new-place").dishes[0].price = 24900;
  assert.equal(
    deliveryQuote(restaurant(state, "new-place"), [
      { productId: "smash", quantity: 1 },
    ]).subtotal,
    24900,
  );
  assert.deepEqual(state.orders[0], saved);

  state = applyDeliveryAction(state, {
    type: "dish.toggle",
    restaurantId: "new-place",
    productId: "smash",
  });
  assert.throws(
    () =>
      deliveryQuote(restaurant(state, "new-place"), [
        { productId: "smash", quantity: 1 },
      ]),
    /недоступно/,
  );
  assert.equal(
    deliveryQuote(restaurant(state), [{ productId: "smash", quantity: 1 }])
      .subtotal,
    34900,
  );
  assert.deepEqual(state.orders[0], saved);
  state = applyDeliveryAction(state, {
    type: "restaurant.toggle",
    restaurantId: "new-place",
  });
  assert.throws(
    () =>
      deliveryQuote(restaurant(state, "new-place"), [
        { productId: "smash", quantity: 1 },
      ]),
    /не принимает/,
  );
  assert.equal(restaurant(state).open, true);
});

test("combo availability follows stock and the upgrade uses the current price", () => {
  let state = initialDeliveryState();
  let burger = restaurant(state);
  const offer = comboOffer(burger, [{ productId: "smash", quantity: 1 }]);
  assert.equal(offer?.combo.id, "combo-smash");
  assert.equal(offer?.extra, 20800);
  assert.equal(
    comboOffer(burger, [
      { productId: "smash", quantity: 1 },
      { productId: "cola", quantity: 1 },
    ]),
    null,
  );
  state = applyDeliveryAction(state, {
    type: "dish.toggle",
    restaurantId: "bite-burger",
    productId: "fries",
  });
  burger = restaurant(state);
  const combo = burger.dishes.find((d) => d.id === "combo-smash");
  assert.equal(dishAvailable(burger, combo), false);
  assert.equal(comboOffer(burger, [{ productId: "smash", quantity: 1 }]), null);
  assert.throws(
    () => deliveryQuote(burger, [{ productId: "combo-smash", quantity: 1 }]),
    /недоступно/,
  );
  state = applyDeliveryAction(state, {
    type: "dish.toggle",
    restaurantId: "bite-burger",
    productId: "fries",
  });
  assert.equal(
    deliveryQuote(restaurant(state), [
      { productId: "combo-smash", quantity: 1 },
    ]).subtotal,
    55700,
  );
});

test("one courier cannot take another courier's order or skip delivery stages", () => {
  let state = place(initialDeliveryState());
  assert.throws(
    () =>
      applyDeliveryAction(state, {
        type: "order.claim",
        orderId: "order-1",
        courierId: "courier-1",
      }),
    /не готов/,
  );
  state = applyDeliveryAction(state, {
    type: "order.prepare",
    orderId: "order-1",
    restaurantId: "bite-burger",
  });
  state = applyDeliveryAction(state, {
    type: "order.ready",
    orderId: "order-1",
    restaurantId: "bite-burger",
  });
  state = applyDeliveryAction(state, {
    type: "order.claim",
    orderId: "order-1",
    courierId: "courier-1",
  });
  assert.throws(
    () =>
      applyDeliveryAction(state, {
        type: "order.claim",
        orderId: "order-1",
        courierId: "courier-2",
      }),
    /уже взят/,
  );
  assert.throws(
    () =>
      applyDeliveryAction(state, {
        type: "order.pickup",
        orderId: "order-1",
        courierId: "courier-2",
      }),
    /другого курьера/,
  );
  assert.throws(
    () =>
      applyDeliveryAction(state, {
        type: "order.deliver",
        orderId: "order-1",
        courierId: "courier-1",
      }),
    /Нельзя пропустить этап/,
  );
  assert.equal(state.orders[0].status, "assigned");
  assert.equal(state.orders[0].history.length, 4);
});

test("buyer can cancel before preparation and cannot replay an order id", () => {
  const first = place(initialDeliveryState());
  assert.throws(() => place(first), /уже оформлен/);
  const cancelled = applyDeliveryAction(first, {
    type: "order.cancel",
    orderId: "order-1",
  });
  assert.equal(cancelled.orders[0].status, "cancelled");
  assert.equal(first.orders[0].status, "new");
  assert.throws(
    () =>
      applyDeliveryAction(cancelled, {
        type: "order.prepare",
        restaurantId: "bite-burger",
        orderId: "order-1",
      }),
    /Статус уже изменился/,
  );
  const cooking = applyDeliveryAction(first, {
    type: "order.prepare",
    restaurantId: "bite-burger",
    orderId: "order-1",
  });
  assert.throws(
    () =>
      applyDeliveryAction(cooking, {
        type: "order.cancel",
        orderId: "order-1",
      }),
    /до начала приготовления/,
  );
});

test("invalid quantities, minima, totals and form fields are rejected", () => {
  const state = initialDeliveryState();
  const burger = restaurant(state);
  for (const items of [
    [],
    [{ productId: "unknown", quantity: 1 }],
    [{ productId: "smash", quantity: 0 }],
    [{ productId: "smash", quantity: 21 }],
    [{ productId: "smash", quantity: 1.5 }],
    [
      { productId: "smash", quantity: 1 },
      { productId: "smash", quantity: 1 },
    ],
    [
      { productId: "smash", quantity: 20 },
      { productId: "fries", quantity: 20 },
      { productId: "cola", quantity: 11 },
    ],
  ])
    assert.throws(() => deliveryQuote(burger, items));
  assert.equal(
    deliveryQuote(burger, [{ productId: "fries", quantity: 1 }]).missing,
    10100,
  );
  assert.throws(
    () => place(state, { items: [{ productId: "fries", quantity: 1 }] }),
    /минимальная/,
  );
  assert.throws(() => place(state, { address: "   " }), /Укажите улицу/);
  assert.throws(() => place(state, { note: "x".repeat(301) }), /Комментарий/);

  const input = {
    name: "Кафе",
    description: "",
    cuisine: "other",
    address: "Москва, дом 1",
    deliveryFee: 10000,
    minimum: 10000,
    eta: 30,
  };
  for (const patch of [
    { name: "x" },
    { cuisine: "toys" },
    { deliveryFee: -1 },
    { minimum: 1.5 },
    { eta: 9 },
    { address: "x" },
  ]) {
    assert.throws(() =>
      applyDeliveryAction(state, {
        type: "restaurant.add",
        id: "bad",
        input: { ...input, ...patch },
      }),
    );
  }
  for (const price of [0, 99, 10000001, NaN]) {
    assert.throws(() =>
      applyDeliveryAction(state, {
        type: "dish.add",
        restaurantId: "bite-burger",
        id: "new-dish",
        input: { name: "Новое блюдо", description: "", price, image: 0 },
      }),
    );
  }
});

test("checkout offers use current menu prices, stock and one cheaper fallback", () => {
  let state = initialDeliveryState();
  const burger = restaurant(state);
  const items = [{ productId: "smash", quantity: 1 }];
  assert.deepEqual(
    checkoutOffers(burger, items).map(({ dish, price }) => [dish.id, price]),
    [["fries", 14900], ["cola", 12900]],
  );
  assert.equal(checkoutOffers(burger, items)[0].rule.id, "offer-smash-fries");
  assert.deepEqual(
    checkoutOffers(burger, [...items, { productId: "fries", quantity: 1 }])
      .map(({ dish }) => dish.id),
    ["cola"],
  );
  assert.deepEqual(
    checkoutOffers(burger, [{ productId: "combo-smash", quantity: 1 }]),
    [],
  );
  assert.deepEqual(
    checkoutOffers(burger, [...items, { productId: "combo-smash", quantity: 1 }]),
    [],
  );
  assert.deepEqual(
    checkoutOffers(burger, [{ productId: "smash", quantity: 50 }]),
    [],
  );
  state = applyDeliveryAction(state, {
    type: "dish.toggle", restaurantId: burger.id, productId: "fries",
  });
  assert.deepEqual(
    checkoutOffers(restaurant(state), items).map(({ dish }) => dish.id),
    ["cola"],
  );
  state = structuredClone(state);
  restaurant(state).dishes.find((dish) => dish.id === "cola").price = 9900;
  assert.equal(checkoutOffers(restaurant(state), items)[0].price, 9900);
  state = applyDeliveryAction(initialDeliveryState(), {
    type: "offer.add", restaurantId: "bite-burger", id: "offer-chicken-fries",
    triggerId: "chicken", addOnId: "fries",
  });
  assert.deepEqual(
    checkoutOffers(restaurant(state), [
      { productId: "smash", quantity: 1 },
      { productId: "chicken", quantity: 1 },
    ]).map(({ dish }) => dish.id),
    ["fries", "cola"],
  );
});

test("Roby's checkout suggestions are confirmed additions at TRY menu prices", () => {
  const state = initialDeliveryState();
  const roby = restaurant(state, "robys-coffee-house");
  const items = [{ productId: "cold-coffee--iced-caffe-latte", quantity: 1 }];
  assert.equal(roby.currency, "TRY");
  assert.deepEqual(
    checkoutOffers(roby, items).map(({ dish, price }) => [dish.id, price]),
    [
      ["desserts--san-sebastian-cheesecake", 19000],
      ["desserts--macaron", 3000],
    ],
  );
  const provisional = structuredClone(roby);
  provisional.dishes.find((dish) => dish.id === "desserts--san-sebastian-cheesecake")
    .choice.sourceStatus = "provisional";
  assert.deepEqual(
    checkoutOffers(provisional, items).map(({ dish }) => dish.id),
    ["desserts--macaron"],
  );
  const outOfStock = structuredClone(roby);
  outOfStock.dishes.find((dish) => dish.id === "desserts--macaron").available = false;
  assert.deepEqual(
    checkoutOffers(outOfStock, items).map(({ dish }) => dish.id),
    ["desserts--san-sebastian-cheesecake"],
  );
});

test("merchant rules require distinct available items from the same restaurant", () => {
  let state = initialDeliveryState();
  const add = (patch = {}) => applyDeliveryAction(state, {
    type: "offer.add",
    restaurantId: "robys-coffee-house",
    id: "offer-latte-lotus",
    triggerId: "cold-coffee--iced-caffe-latte",
    addOnId: "desserts--lotus-cheesecake",
    ...patch,
  });
  assert.throws(() => add({ addOnId: "smash" }), /этого ресторана/);
  assert.throws(() => add({ addOnId: "cold-coffee--iced-caffe-latte" }), /разных/);
  assert.throws(() => add({ addOnId: "combo-iced-san-sebastian" }), /не комбо/);
  const unavailable = structuredClone(state);
  restaurant(unavailable, "robys-coffee-house").dishes
    .find((dish) => dish.id === "desserts--lotus-cheesecake").available = false;
  assert.throws(() => applyDeliveryAction(unavailable, {
    type: "offer.add", restaurantId: "robys-coffee-house", id: "new",
    triggerId: "cold-coffee--iced-caffe-latte", addOnId: "desserts--lotus-cheesecake",
  }), /доступные/);
  const provisional = structuredClone(state);
  restaurant(provisional, "robys-coffee-house").dishes
    .find((dish) => dish.id === "desserts--lotus-cheesecake")
    .choice.sourceStatus = "provisional";
  assert.throws(() => applyDeliveryAction(provisional, {
    type: "offer.add", restaurantId: "robys-coffee-house", id: "new",
    triggerId: "cold-coffee--iced-caffe-latte", addOnId: "desserts--lotus-cheesecake",
  }), /подтверждённые/);
  state = add();
  assert.equal(restaurant(state, "robys-coffee-house").offerRules.length, 3);
  assert.throws(() => add({ id: "another-id" }), /пара уже есть/);
  state = applyDeliveryAction(state, {
    type: "offer.toggle", restaurantId: "robys-coffee-house", ruleId: "offer-latte-lotus",
  });
  assert.equal(restaurant(state, "robys-coffee-house").offerRules.at(-1).active, false);
  state = applyDeliveryAction(state, {
    type: "offer.remove", restaurantId: "robys-coffee-house", ruleId: "offer-latte-lotus",
  });
  assert.equal(restaurant(state, "robys-coffee-house").offerRules.length, 2);
});

test("offer analytics record one shown and one decision per attempt", () => {
  let state = initialDeliveryState();
  const shown = {
    id: "shown-1", restaurantId: "bite-burger", ruleId: "offer-smash-fries",
    type: "shown", attemptId: "attempt-1", at: 1000,
  };
  assert.throws(() => applyDeliveryAction(state, {
    type: "offer.record", event: { ...shown, id: "accepted-early", type: "accepted" },
  }), /Сначала покажите/);
  state = applyDeliveryAction(state, { type: "offer.record", event: shown });
  assert.throws(() => applyDeliveryAction(state, {
    type: "offer.record", event: { ...shown, id: "shown-2" },
  }), /уже показано/);
  state = applyDeliveryAction(state, {
    type: "offer.record", event: { ...shown, id: "declined-1", type: "declined", at: 1001 },
  });
  assert.throws(() => applyDeliveryAction(state, {
    type: "offer.record", event: { ...shown, id: "accepted-late", type: "accepted", at: 1002 },
  }), /Сначала покажите/);
  state = applyDeliveryAction(state, {
    type: "offer.record", event: {
      ...shown, id: "shown-cheaper", ruleId: "offer-smash-cola", at: 1002,
    },
  });
  state = applyDeliveryAction(state, {
    type: "offer.record", event: {
      ...shown, id: "accepted-cheaper", ruleId: "offer-smash-cola",
      type: "accepted", at: 1003,
    },
  });
  assert.deepEqual(state.offerEvents.map((event) => event.type),
    ["accepted", "shown", "declined", "shown"]);
});

test("old delivery sessions gain offer rules and events without losing orders", () => {
  const old = structuredClone(place(initialDeliveryState()));
  delete old.offerEvents;
  for (const entry of old.restaurants) delete entry.offerRules;
  const migrated = migrateDeliveryState(old);
  assert.equal(migrated.orders[0].id, "order-1");
  assert.equal(migrated.offerEvents.length, 0);
  assert.equal(restaurant(migrated).offerRules.length, 2);
  assert.equal(restaurant(migrated, "robys-coffee-house").offerRules.length, 2);
  const removed = applyDeliveryAction(migrated, {
    type: "offer.remove", restaurantId: "bite-burger", ruleId: "offer-smash-fries",
  });
  assert.equal(restaurant(migrateDeliveryState(removed)).offerRules.length, 1);
});
