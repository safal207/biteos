import catalog from "../../../services/api/catalog.json" with { type: "json" };

export type Cuisine = "burgers" | "chicken" | "grill" | "cafe" | "other";
export const cuisines: Record<Cuisine, string> = {
  burgers: "Бургеры",
  chicken: "Курица",
  grill: "Гриль",
  cafe: "Кофейня",
  other: "Другая кухня",
};
export type Currency = "RUB" | "TRY";
export type ChoiceIntent =
  "coffee" | "breakfast" | "snack" | "dessert" | "refresh";
export type ChoiceTraits = {
  intents: ChoiceIntent[];
  temperature: "hot" | "cold" | "none";
  taste: "sweet" | "neutral" | "savoury";
  partySizes: ("one" | "two" | "family")[];
  sourceStatus: "confirmed" | "provisional";
};
export type Dish = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: number;
  available: boolean;
  components?: string[];
  discount?: number;
  fixedPrice?: number;
  photo?: string;
  section?: string;
  choice?: ChoiceTraits;
};
export type OfferRule = {
  id: string;
  triggerId: string;
  addOnId: string;
  active: boolean;
};
export type OfferEvent = {
  id: string;
  restaurantId: string;
  ruleId: string;
  type: "shown" | "accepted" | "declined";
  attemptId: string;
  at: number;
};
export type Restaurant = {
  id: string;
  name: string;
  description: string;
  cuisine: Cuisine;
  currency: Currency;
  photo?: string;
  address: string;
  deliveryFee: number;
  minimum: number;
  eta: number;
  open: boolean;
  dishes: Dish[];
  offerRules: OfferRule[];
};
export type CartLine = { productId: string; quantity: number };
export type DeliveryStatus =
  | "new"
  | "preparing"
  | "ready"
  | "assigned"
  | "picked-up"
  | "delivered"
  | "cancelled";
export const statusLabels: Record<DeliveryStatus, string> = {
  new: "Ждёт ресторан",
  preparing: "Готовится",
  ready: "Готов к выдаче",
  assigned: "Курьер назначен",
  "picked-up": "Курьер в пути",
  delivered: "Доставлен",
  cancelled: "Отменён",
};
export const stages: DeliveryStatus[] = [
  "new",
  "preparing",
  "ready",
  "assigned",
  "picked-up",
  "delivered",
];
export type DeliveryOrder = {
  id: string;
  number: number;
  restaurantId: string;
  restaurantName: string;
  currency: Currency;
  pickup: string;
  address: string;
  note: string;
  lines: { name: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: DeliveryStatus;
  courierId: string | null;
  createdAt: string;
  history: { status: DeliveryStatus; at: string }[];
};
export type DeliveryState = {
  version: 1;
  restaurants: Restaurant[];
  orders: DeliveryOrder[];
  offerEvents: OfferEvent[];
};
export type LegacyDeliveryState = Omit<
  DeliveryState,
  "restaurants" | "orders" | "offerEvents"
> & {
  restaurants: (Omit<Restaurant, "currency" | "offerRules"> & {
    currency?: Currency;
    offerRules?: OfferRule[];
  })[];
  orders: (Omit<DeliveryOrder, "currency"> & { currency?: Currency })[];
  offerEvents?: OfferEvent[];
};
export type RestaurantInput = Pick<
  Restaurant,
  | "name"
  | "description"
  | "cuisine"
  | "address"
  | "deliveryFee"
  | "minimum"
  | "eta"
> & { currency?: Currency };
export type DeliveryAction =
  | { type: "restaurant.add"; id: string; input: RestaurantInput }
  | { type: "restaurant.toggle"; restaurantId: string }
  | {
      type: "dish.add";
      restaurantId: string;
      id: string;
      input: Pick<Dish, "name" | "description" | "price" | "image">;
    }
  | { type: "dish.toggle"; restaurantId: string; productId: string }
  | {
      type: "offer.add";
      restaurantId: string;
      id: string;
      triggerId: string;
      addOnId: string;
    }
  | { type: "offer.toggle" | "offer.remove"; restaurantId: string; ruleId: string }
  | { type: "offer.record"; event: OfferEvent }
  | {
      type: "order.place";
      restaurantId: string;
      id: string;
      items: CartLine[];
      address: string;
      note: string;
    }
  | {
      type: "order.prepare" | "order.ready";
      restaurantId: string;
      orderId: string;
    }
  | {
      type: "order.claim" | "order.pickup" | "order.deliver";
      courierId: string;
      orderId: string;
    }
  | { type: "order.cancel"; orderId: string };

const robyPhoto = (id: string) => `images/robys/menu-v1/${id}.webp`;
const robyDish = (
  id: string,
  name: string,
  lira: number,
  section: string,
  intents: ChoiceIntent[],
  temperature: ChoiceTraits["temperature"],
  taste: ChoiceTraits["taste"],
  partySizes: ChoiceTraits["partySizes"] = ["one", "two"],
): Dish => ({
  id,
  name,
  description: "",
  price: lira * 100,
  image: 0,
  available: true,
  photo: robyPhoto(id),
  section,
  choice: {
    intents,
    temperature,
    taste,
    partySizes,
    sourceStatus: "confirmed",
  },
});

function defaultOfferRules(restaurantId: string, dishes: Dish[]): OfferRule[] {
  const pairs =
    restaurantId === "robys-coffee-house"
      ? [
          ["cold-coffee--iced-caffe-latte", "desserts--san-sebastian-cheesecake"],
          ["cold-coffee--iced-caffe-latte", "desserts--macaron"],
        ]
      : restaurantId === "bite-burger"
        ? [
            ["smash", "fries"],
            ["smash", "cola"],
          ]
        : [];
  return pairs
    .filter(([triggerId, addOnId]) =>
      dishes.some((dish) => dish.id === triggerId) &&
      dishes.some((dish) => dish.id === addOnId),
    )
    .map(([triggerId, addOnId]) => ({
      id: `offer-${triggerId}-${addOnId}`,
      triggerId,
      addOnId,
      active: true,
    }));
}

export function robyRestaurant(): Restaurant {
  const dishes: Dish[] = [
    robyDish(
      "hot-coffee--flat-white",
      "Флэт уайт",
      170,
      "Горячий кофе",
      ["coffee", "breakfast"],
      "hot",
      "neutral",
    ),
    robyDish(
      "hot-coffee--caffe-latte",
      "Кафе латте",
      180,
      "Горячий кофе",
      ["coffee", "breakfast", "snack"],
      "hot",
      "neutral",
    ),
    robyDish(
      "hot-coffee--caramel-latte",
      "Карамельный латте",
      200,
      "Горячий кофе",
      ["coffee", "breakfast", "dessert"],
      "hot",
      "sweet",
    ),
    robyDish(
      "brew-hot--filter-coffee",
      "Фильтр-кофе",
      160,
      "Горячий кофе",
      ["coffee", "breakfast", "snack"],
      "hot",
      "neutral",
    ),
    robyDish(
      "cold-coffee--iced-caffe-latte",
      "Айс латте",
      180,
      "Холодный кофе",
      ["coffee", "breakfast", "snack", "refresh", "dessert"],
      "cold",
      "neutral",
    ),
    robyDish(
      "refreshers--cool-lime",
      "Cool Lime",
      190,
      "Холодные напитки",
      ["refresh", "snack"],
      "cold",
      "sweet",
      ["one", "two", "family"],
    ),
    robyDish(
      "desserts--san-sebastian-cheesecake",
      "Чизкейк Сан-Себастьян",
      190,
      "Десерты",
      ["dessert", "snack"],
      "none",
      "sweet",
    ),
    robyDish(
      "desserts--lotus-cheesecake",
      "Чизкейк Lotus",
      190,
      "Десерты",
      ["dessert", "snack"],
      "none",
      "sweet",
    ),
    robyDish(
      "desserts--macaron",
      "Макарон",
      30,
      "Десерты",
      ["dessert", "snack"],
      "none",
      "sweet",
      ["one", "two", "family"],
    ),
    robyDish(
      "food--nutella-croissant",
      "Круассан с Nutella",
      170,
      "Выпечка",
      ["breakfast", "snack"],
      "none",
      "sweet",
    ),
    robyDish(
      "food--sesame-simit",
      "Симит с кунжутом",
      35,
      "Выпечка",
      ["breakfast", "snack"],
      "none",
      "savoury",
      ["one", "two", "family"],
    ),
    {
      id: "combo-iced-san-sebastian",
      name: "Айс-латте + чизкейк Сан-Себастьян",
      description:
        "1 айс-латте + 1 чизкейк Сан-Себастьян. Цена равна сумме позиций меню.",
      price: 37000,
      fixedPrice: 37000,
      image: 0,
      available: true,
      components: [
        "cold-coffee--iced-caffe-latte",
        "desserts--san-sebastian-cheesecake",
      ],
      photo: "images/robys/sets-v1/iced-san-sebastian.webp",
      section: "Сеты",
      choice: {
        intents: ["coffee", "dessert", "snack", "refresh"],
        temperature: "cold",
        taste: "sweet",
        partySizes: ["one", "two"],
        sourceStatus: "confirmed",
      },
    },
  ];
  return {
    id: "robys-coffee-house",
    name: "Roby's Coffee House",
    description:
      "Кофе и десерты из меню кафе в Газипаше. Заказ здесь — только демо.",
    cuisine: "cafe",
    currency: "TRY",
    photo: robyPhoto("cold-coffee--iced-caffe-latte"),
    address:
      "Демо: Roby's Coffee House · Pazarcı, Uğur Mumcu Cd., Gazipaşa, Antalya",
    deliveryFee: 0,
    minimum: 0,
    eta: 30,
    open: true,
    dishes,
    offerRules: defaultOfferRules("robys-coffee-house", dishes),
  };
}

export function initialDeliveryState(): DeliveryState {
  const dishes: Dish[] = catalog.products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    image: p.image,
    available: p.available,
  }));
  for (const p of catalog.products.filter((p) => p.category === "burgers")) {
    dishes.push({
      id: `combo-${p.id}`,
      name: `${p.name} комбо`,
      description: "Бургер + фри 120 г + кола 400 мл. Экономия 70 ₽.",
      price: 0,
      image: p.image,
      available: true,
      components: [p.id, catalog.combo.sideId, catalog.combo.drinkId],
      discount: catalog.combo.discount,
    });
  }
  return {
    version: 1,
    orders: [],
    offerEvents: [],
    restaurants: [
      {
        id: "bite-burger",
        name: "Bite Burger",
        description: "Смэш-бургеры, щедрые комбо и тот самый хруст.",
        cuisine: "burgers",
        currency: "RUB",
        address: "Демо: Бургерная улица, 12",
        deliveryFee: 9900,
        minimum: 25000,
        eta: 30,
        open: true,
        dishes,
        offerRules: defaultOfferRules("bite-burger", dishes),
      },
      {
        id: "crispy-club",
        name: "Криспи Клаб",
        description: "Хрустящая курица. Наггетсы. Хороший повод собраться.",
        cuisine: "chicken",
        currency: "RUB",
        address: "Демо: Хрустящий переулок, 7",
        deliveryFee: 7900,
        minimum: 19900,
        eta: 25,
        open: true,
        dishes: structuredClone(
          dishes.filter((d) =>
            ["chicken", "fries", "nuggets", "cola", "combo-chicken"].includes(
              d.id,
            ),
          ),
        ),
        offerRules: [],
      },
      {
        id: "bbq-yard",
        name: "BBQ Двор",
        description: "Бургеры с дымком, беконом и характером.",
        cuisine: "grill",
        currency: "RUB",
        address: "Демо: Гриль-проспект, 5",
        deliveryFee: 11900,
        minimum: 34900,
        eta: 40,
        open: true,
        dishes: structuredClone(
          dishes.filter((d) =>
            ["bbq", "fries", "cola", "combo-bbq"].includes(d.id),
          ),
        ),
        offerRules: [],
      },
      robyRestaurant(),
    ],
  };
}

export function migrateDeliveryState(
  stored: LegacyDeliveryState,
): DeliveryState {
  const restaurants = stored.restaurants.map((restaurant) => ({
    ...restaurant,
    currency: restaurant.currency ?? "RUB",
    offerRules:
      restaurant.offerRules ??
      defaultOfferRules(restaurant.id, restaurant.dishes),
  }));
  if (
    !restaurants.some((restaurant) => restaurant.id === "robys-coffee-house")
  ) {
    restaurants.push(robyRestaurant());
  }
  return {
    version: 1,
    restaurants,
    offerEvents: stored.offerEvents?.slice(0, 1000) ?? [],
    orders: stored.orders.map((order) => ({
      ...order,
      currency:
        order.currency ??
        restaurants.find((restaurant) => restaurant.id === order.restaurantId)
          ?.currency ??
        "RUB",
    })),
  };
}

const text = (value: string, min: number, max: number, error: string) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new Error(error);
  return value.trim();
};
const amount = (value: number, max: number, error: string, min = 0) => {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(error);
  return value;
};
export function dishAvailable(restaurant: Restaurant, dish: Dish): boolean {
  return (
    dish.available &&
    (!dish.components ||
      dish.components.every((id) =>
        restaurant.dishes.some(
          (p) => p.id === id && p.available && !p.components,
        ),
      ))
  );
}
export function dishPrice(restaurant: Restaurant, dish: Dish): number {
  if (dish.fixedPrice !== undefined) return dish.fixedPrice;
  if (!dish.components) return dish.price;
  return Math.max(
    0,
    dish.components.reduce(
      (sum, id) =>
        sum + (restaurant.dishes.find((p) => p.id === id)?.price ?? 0),
      0,
    ) - (dish.discount ?? 0),
  );
}

function offerDishEligible(restaurant: Restaurant, dish: Dish | undefined): dish is Dish {
  return Boolean(
    dish &&
      !dish.components &&
      dishAvailable(restaurant, dish) &&
      dishPrice(restaurant, dish) > 0 &&
      (restaurant.id !== "robys-coffee-house" ||
        dish.choice?.sourceStatus === "confirmed"),
  );
}

export type CheckoutOffer = {
  rule: OfferRule;
  trigger: Dish;
  dish: Dish;
  price: number;
};

export function checkoutOffers(
  restaurant: Restaurant,
  items: CartLine[],
): CheckoutOffer[] {
  if (!restaurant.open || !items.length || items.length >= 50) return [];
  if (
    items.some(
      (item) =>
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20 ||
        !restaurant.dishes.some((dish) => dish.id === item.productId),
    ) ||
    new Set(items.map((item) => item.productId)).size !== items.length
  ) return [];
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (!Number.isSafeInteger(quantity) || quantity >= 50) return [];
  const inCart = new Set(items.map((item) => item.productId));
  const occupied = new Set(inCart);
  for (const item of items) {
    const dish = restaurant.dishes.find((candidate) => candidate.id === item.productId);
    for (const componentId of dish?.components ?? []) occupied.add(componentId);
  }
  const seenAddOns = new Set<string>();
  return restaurant.offerRules
    .filter((rule) => rule.active && inCart.has(rule.triggerId) && !occupied.has(rule.addOnId))
    .flatMap((rule) => {
      const trigger = restaurant.dishes.find((dish) => dish.id === rule.triggerId);
      const dish = restaurant.dishes.find((candidate) => candidate.id === rule.addOnId);
      if (
        rule.triggerId === rule.addOnId ||
        !offerDishEligible(restaurant, trigger) ||
        !offerDishEligible(restaurant, dish)
      ) return [];
      return [{ rule, trigger, dish, price: dishPrice(restaurant, dish) }];
    })
    .sort((left, right) => right.price - left.price || left.rule.id.localeCompare(right.rule.id))
    .filter(({ dish }) => {
      if (seenAddOns.has(dish.id)) return false;
      seenAddOns.add(dish.id);
      return true;
    });
}
export function deliveryQuote(restaurant: Restaurant, items: CartLine[]) {
  if (!restaurant.open) throw new Error("Ресторан сейчас не принимает заказы");
  if (!items.length || items.length > 50)
    throw new Error("Добавьте блюда в заказ");
  const seen = new Set<string>();
  let count = 0;
  const lines = items.map((item) => {
    const dish = restaurant.dishes.find((p) => p.id === item.productId);
    if (!dish || !dishAvailable(restaurant, dish))
      throw new Error(
        "Одно из блюд сейчас недоступно. Удалите его из корзины.",
      );
    if (seen.has(dish.id)) throw new Error("Повторяющаяся позиция в корзине");
    seen.add(dish.id);
    amount(item.quantity, 20, "До 20 порций одного блюда", 1);
    count += item.quantity;
    if (count > 50) throw new Error("До 50 порций в одном заказе");
    return {
      name: dish.name,
      quantity: item.quantity,
      unitPrice: dishPrice(restaurant, dish),
    };
  });
  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  return {
    lines,
    subtotal,
    deliveryFee: restaurant.deliveryFee,
    total: subtotal + restaurant.deliveryFee,
    missing: Math.max(0, restaurant.minimum - subtotal),
  };
}

export function comboOffer(restaurant: Restaurant, items: CartLine[]) {
  if (
    items.some(
      (i) => restaurant.dishes.find((d) => d.id === i.productId)?.components,
    )
  )
    return null;
  for (const [index, item] of items.entries()) {
    const combo = restaurant.dishes.find(
      (d) =>
        d.components?.[0] === item.productId &&
        (d.discount ?? 0) > 0 &&
        dishAvailable(restaurant, d),
    );
    if (
      !combo ||
      combo
        .components!.slice(1)
        .some((id) => items.some((i) => i.productId === id))
    )
      continue;
    const base = restaurant.dishes.find((d) => d.id === item.productId)!;
    return {
      index,
      combo,
      extra: dishPrice(restaurant, combo) - dishPrice(restaurant, base),
    };
  }
  return null;
}

// Pure demo state transitions. Production authorization belongs in the Go API.
export function applyDeliveryAction(
  current: DeliveryState,
  action: DeliveryAction,
  at = new Date().toISOString(),
): DeliveryState {
  const state = structuredClone(current);
  if (action.type === "offer.record") {
    const event = action.event;
    if (
      !event ||
      !["shown", "accepted", "declined"].includes(event.type) ||
      !Number.isSafeInteger(event.at) ||
      event.at < 0
    ) throw new Error("Некорректное событие предложения");
    text(event.id, 1, 160, "Некорректный ID события");
    text(event.attemptId, 1, 160, "Некорректный ID попытки");
    const restaurant = state.restaurants.find((entry) => entry.id === event.restaurantId);
    if (!restaurant || !restaurant.offerRules.some((rule) => rule.id === event.ruleId))
      throw new Error("Предложение не найдено");
    if (state.offerEvents.some((entry) => entry.id === event.id))
      throw new Error("Событие уже записано");
    const previous = state.offerEvents.filter(
      (entry) =>
        entry.restaurantId === event.restaurantId &&
        entry.ruleId === event.ruleId &&
        entry.attemptId === event.attemptId,
    );
    if (event.type === "shown") {
      if (previous.length) throw new Error("Предложение уже показано");
    } else {
      const shown = previous.find((entry) => entry.type === "shown");
      if (!shown || previous.some((entry) => entry.type !== "shown") || event.at < shown.at)
        throw new Error("Сначала покажите предложение");
    }
    state.offerEvents.unshift({ ...event });
    state.offerEvents = state.offerEvents.slice(0, 1000);
    return state;
  }
  if (action.type === "restaurant.add") {
    if (state.restaurants.some((r) => r.id === action.id))
      throw new Error("Ресторан уже существует");
    const i = action.input;
    if (!Object.hasOwn(cuisines, i.cuisine)) throw new Error("Выберите кухню");
    const restaurant: Restaurant = {
      id: action.id,
      name: text(i.name, 2, 60, "Название: от 2 до 60 символов"),
      description: text(i.description, 0, 180, "Описание: до 180 символов"),
      cuisine: i.cuisine,
      currency: i.currency ?? "RUB",
      address: text(i.address, 5, 180, "Укажите адрес ресторана"),
      deliveryFee: amount(
        i.deliveryFee,
        500000,
        "Проверьте стоимость доставки",
      ),
      minimum: amount(i.minimum, 1000000, "Проверьте минимальную сумму"),
      eta: amount(i.eta, 180, "Время доставки: от 10 до 180 минут", 10),
      open: true,
      dishes: [],
      offerRules: [],
    };
    if (
      i.currency !== undefined &&
      i.currency !== "RUB" &&
      i.currency !== "TRY"
    )
      throw new Error("Выберите валюту");
    state.restaurants.push(restaurant);
    return state;
  }
  if ("restaurantId" in action) {
    const restaurant = state.restaurants.find(
      (r) => r.id === action.restaurantId,
    );
    if (!restaurant) throw new Error("Ресторан не найден");
    if (action.type === "restaurant.toggle") {
      restaurant.open = !restaurant.open;
      return state;
    }
    if (action.type === "dish.add") {
      if (restaurant.dishes.some((d) => d.id === action.id))
        throw new Error("Блюдо уже существует");
      restaurant.dishes.push({
        id: action.id,
        name: text(action.input.name, 2, 70, "Укажите название блюда"),
        description: text(
          action.input.description,
          0,
          180,
          "Описание: до 180 символов",
        ),
        price: amount(
          action.input.price,
          10000000,
          `Цена должна быть от 1 до 100 000 ${restaurant.currency === "TRY" ? "₺" : "₽"}`,
          100,
        ),
        image: amount(action.input.image, 5, "Выберите иллюстрацию"),
        available: true,
      });
      return state;
    }
    if (action.type === "dish.toggle") {
      const dish = restaurant.dishes.find((d) => d.id === action.productId);
      if (!dish) throw new Error("Блюдо не найдено");
      dish.available = !dish.available;
      return state;
    }
    if (action.type === "offer.add") {
      const id = text(action.id, 1, 160, "Некорректный ID предложения");
      if (restaurant.offerRules.length >= 30)
        throw new Error("До 30 предложений на ресторан");
      if (restaurant.offerRules.some((rule) => rule.id === id))
        throw new Error("Предложение уже существует");
      if (action.triggerId === action.addOnId)
        throw new Error("Выберите два разных блюда");
      const trigger = restaurant.dishes.find((dish) => dish.id === action.triggerId);
      const addOn = restaurant.dishes.find((dish) => dish.id === action.addOnId);
      if (!trigger || !addOn)
        throw new Error("Выберите блюда этого ресторана");
      if (!offerDishEligible(restaurant, trigger) || !offerDishEligible(restaurant, addOn))
        throw new Error("Выберите доступные подтверждённые блюда, не комбо");
      if (restaurant.offerRules.some(
        (rule) => rule.triggerId === trigger.id && rule.addOnId === addOn.id,
      )) throw new Error("Такая пара уже есть");
      restaurant.offerRules.push({ id, triggerId: trigger.id, addOnId: addOn.id, active: true });
      return state;
    }
    if (action.type === "offer.toggle" || action.type === "offer.remove") {
      const index = restaurant.offerRules.findIndex((rule) => rule.id === action.ruleId);
      if (index < 0) throw new Error("Предложение не найдено");
      if (action.type === "offer.remove") {
        restaurant.offerRules.splice(index, 1);
      } else {
        const rule = restaurant.offerRules[index];
        if (!rule.active) {
          const trigger = restaurant.dishes.find((dish) => dish.id === rule.triggerId);
          const addOn = restaurant.dishes.find((dish) => dish.id === rule.addOnId);
          if (!offerDishEligible(restaurant, trigger) || !offerDishEligible(restaurant, addOn))
            throw new Error("Блюда недоступны или не подтверждены");
        }
        rule.active = !rule.active;
      }
      return state;
    }
    if (action.type === "order.place") {
      if (state.orders.some((o) => o.id === action.id))
        throw new Error("Этот заказ уже оформлен");
      const quote = deliveryQuote(restaurant, action.items);
      if (quote.missing) throw new Error("Не набрана минимальная сумма заказа");
      state.orders.unshift({
        id: action.id,
        number: Math.max(0, ...state.orders.map((o) => o.number)) + 1,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        currency: restaurant.currency,
        pickup: restaurant.address,
        address: text(action.address, 5, 200, "Укажите улицу, дом и квартиру"),
        note: text(action.note, 0, 300, "Комментарий: до 300 символов"),
        lines: quote.lines,
        subtotal: quote.subtotal,
        deliveryFee: quote.deliveryFee,
        total: quote.total,
        status: "new",
        courierId: null,
        createdAt: at,
        history: [{ status: "new", at }],
      });
      return state;
    }
  }
  if (!("orderId" in action)) throw new Error("Неизвестное действие");
  const order = state.orders.find((o) => o.id === action.orderId);
  if (!order) throw new Error("Заказ не найден");
  let next: DeliveryStatus;
  switch (action.type) {
    case "order.prepare":
    case "order.ready": {
      if (order.restaurantId !== action.restaurantId)
        throw new Error("Заказ другого ресторана");
      const expected = action.type === "order.prepare" ? "new" : "preparing";
      if (order.status !== expected)
        throw new Error("Статус уже изменился. Обновите список.");
      next = expected === "new" ? "preparing" : "ready";
      break;
    }
    case "order.claim":
      if (order.status !== "ready" || order.courierId)
        throw new Error("Заказ уже взят или ещё не готов");
      order.courierId = text(action.courierId, 1, 60, "Выберите курьера");
      next = "assigned";
      break;
    case "order.pickup":
    case "order.deliver":
      if (order.courierId !== action.courierId)
        throw new Error("Этот заказ у другого курьера");
      if (
        order.status !==
        (action.type === "order.pickup" ? "assigned" : "picked-up")
      )
        throw new Error("Нельзя пропустить этап доставки");
      next = action.type === "order.pickup" ? "picked-up" : "delivered";
      break;
    case "order.cancel":
      if (order.status !== "new")
        throw new Error("Отмена доступна до начала приготовления");
      next = "cancelled";
      break;
    default:
      throw new Error("Неизвестное действие");
  }
  order.status = next;
  order.history.push({ status: next, at });
  return state;
}
