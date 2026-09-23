import { useEffect, useState } from "react";
import {
  applyDeliveryAction,
  cuisines,
  initialDeliveryState,
  statusLabels,
} from "./delivery";
import type { DeliveryAction, DeliveryState } from "./delivery";

const key = "biteos-delivery-v1";
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): value is string => typeof value === "string";
const validMoney = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) >= 0;
function validState(value: unknown): value is DeliveryState {
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
      validMoney(r.deliveryFee) &&
      validMoney(r.minimum) &&
      validMoney(r.eta) &&
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
          (d.components === undefined ||
            (Array.isArray(d.components) && d.components.every(str))) &&
          (d.discount === undefined || validMoney(d.discount)),
      ),
  );
  const orders = value.orders.every(
    (o: unknown) =>
      object(o) &&
      str(o.id) &&
      validMoney(o.number) &&
      str(o.restaurantId) &&
      str(o.restaurantName) &&
      str(o.pickup) &&
      str(o.address) &&
      str(o.note) &&
      str(o.status) &&
      Object.hasOwn(statusLabels, o.status) &&
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
  return restaurants && orders;
}
function readState(): DeliveryState {
  const raw = sessionStorage.getItem(key);
  if (!raw) return initialDeliveryState();
  const state: unknown = JSON.parse(raw);
  if (!validState(state))
    throw new Error("Сохранённые демоданные не удалось прочитать");
  return state;
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
