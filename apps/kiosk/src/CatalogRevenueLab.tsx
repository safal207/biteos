import { useMemo, useState } from "react";
import { ChartNoAxesCombined, FileWarning, Search, ShieldAlert } from "lucide-react";
import { catalogFor, catalogSummary } from "./catalogIntelligence";
import type { SourceCatalogItem } from "./catalogIntelligence";
import { estimateScenario, validateScenario } from "./economics";
import { OpportunityPlanner } from "./OpportunityPlanner";
import type { Scenario } from "./economics";
import "./catalogRevenue.css";

const emptyInputs = {
  ordersPerDay: "", days: "", baselineAttachPercent: "", proposedAttachPercent: "",
  addOnPrice: "", addOnVariableCost: "", campaignCost: "",
};
type Inputs = typeof emptyInputs;

const formatPrice = (minor: number, currency: "TRY" | "RUB") =>
  new Intl.NumberFormat(currency === "TRY" ? "tr-TR" : "ru-RU", {
    style: "currency", currency, maximumFractionDigits: 2,
  }).format(minor / 100);

function parseInputs(inputs: Inputs): Scenario | null {
  if (Object.values(inputs).some((value) => value.trim() === "")) return null;
  const numbers = Object.fromEntries(
    Object.entries(inputs).map(([key, value]) => [key, Number(value.replace(",", "."))]),
  ) as Record<keyof Inputs, number>;
  if (Object.values(numbers).some((value) => !Number.isFinite(value))) return null;
  return {
    ordersPerDay: numbers.ordersPerDay,
    days: numbers.days,
    baselineAttachPercent: numbers.baselineAttachPercent,
    proposedAttachPercent: numbers.proposedAttachPercent,
    addOnPriceMinor: Math.round(numbers.addOnPrice * 100),
    addOnVariableCostMinor: Math.round(numbers.addOnVariableCost * 100),
    campaignCostMinor: Math.round(numbers.campaignCost * 100),
  };
}

export function CatalogRevenueLab({ businessId }: { businessId: string }) {
  const catalog = useMemo(() => catalogFor(businessId), [businessId]);
  const summary = catalogSummary(catalog);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState(12);
  const [inputs, setInputs] = useState<Inputs>(emptyInputs);

  const visible = catalog.items.filter((item) =>
    (!category || item.category === category) &&
    (!query || (item.name + " " + item.category).toLocaleLowerCase().includes(query.toLocaleLowerCase())),
  );
  const categories = [...new Set(catalog.items.map((item) => item.category))].sort();
  const scenario = parseInputs(inputs);
  const error = scenario ? validateScenario(scenario) : null;
  const estimate = scenario && !error ? estimateScenario(scenario) : null;
  function update(name: keyof Inputs, value: string) {
    setInputs((previous) => ({ ...previous, [name]: value }));
  }
  function useMenuPrice(item: SourceCatalogItem) {
    if (item.priceMinor === null) return;
    update("addOnPrice", (item.priceMinor / 100).toFixed(2));
  }

  return (
    <section className="catalog-lab" aria-labelledby="catalog-lab-heading">
      <div className="catalog-lab-heading">
        <div>
          <span className="business-eyebrow">03 / CATALOG INTELLIGENCE</span>
          <h2 id="catalog-lab-heading">Каталог и достоверность данных</h2>
        </div>
        <span className="catalog-lab-status">{catalog.status === "no-approved-products" ? "Нет согласованных товаров" : catalog.status === "not-applicable" ? "Нет товарного каталога" : catalog.status === "working-menu-snapshot" ? "Рабочее меню · твои данные" : "Демоверсия"}</span>
      </div>
      <div className="catalog-metrics">
        <div><strong>{summary.total}</strong><span>позиций</span></div>
        <div><strong>{summary.categoryCount}</strong><span>категорий</span></div>
        <div><strong>{summary.missingPrice}</strong><span>без цены</span></div>
        <div><strong>{summary.ownerApproved}</strong><span>подтверждено для реальных продаж</span></div>
      </div>
      <p className="catalog-source">
        Источник: {catalog.source} {catalog.sourceSha ? "· blob " + catalog.sourceSha.slice(0, 8) : ""}
        {catalog.capturedAt ? " · снимок " + catalog.capturedAt.slice(0, 10) : ""}
      </p>
      <p className="catalog-warning"><ShieldAlert size={18} />
        {catalog.status === "working-menu-snapshot"
          ? "Берём цены из меню, которое ты уже внёс, как рабочую основу для планирования. Ничего не переоцениваем и не заменяем. Цена товара может подставляться в сценарий по твоему выбору. Это не POS и не подтверждение фактических продаж."
          : catalog.status === "no-approved-products"
            ? "В публичном Riva Bella Revenue Lab нет согласованных владельцем товаров. Восемь демонстрационных позиций не импортируются; приватный концепт на 176 позиций не публикуется."
            : catalog.status === "demo-only"
              ? "Цены и ассортимент взяты из внутреннего демо BiteOS, а не из согласованной торговой системы."
              : "Для проекта пока нет товарного каталога. Сначала нужно согласовать формат продукта или услуги."}
      </p>
      {catalog.items.length > 0 && (
        <>
          <div className="catalog-filter-row">
            <label className="catalog-search"><Search size={17}/><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(12); }} placeholder="Найти позицию" aria-label="Поиск по каталогу" /></label>
            <select aria-label="Категория каталога" value={category} onChange={(event) => { setCategory(event.target.value); setLimit(12); }}>
              <option value="">Все категории</option>
              {categories.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="catalog-list">
            {visible.slice(0, limit).map((item) => (
              <div className="catalog-item" key={item.id}>
                <span><strong>{item.name}</strong><small>{item.category} · #{item.id}</small></span>
                <span className="catalog-item-price">
                  {item.priceMinor === null ? "Цена отсутствует" : formatPrice(item.priceMinor, catalog.currency)}
                  <small>{catalog.status === "working-menu-snapshot" ? "цена из рабочего меню" : "демо"}</small>
                  {item.priceMinor !== null && <button type="button" className="catalog-use-price" onClick={() => useMenuPrice(item)} aria-label={"Использовать цену для расчёта: " + item.name}>Взять для расчёта</button>}
                </span>
              </div>
            ))}
            {visible.length === 0 && <p className="catalog-empty">По этому запросу позиций нет.</p>}
          </div>
          {visible.length > limit && <button type="button" className="catalog-more" onClick={() => setLimit((n) => n + 12)}>Ещё 12 · показано {Math.min(limit, visible.length)} из {visible.length}</button>}
        </>
      )}

      <OpportunityPlanner businessId={businessId} onChooseAddOn={(minor) => {
        update("addOnPrice", (minor / 100).toFixed(2));
      }} />
      <div className="revenue-lab" aria-labelledby="revenue-lab-heading">
        <div className="revenue-lab-title"><ChartNoAxesCombined size={21}/><div><span className="business-eyebrow">05 / REVENUE LAB</span><h2 id="revenue-lab-heading">Сценарий роста за период</h2></div></div>
        <p>Для сценария можно взять цену из твоего рабочего меню кнопкой у товара или ввести её вручную. Заказы, доли допродаж, себестоимость и расходы задаются отдельно. Прогноз показывает дополнительный маржинальный вклад, <strong>не чистую прибыль</strong>.</p>
        <div className="revenue-fields">
          {([
            ["ordersPerDay", "Заказов в день", "1"],
            ["days", "Дней прогноза", "1"],
            ["baselineAttachPercent", "Допродажи сейчас, %", "0.1"],
            ["proposedAttachPercent", "Допродажи по гипотезе, %", "0.1"],
            ["addOnPrice", "Цена дополнения, " + (catalog.currency === "TRY" ? "₺" : "₽"), "0.01"],
            ["addOnVariableCost", "Переменные затраты на дополнение, " + (catalog.currency === "TRY" ? "₺" : "₽"), "0.01"],
            ["campaignCost", "Расходы на тест/кампанию, " + (catalog.currency === "TRY" ? "₺" : "₽"), "0.01"],
          ] as const).map(([field, label, step]) => (
            <label className="revenue-field" key={field}>
              <span>{label}</span><input type="number" step={step} min="0" value={inputs[field]} onChange={(event) => update(field, event.target.value)} placeholder="Введите значение" />
            </label>
          ))}
        </div>
        <div className="revenue-actions">
          <button type="button" onClick={() => setInputs({ ordersPerDay: "100", days: "30", baselineAttachPercent: "15", proposedAttachPercent: "25", addOnPrice: "150", addOnVariableCost: "60", campaignCost: "3000" })}>Показать условный пример</button>
          <button type="button" onClick={() => setInputs({ ...emptyInputs })}>Очистить</button>
        </div>
        {error && <p className="revenue-error" role="alert">{error}</p>}
        {estimate ? (
          <div className="revenue-results" aria-live="polite">
            <div><small>Ожидаемых дополнительных дополнений</small><strong>{new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(estimate.expectedIncrementalUnits)}</strong></div>
            <div><small>Дополнительная выручка</small><strong>{formatPrice(estimate.incrementalRevenueMinor, catalog.currency)}</strong></div>
            <div><small>Дополнительный маржинальный вклад</small><strong>{formatPrice(estimate.incrementalContributionMinor, catalog.currency)}</strong></div>
          </div>
        ) : <p className="revenue-empty"><FileWarning size={17}/> Заполните все показатели или откройте условный пример, чтобы увидеть прогноз.</p>}
        <p className="revenue-footnote">Выбранная цена — рабочая цена из меню, не доказательство оплаченной продажи. Гипотеза: фиксированное число заказов, отсутствие каннибализации и изменений конверсии основного товара. Отрицательный вклад возможен. Средние значения прогнозные, не фактические. Налоги, аренда, зарплата и другие постоянные расходы не учтены. Для доказательства эффекта нужен POS и контролируемый тест.</p>
      </div>
    </section>
  );
}
