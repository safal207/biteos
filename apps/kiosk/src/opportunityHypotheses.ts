import { catalogFor } from "./catalogIntelligence.ts";
import type { SourceCatalog, SourceCatalogItem } from "./catalogIntelligence";

/** Hand-picked hypotheses referencing exact IDs from the user's working menus.
 * These are test proposals, NOT observed pairings, demand or approved discounts. */
export type OpportunityTemplate = {
  id: string;
  mainId: string;
  addOnId: string;
  title: string;
  needToTest: string;
  metric: string;
};

const templateByBusiness: Record<string, OpportunityTemplate[]> = {
  miora: [
    {
      id: "miora-coffee-dessert",
      mainId: "428748",
      addOnId: "430226",
      title: "Кофе + десерт",
      needToTest: "Станут ли гости чаще добавлять десерт при понятном предложении к кофе?",
      metric: "Доля завершённых заказов с десертом среди заказов с выбранным кофе",
    },
    {
      id: "miora-croissant-coffee",
      mainId: "430356",
      addOnId: "429264",
      title: "Круассан + холодный кофе",
      needToTest: "Нужно ли гостю готовое предложение перекуса с напитком?",
      metric: "Доля завершённых заказов с напитком среди заказов с круассаном",
    },
  ],
  "sefa-beach": [
    {
      id: "sefa-pizza-drink",
      mainId: "34",
      addOnId: "89",
      title: "Пицца + напиток",
      needToTest: "Добавляет ли простой выбор напитка ценность к заказу пиццы?",
      metric: "Доля завершённых заказов с напитком среди заказов с пиццей",
    },
    {
      id: "sefa-burger-drink",
      mainId: "39",
      addOnId: "89",
      title: "Бургер + напиток",
      needToTest: "Удобно ли посетителям добавить напиток к бургеру за один шаг?",
      metric: "Доля завершённых заказов с напитком среди заказов с бургером",
    },
    {
      id: "sefa-breakfast-tea",
      mainId: "2",
      addOnId: "117",
      title: "Завтрак + чай",
      needToTest: "Стоит ли показывать чай сразу при выборе завтрака?",
      metric: "Доля завершённых заказов с чаем среди заказов с завтраком",
    },
  ],
};

export type Opportunity = OpportunityTemplate & {
  businessId: string;
  main: SourceCatalogItem;
  addOn: SourceCatalogItem;
  fullPriceMinor: number;
  incrementalPriceMinor: number;
  evidenceStatus: "menu-based-untested";
};

export function opportunitiesFor(businessId: string): Opportunity[] {
  const catalog = catalogFor(businessId);
  if (catalog.status !== "working-menu-snapshot") return [];
  const items = new Map(catalog.items.map((item) => [item.id, item]));
  return (templateByBusiness[businessId] ?? []).flatMap((template) => {
    const main = items.get(template.mainId);
    const addOn = items.get(template.addOnId);
    if (
      !main || !addOn || main.id === addOn.id ||
      main.priceMinor === null || addOn.priceMinor === null
    ) return [];
    return [{
      ...template,
      businessId,
      main,
      addOn,
      fullPriceMinor: main.priceMinor + addOn.priceMinor,
      incrementalPriceMinor: addOn.priceMinor,
      evidenceStatus: "menu-based-untested" as const,
    }];
  });
}

export function selectedPair(
  businessId: string,
  mainId: string,
  addOnId: string,
  catalogOverride?: SourceCatalog,
) {
  const catalog = catalogOverride ?? catalogFor(businessId);
  if (catalog.businessId !== businessId) return null;
  if (catalog.status !== "working-menu-snapshot") return null;
  const main = catalog.items.find((item) => item.id === mainId);
  const addOn = catalog.items.find((item) => item.id === addOnId);
  if (!main || !addOn || main.id === addOn.id ||
      main.priceMinor === null || addOn.priceMinor === null) return null;
  return {
    main, addOn,
    fullPriceMinor: main.priceMinor + addOn.priceMinor,
    incrementalPriceMinor: addOn.priceMinor,
  };
}
