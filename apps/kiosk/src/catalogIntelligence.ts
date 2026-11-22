import sefaSource from "./data/sefaSource.json" with { type: "json" };
import mioraSource from "./data/mioraSource.json" with { type: "json" };
import { initialDeliveryState } from "./delivery.ts";

export type SourceCatalogItem = {
  id: string;
  category: string;
  name: string;
  priceMinor: number | null;
};
export type SourceCatalog = {
  businessId: string;
  source: string;
  sourceSha: string | null;
  capturedAt: string | null;
  currency: "TRY" | "RUB";
  status: "working-menu-snapshot" | "demo-only" | "no-approved-products" | "not-applicable" | "pending-source";
  items: SourceCatalogItem[];
};

function snapshot(source: typeof sefaSource): SourceCatalog {
  return {
    businessId: source.businessId,
    source: source.source.repository + "/" + source.source.path,
    sourceSha: source.source.blobSha,
    capturedAt: source.source.snapshotAt,
    currency: "TRY",
    status: "working-menu-snapshot",
    items: source.items.map((item) => ({
      id: item.id,
      category: item.category,
      name: item.name,
      priceMinor: item.priceMinor,
    })),
  };
}

export function catalogFor(businessId: string): SourceCatalog {
  if (businessId === "miora") return snapshot(mioraSource);
  if (businessId === "sefa-beach") return snapshot(sefaSource);
  if (businessId === "riva-bella") {
    return {
      businessId,
      source: "safal207/riva-bella-revenue/data/catalog-draft.json",
      sourceSha: "02d69c270637600b7f030c1af9e431c0d9eac15b",
      capturedAt: null,
      currency: "TRY",
      status: "no-approved-products",
      items: [],
    };
  }
  if (businessId === "pacelli") {
    return {
      businessId,
      source: "Ожидается исходное меню от пользователя",
      sourceSha: null,
      capturedAt: null,
      currency: "TRY",
      status: "pending-source",
      items: [],
    };
  }
  if (businessId === "ai-cafe") {
    return {
      businessId,
      source: "Пилотная программа без каталога",
      sourceSha: null,
      capturedAt: null,
      currency: "TRY",
      status: "not-applicable",
      items: [],
    };
  }
  const restaurantId = businessId === "robys" ? "robys-coffee-house" : "bite-burger";
  const restaurant = initialDeliveryState().restaurants.find((item) => item.id === restaurantId);
  if (!restaurant) throw new Error("Неизвестный бизнес");
  return {
    businessId,
    source: "BiteOS: apps/kiosk/src/delivery.ts (демоданные)",
    sourceSha: null,
    capturedAt: null,
    currency: restaurant.currency,
    status: "demo-only",
    items: restaurant.dishes.map((dish) => ({
      id: dish.id,
      category: dish.section ?? restaurant.cuisine,
      name: dish.name,
      priceMinor: dish.fixedPrice ?? (dish.price > 0 ? dish.price : null),
    })),
  };
}

export function catalogSummary(catalog: SourceCatalog) {
  return {
    total: catalog.items.length,
    withUnverifiedPrice: catalog.items.filter((item) => item.priceMinor !== null).length,
    missingPrice: catalog.items.filter((item) => item.priceMinor === null).length,
    ownerApproved: 0,
    categoryCount: new Set(catalog.items.map((item) => item.category)).size,
  };
}
