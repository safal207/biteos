import { useMemo, useState } from "react";
import { ArrowDownRight, FlaskConical, Layers2 } from "lucide-react";
import { catalogFor } from "./catalogIntelligence";
import { opportunitiesFor, selectedPair } from "./opportunityHypotheses";

const money = (minor: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: "TRY", maximumFractionDigits: 2,
  }).format(minor / 100);

export function OpportunityPlanner({
  businessId,
  onChooseAddOn,
}: {
  businessId: string;
  onChooseAddOn: (minor: number) => void;
}) {
  const catalog = useMemo(() => catalogFor(businessId), [businessId]);
  const examples = useMemo(() => opportunitiesFor(businessId), [businessId]);
  const [mainId, setMainId] = useState("");
  const [addOnId, setAddOnId] = useState("");
  const priced = catalog.items.filter((item) => item.priceMinor !== null);
  const pair = selectedPair(businessId, mainId, addOnId);

  if (catalog.status !== "working-menu-snapshot") return null;

  return (
    <section className="opportunity-planner" aria-labelledby="opportunity-title">
      <div className="opportunity-heading">
        <FlaskConical size={21} />
        <div>
          <span className="business-eyebrow">04 / OPPORTUNITY LAB</span>
          <h2 id="opportunity-title">Гипотезы продаж из твоего меню</h2>
        </div>
      </div>
      <p>Это идеи для проверки, а не сведения о том, что покупатели уже берут вместе. Цена пары — точная сумма введённых цен, без выдуманной скидки.</p>
      <div className="opportunity-grid">
        {examples.map((opportunity) => (
          <article className="opportunity-card" key={opportunity.id}>
            <span className="opportunity-tag">Гипотеза · не проверена</span>
            <h3>{opportunity.title}</h3>
            <div className="opportunity-items">
              <span>{opportunity.main.name} <b>{money(opportunity.main.priceMinor!)}</b></span>
              <span>+ {opportunity.addOn.name} <b>{money(opportunity.addOn.priceMinor!)}</b></span>
            </div>
            <div className="opportunity-total">
              <span>Вместе по ценам меню</span>
              <strong>{money(opportunity.fullPriceMinor)}</strong>
            </div>
            <p><b>Потребность проверить:</b> {opportunity.needToTest}</p>
            <p><b>Метрика:</b> {opportunity.metric}</p>
            <button
              type="button"
              onClick={() => onChooseAddOn(opportunity.incrementalPriceMinor)}
            >
              Цена дополнения в Revenue Lab <ArrowDownRight size={15} />
            </button>
          </article>
        ))}
      </div>
      <div className="opportunity-builder">
        <div className="opportunity-heading">
          <Layers2 size={20} />
          <div>
            <h3>Собрать свою пару</h3>
            <p>Выбери две любые позиции с указанной ценой. Ничего не добавится в настоящее меню или корзину.</p>
          </div>
        </div>
        <div className="opportunity-selects">
          <label>
            <span>Основное блюдо или напиток</span>
            <select value={mainId} onChange={(event) => setMainId(event.target.value)}>
              <option value="">Выбрать позицию</option>
              {priced.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.priceMinor!)}</option>)}
            </select>
          </label>
          <label>
            <span>Дополнение</span>
            <select value={addOnId} onChange={(event) => setAddOnId(event.target.value)}>
              <option value="">Выбрать дополнение</option>
              {priced.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.priceMinor!)}</option>)}
            </select>
          </label>
        </div>
        {pair ? (
          <div className="opportunity-custom-result" aria-live="polite">
            <span>{pair.main.name} + {pair.addOn.name}</span>
            <strong>{money(pair.fullPriceMinor)}</strong>
            <small>Дополнение: {money(pair.incrementalPriceMinor)}. Цена пары без скидки; прибыль зависит от затрат и спроса.</small>
            <button type="button" onClick={() => onChooseAddOn(pair.incrementalPriceMinor)}>
              Проверить дополнение в Revenue Lab <ArrowDownRight size={15} />
            </button>
          </div>
        ) : (
          <p className="opportunity-hint" role="status">
            {mainId && addOnId
              ? "Выбери две разные позиции с указанными ценами."
              : "После выбора двух позиций покажем сумму по твоему меню."}
          </p>
        )}
      </div>
      <p className="opportunity-footnote">Проверка: показываем предложение части посетителей, другим — обычное меню; сравниваем завершённые чеки, долю добавлений и маржинальный вклад с учётом себестоимости. Без POS результат остаётся гипотезой.</p>
    </section>
  );
}
