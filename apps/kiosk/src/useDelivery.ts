import { useEffect, useState } from "react";
import {
  applyDeliveryAction,
  cuisines,
  initialDeliveryState,
  migrateDeliveryState,
  statusLabels,
} from "./delivery";
import type {
  DeliveryAction,
  DeliveryState,
  LegacyDeliveryState,
} from "./delivery";

const key = "biteos-delivery-v1";
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): value is string => typeof value === "string";
const validMoney = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const validPrepMinutes = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 5 && Number(value) <= 120;
const validCurrency = (value: unknown) => value === "RUB" || value === "TRY";
const validPhoto = (value: unknown) =>
  typeof value === "string" &&
  /^images\/robys\/(?:menu-v1|sets-v1)\/[a-z0-9-]+\.webp$/.test(value);
const validId = (value: unknown) =>
  str(value) && value.trim().length > 0 && value.length <= 160;
function validState(value: unknown): value is LegacyDeliveryState {
  if (
    !object(value) ||
    value.version !== 1 ||
    !Array.isArray(value.restaurants) ||
    !Array.isArray(value.orders)
  )
    return false;
  const restaurants = value.restaurants.every(
    (r: unknown) =>
      object(r) &&
      str(r.id) &&
      str(r.name) &&
      str(r.description) &&
      str(r.address) &&
      str(r.cuisine) &&
      Object.hasOwn(cuisines, r.cuisine) &&
      (r.currency === undefined || validCurrency(r.currency)) &&
      (r.photo === undefined || validPhoto(r.photo)) &&
      validMoney(r.deliveryFee) &&
      validMoney(r.minimum) &&
      validMoney(r.eta) &&
      (r.prepMinutes === undefined || validPrepMinutes(r.prepMinutes)) &&
      typeof r.open === "boolean" &&
      Array.isArray(r.dishes) &&
      r.dishes.every(
        (d: unknown) =>
          object(d) &&
          str(d.id) &&
          str(d.name) &&
          str(d.description) &&
          validMoney(d.price) &&
          validMoney(d.image) &&
          typeof d.available === "boolean" &&
          (d.photo === undefined || validPhoto(d.photo)) &&
          (d.section === undefined || str(d.section)) &&
          (d.fixedPrice === undefined || validMoney(d.fixedPrice)) &&
          (d.choice === undefined ||
            (object(d.choice) &&
              Array.isArray(d.choice.intents) &&
              d.choice.intents.every((intent: unknown) =>
                ["coffee", "breakfast", "snack", "dessert", "refresh"].includes(
                  String(intent),
                ),
              ) &&
              ["hot", "cold", "none"].includes(String(d.choice.temperature)) &&
              ["sweet", "neutral", "savoury"].includes(
                String(d.choice.taste),
              ) &&
              Array.isArray(d.choice.partySizes) &&
              d.choice.partySizes.every((size: unknown) =>
                ["one", "two", "family"].includes(String(size)),
              ) &&
              ["confirmed", "provisional"].includes(
                String(d.choice.sourceStatus),
              ))) &&
          (d.components === undefined ||
            (Array.isArray(d.components) && d.components.every(str))) &&
          (d.discount === undefined || validMoney(d.discount)),
      ) &&
      (r.offerRules === undefined ||
        (Array.isArray(r.offerRules) &&
          r.offerRules.length <= 30 &&
          r.offerRules.every(
            (rule: unknown) =>
              object(rule) &&
              validId(rule.id) &&
              validId(rule.triggerId) &&
              validId(rule.addOnId) &&
              rule.triggerId !== rule.addOnId &&
              typeof rule.active === "boolean" &&
              (r.dishes as unknown[]).some((dish) => object(dish) && dish.id === rule.triggerId) &&
              (r.dishes as unknown[]).some((dish) => object(dish) && dish.id === rule.addOnId),
          ) &&
          new Set(r.offerRules.map((rule: { id: string }) => rule.id)).size ===
            r.offerRules.length)),
  );
  const orders = value.orders.every(
    (o: unknown) =>
      object(o) &&
      str(o.id) &&
      validMoney(o.number) &&
      str(o.restaurantId) &&
      str(o.restaurantName) &&
      (o.currency === undefined || validCurrency(o.currency)) &&
      str(o.pickup) &&
      str(o.address) &&
      str(o.note) &&
      str(o.status) &&
      Object.hasOwn(statusLabels, o.status) &&
      (o.prepDurationMinutes === undefined ||
        o.prepDurationMinutes === null ||
        validPrepMinutes(o.prepDurationMinutes)) &&
      (o.courierId === null || str(o.courierId)) &&
      str(o.createdAt) &&
      validMoney(o.subtotal) &&
      validMoney(o.deliveryFee) &&
      validMoney(o.total) &&
      o.total === Number(o.subtotal) + Number(o.deliveryFee) &&
      Array.isArray(o.lines) &&
      o.lines.every(
        (l: unknown) =>
          object(l) &&
          str(l.name) &&
          validMoney(l.unitPrice) &&
          validMoney(l.quantity),
      ) &&
      Array.isArray(o.history) &&
      o.history.every(
        (h: unknown) =>
          object(h) &&
          str(h.status) &&
          Object.hasOwn(statusLabels, h.status) &&
          str(h.at),
      ),
  );
  const offerEvents =
    value.offerEvents === undefined ||
    (Array.isArray(value.offerEvents) &&
      value.offerEvents.length <= 5000 &&
      value.offerEvents.every(
        (event: unknown) =>
          object(event) &&
          validId(event.id) &&
          validId(event.restaurantId) &&
          validId(event.ruleId) &&
          validId(event.attemptId) &&
          ["shown", "accepted", "declined"].includes(String(event.type)) &&
          validMoney(event.at),
      ));
  return restaurants && orders && offerEvents;
}
function readState(): DeliveryState {
  const raw = sessionStorage.getItem(key);
  if (!raw) return initialDeliveryState();
  const state: unknown = JSON.parse(raw);
  if (!validState(state))
    throw new Error("Сохранённые демоданные не удалось прочитать");
  return migrateDeliveryState(state);
}

export function useDelivery() {
  const [state, setState] = useState<DeliveryState>(initialDeliveryState);
  const [error, setError] = useState("");
  const [canReset, setCanReset] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    try {
      setState(readState());
    } catch {
      setError("Не удалось прочитать демоданные этой вкладки");
      setCanReset(true);
    }
  }, []);
  async function dispatch(action: DeliveryAction) {
    setPending(true);
    setError("");
    try {
      const next = applyDeliveryAction(readState(), action);
      sessionStorage.setItem(key, JSON.stringify(next));
      setState(next);
      setCanReset(false);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось сохранить изменение",
      );
      try {
        readState();
      } catch {
        setCanReset(true);
      }
      return false;
    } finally {
      setPending(false);
    }
  }
  function resetDemo() {
    try {
      sessionStorage.removeItem(key);
      setState(initialDeliveryState());
      setError("");
      setCanReset(false);
      return true;
    } catch {
      setError("Не удалось сбросить демоданные этой вкладки");
      return false;
    }
  }
  return {
    state,
    dispatch,
    error,
    canReset,
    resetDemo,
    pending,
    clearError: () => setError(""),
  };
}
