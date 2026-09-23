import { initialDeliveryState } from "./delivery.ts";
import type { Catalog, Item, Offer } from "./types";

export type KioskOfferEvent = {
  type: "shown" | "accepted" | "declined";
  offerKey: string;
  attemptId: string;
  at: number;
};

type OfferStorage = Pick<Storage, "getItem" | "setItem">;
type PricedOffer = { offer: Offer; delta: number };
export type ConfiguredKioskOffer = Offer & {
  ruleId: string;
  triggerId: string;
};

const STORAGE_KEY = "biteos.kiosk.offer-events.v1";
const DELIVERY_STORAGE_KEY = "biteos-delivery-v1";
const MAX_EVENTS = 200;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const validId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 160;

type BurgerSource = {
  saved: boolean;
  dishes: unknown[];
  offerRules: unknown[];
  open: boolean;
};

function readBurgerSource(storage?: OfferStorage): BurgerSource | null {
  try {
    const raw = getStorage(storage)?.getItem(DELIVERY_STORAGE_KEY) ?? null;
    const state: unknown =
      raw === null
        ? initialDeliveryState()
        : raw.length <= 2_000_000
          ? JSON.parse(raw)
          : null;
    if (
      !record(state) ||
      state.version !== 1 ||
      !Array.isArray(state.restaurants) ||
      state.restaurants.length > 100
    )
      return null;
    const matches = state.restaurants.filter(
      (restaurant: unknown) =>
        record(restaurant) && restaurant.id === "bite-burger",
    );
    if (matches.length !== 1) return null;
    const restaurant = matches[0];
    if (
      !record(restaurant) ||
      typeof restaurant.open !== "boolean" ||
      (restaurant.currency !== undefined && restaurant.currency !== "RUB") ||
      !Array.isArray(restaurant.dishes) ||
      restaurant.dishes.length > 200 ||
      !Array.isArray(restaurant.offerRules) ||
      restaurant.offerRules.length > 30
    )
      return null;
    return {
      saved: raw !== null,
      dishes: restaurant.dishes,
      offerRules: restaurant.offerRules,
      open: restaurant.open,
    };
  } catch {
    return null;
  }
}

// Saved restaurant data is only a source of pairing IDs and availability.
// The kiosk catalog and quote API remain the authorities for products/prices.
export function readConfiguredKioskOffers(
  catalog: Catalog,
  items: Item[],
  storage?: OfferStorage,
): ConfiguredKioskOffer[] {
  if (
    !items.length ||
    items.reduce((sum, item) => sum + item.quantity, 0) >= 50
  )
    return [];
  try {
    const source = readBurgerSource(storage);
    if (!source?.open) return [];
    const kioskProducts = new Map(
      catalog.products.map((product) => [product.id, product]),
    );
    const merchantDishes = new Map<string, boolean>();
    for (const dish of source.dishes) {
      if (
        !record(dish) ||
        !validId(dish.id) ||
        typeof dish.available !== "boolean"
      )
        continue;
      if (merchantDishes.has(dish.id)) return [];
      merchantDishes.set(dish.id, dish.available);
    }
    const inCart = new Set(items.map((item) => item.productId));
    const occupied = new Set(inCart);
    if (items.some((item) => item.combo)) {
      occupied.add(catalog.combo.sideId);
      occupied.add(catalog.combo.drinkId);
    }
    const eligible: ConfiguredKioskOffer[] = [];
    const seenAddOns = new Set<string>();
    for (const rule of source.offerRules) {
      if (
        !record(rule) ||
        !validId(rule.id) ||
        !validId(rule.triggerId) ||
        !validId(rule.addOnId) ||
        rule.active !== true ||
        rule.triggerId === rule.addOnId ||
        !inCart.has(rule.triggerId) ||
        occupied.has(rule.addOnId) ||
        seenAddOns.has(rule.addOnId)
      )
        continue;
      const trigger = kioskProducts.get(rule.triggerId);
      const addOn = kioskProducts.get(rule.addOnId);
      if (
        !trigger?.available ||
        !addOn?.available ||
        merchantDishes.get(rule.triggerId) !== true ||
        merchantDishes.get(rule.addOnId) !== true
      )
        continue;
      seenAddOns.add(addOn.id);
      eligible.push({
        ruleId: rule.id,
        triggerId: rule.triggerId,
        productId: addOn.id,
        kind: "add",
        reason: `Дополнит блюдо «${trigger.name}»`,
        price: addOn.price,
        score: 1_000,
        itemIndex: null,
      });
    }
    eligible.sort(
      (a, b) => b.price - a.price || a.ruleId.localeCompare(b.ruleId),
    );
    return eligible;
  } catch {
    return [];
  }
}

export function kioskGateCandidates(
  catalog: Catalog,
  items: Item[],
  configured: ConfiguredKioskOffer[],
  native: Offer[],
  storage?: OfferStorage,
): Offer[] {
  const combo = native.find(
    (offer) =>
      offer.kind === "combo" &&
      kioskOfferCost(items, offer) !== null &&
      configured.some(
        (pair) =>
          pair.triggerId === offer.productId &&
          pair.productId === catalog.combo.sideId,
      ) &&
      configured.some(
        (pair) =>
          pair.triggerId === offer.productId &&
          pair.productId === catalog.combo.drinkId,
      ),
  );
  if (combo) {
    const totalComboCost = kioskOfferCost(items, combo)!;
    const cheaper = configured.find((offer) => offer.price < totalComboCost);
    return cheaper ? [combo, cheaper] : [combo];
  }
  if (configured.length) {
    const first = configured[0];
    const cheaper = configured.find((offer) => offer.price < first.price);
    return cheaper ? [first, cheaper] : [first];
  }
  return filterNativeKioskGateOffers(native, items, storage);
}

// A deleted rule has no tombstone in the saved state. Once the manager has
// saved settings, generic add-ons are excluded from the gate so deletion or
// deactivation cannot silently bring the same product back. Combo tips stay
// available in the cart and can gate only for triggers never managed here.
export function filterNativeKioskGateOffers(
  offers: Offer[],
  items: Item[],
  storage?: OfferStorage,
): Offer[] {
  const source = readBurgerSource(storage);
  if (!source) return offers;
  if (!source.open) return [];
  const managedTriggers = new Set(
    initialDeliveryState()
      .restaurants.find((restaurant) => restaurant.id === "bite-burger")!
      .offerRules.map((rule) => rule.triggerId),
  );
  for (const rule of source.offerRules)
    if (record(rule) && validId(rule.triggerId))
      managedTriggers.add(rule.triggerId);
  const activeCartIds = new Set(items.map((item) => item.productId));
  return offers.filter((offer) => {
    if (offer.kind === "add") return !source.saved;
    if (offer.kind === "combo")
      return !(
        activeCartIds.has(offer.productId) &&
        managedTriggers.has(offer.productId)
      );
    return false;
  });
}

export function kioskOfferKey(offer: Offer): string {
  const ruleId = (offer as Partial<ConfiguredKioskOffer>).ruleId;
  if (typeof ruleId === "string" && /^[a-z0-9-]{1,123}$/i.test(ruleId))
    return `rule:${ruleId}`;
  return offer.kind === "combo"
    ? `combo:${offer.productId}:${offer.itemIndex}`
    : `add:${offer.productId}`;
}

export function applyKioskOffer(items: Item[], offer: Offer): Item[] | null {
  if (offer.kind === "combo") {
    const index = offer.itemIndex;
    if (
      !Number.isInteger(index) ||
      index === null ||
      index < 0 ||
      index >= items.length ||
      items[index].productId !== offer.productId ||
      items[index].combo
    )
      return null;
    return items.map((item, i) =>
      i === index ? { ...item, combo: true } : item,
    );
  }
  if (
    offer.kind !== "add" ||
    items.some((item) => item.productId === offer.productId) ||
    items.reduce((sum, item) => sum + item.quantity, 0) >= 50
  )
    return null;
  return [
    ...items,
    { productId: offer.productId, quantity: 1, optionIds: [], combo: false },
  ];
}

export function kioskOfferCost(items: Item[], offer: Offer): number | null {
  if (!Number.isSafeInteger(offer.price) || offer.price < 0) return null;
  if (!applyKioskOffer(items, offer)) return null;
  if (offer.kind === "add") return offer.price;
  const quantity = items[offer.itemIndex!].quantity;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return null;
  return offer.price * quantity;
}

// The second step must be strictly cheaper than the first for the whole cart.
export function cheaperKioskFallback(
  offers: PricedOffer[],
): PricedOffer | null {
  const first = offers[0];
  if (!first) return null;
  return (
    offers
      .slice(1)
      .filter((candidate) => candidate.delta < first.delta)
      .sort((a, b) => a.delta - b.delta || b.offer.score - a.offer.score)[0] ??
    null
  );
}

function validEvent(value: unknown): value is KioskOfferEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.type === "string" &&
    ["shown", "accepted", "declined"].includes(event.type) &&
    typeof event.offerKey === "string" &&
    /^[a-z0-9:-]{1,128}$/i.test(event.offerKey) &&
    typeof event.attemptId === "string" &&
    /^[a-z0-9-]{8,64}$/i.test(event.attemptId) &&
    Number.isSafeInteger(event.at) &&
    Number(event.at) >= 1_577_836_800_000 &&
    Number(event.at) <= Date.now() + 86_400_000
  );
}

function getStorage(storage?: OfferStorage): OfferStorage | null {
  if (storage) return storage;
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readKioskOfferEvents(
  storage?: OfferStorage,
): KioskOfferEvent[] {
  try {
    const raw = getStorage(storage)?.getItem(STORAGE_KEY);
    if (!raw || raw.length > 80_000) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(validEvent)
      .slice(-MAX_EVENTS)
      .map(({ type, offerKey, attemptId, at }) => ({
        type,
        offerKey,
        attemptId,
        at,
      }));
  } catch {
    return [];
  }
}

export function recordKioskOfferEvent(
  event: KioskOfferEvent,
  storage?: OfferStorage,
): void {
  if (!validEvent(event)) return;
  try {
    getStorage(storage)?.setItem(
      STORAGE_KEY,
      JSON.stringify(
        [...readKioskOfferEvents(storage), event].slice(-MAX_EVENTS),
      ),
    );
  } catch {
    // Storage may be unavailable (private mode / browser policy).
  }
}
