import seed from "../../../services/api/catalog.json" with { type: "json" };
import type { Catalog, Item, Mode, Offer, Order, Quote } from "./types";

type Basket = { items: Item[]; mode: Mode };

// GitHub Pages preview only. Real deployments continue to use Go and Rust.
// Receipts stay in this tab's memory and disappear on refresh.
export function createDemoApi(catalog: Catalog) {
  let sequence = 0;
  const receipts = new Map<string, { fingerprint: string; order: Order }>();
  const product = (id: string) => catalog.products.find((p) => p.id === id);

  function price(input: unknown): { basket: Basket; quote: Quote } {
    const basket = input as Basket | undefined;
    if (!basket || !["dine-in", "takeaway"].includes(basket.mode))
      throw new Error("Выберите: в зале или с собой");
    if (!Array.isArray(basket.items) || basket.items.length > 50)
      throw new Error("Слишком много позиций");
    const quote: Quote = { subtotal: 0, discount: 0, total: 0, count: 0 };
    for (const item of basket.items) {
      const p = item && product(item.productId);
      if (!p?.available) throw new Error("Блюдо недоступно");
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20
      )
        throw new Error("Количество должно быть от 1 до 20");
      if (
        !Array.isArray(item.optionIds) ||
        new Set(item.optionIds).size !== item.optionIds.length
      )
        throw new Error("Недопустимая добавка");
      let unit = p.price;
      for (const id of item.optionIds) {
        const option = catalog.options.find((o) => o.id === id);
        if (!option || !p.options.includes(id))
          throw new Error("Недопустимая добавка");
        unit += option.price;
      }
      if (item.combo) {
        const side = product(catalog.combo.sideId);
        const drink = product(catalog.combo.drinkId);
        if (p.category !== "burgers" || !side?.available || !drink?.available)
          throw new Error("Комбо недоступно");
        unit += side.price + drink.price;
        quote.discount += catalog.combo.discount * item.quantity;
      }
      quote.subtotal += unit * item.quantity;
      quote.count += item.quantity;
      if (quote.count > 50) throw new Error("Не больше 50 блюд в заказе");
    }
    quote.total = quote.subtotal - quote.discount;
    return { basket, quote };
  }

  function recommend(items: Item[]): Offer[] {
    if (!items.length) return [];
    const ids = new Set(items.map((i) => i.productId));
    const categories = new Set(
      items.map((i) => product(i.productId)!.category),
    );
    if (items.some((i) => i.combo)) {
      ids.add(catalog.combo.sideId);
      ids.add(catalog.combo.drinkId);
      categories.add("sides");
      categories.add("drinks");
    }
    const offers: Offer[] = [];
    const side = product(catalog.combo.sideId);
    const drink = product(catalog.combo.drinkId);
    const burgerIndex = items.findIndex(
      (i) => !i.combo && product(i.productId)!.category === "burgers",
    );
    if (
      side?.available &&
      drink?.available &&
      burgerIndex >= 0 &&
      !categories.has("sides") &&
      !categories.has("drinks")
    ) {
      offers.push({
        productId: items[burgerIndex].productId,
        kind: "combo",
        reason: "Фри + кола. Вместе выгоднее",
        price: Math.max(0, side.price + drink.price - catalog.combo.discount),
        score: 100,
        itemIndex: burgerIndex,
      });
    }
    for (const p of catalog.products) {
      if (!p.available || ids.has(p.id)) continue;
      let score = 0;
      let reason = "";
      if (
        p.category === "drinks" &&
        categories.has("burgers") &&
        !categories.has("drinks")
      ) {
        score = 90;
        reason = "Освежающая пара к вашему бургеру";
      } else if (
        p.category === "sides" &&
        categories.has("burgers") &&
        !categories.has("sides")
      ) {
        score = 85;
        reason = "Добавьте немного хруста";
      } else if (p.category === "burgers" && !categories.has("burgers")) {
        score = 70;
        reason = "Начните с главного";
      }
      if (score)
        offers.push({
          productId: p.id,
          kind: "add",
          reason,
          price: p.price,
          score,
          itemIndex: null,
        });
    }
    return offers
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.price - b.price ||
          a.productId.localeCompare(b.productId),
      )
      .slice(0, 2);
  }

  return function request(
    path: string,
    input?: unknown,
    key?: string,
  ): unknown {
    if (path === "menu") return structuredClone(catalog);
    if (!["quote", "recommendations", "orders"].includes(path))
      throw new Error("Неизвестный запрос");
    const { basket, quote } = price(input);
    if (path === "quote") return quote;
    if (path === "recommendations")
      return { source: "browser-demo", offers: recommend(basket.items) };
    if (!basket.items.length) throw new Error("Добавьте блюдо в заказ");
    if (!key || key.length < 8 || key.length > 128)
      throw new Error("Не удалось создать демозаказ");
    const fingerprint = JSON.stringify(basket);
    const receipt = receipts.get(key);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint)
        throw new Error("Этот ключ уже использован для другого заказа");
      return structuredClone(receipt.order);
    }
    const order: Order = {
      id: crypto.randomUUID(),
      number: ++sequence,
      status: "demo",
      quote,
    };
    receipts.set(key, { fingerprint, order });
    return structuredClone(order);
  };
}

export const demoApi = createDemoApi(seed);
