export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  weight: string;
  kcal: number;
  image: number;
  badge: string;
  available: boolean;
  options: string[];
};
export type Option = { id: string; name: string; price: number };
export type Catalog = {
  currency: string;
  products: Product[];
  options: Option[];
  combo: { sideId: string; drinkId: string; discount: number };
};
export type Item = {
  productId: string;
  quantity: number;
  optionIds: string[];
  combo: boolean;
};
export type Mode = "dine-in" | "takeaway";
export type Quote = {
  subtotal: number;
  discount: number;
  total: number;
  count: number;
};
export type Offer = {
  productId: string;
  kind: "combo" | "add";
  reason: string;
  price: number;
  score: number;
  itemIndex: number | null;
};
export type Order = {
  id: string;
  number: number;
  status: string;
  quote: Quote;
};

export const money = (amount: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(amount / 100);
export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  key?: string,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Сервис временно недоступен");
  return data;
}
