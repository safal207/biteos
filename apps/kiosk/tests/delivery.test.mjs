import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDeliveryAction,
  comboOffer,
  deliveryQuote,
  dishAvailable,
  dishPrice,
  initialDeliveryState,
} from "../src/delivery.ts";

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
  assert.equal(state.restaurants.length, 3);
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
