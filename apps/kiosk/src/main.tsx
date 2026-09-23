import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowUpRight,
  Sandwich as Burger,
  Check,
  ChevronRight,
  Coffee,
  Flame,
  LayoutGrid,
  Leaf,
  Maximize,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Utensils,
  X,
} from "lucide-react";
import type {
  Catalog,
  Item,
  Mode,
  Offer,
  Order,
  Product,
  Quote,
} from "./types";
import { api, money, IS_DEMO } from "./types";
import {
  applyKioskOffer,
  cheaperKioskFallback,
  filterNativeKioskGateOffers,
  kioskGateCandidates,
  kioskOfferCost,
  kioskOfferKey,
  readConfiguredKioskOffers,
  recordKioskOfferEvent,
} from "./kioskOfferFlow";
import { DeliveryApp } from "./DeliveryApp";
import "@fontsource-variable/manrope";
import "./styles.css";

function Food({
  index,
  className = "",
}: {
  index: number;
  className?: string;
}) {
  return (
    <div className={`food food-${index} ${className}`} aria-hidden="true" />
  );
}
function ComboFood({
  product,
  side,
  drink,
}: {
  product: Product;
  side: Product;
  drink: Product;
}) {
  return (
    <div className="combo-food" aria-hidden="true">
      <Food index={product.image} className="combo-main" />
      <Food index={side.image} className="combo-side" />
      <Food index={drink.image} className="combo-drink" />
    </div>
  );
}
function Modal({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        className="icon-button close"
        aria-label="Закрыть"
        onClick={onClose}
      >
        <X size={23} />
      </button>
      {children}
    </dialog>
  );
}
function Customize({
  product: p,
  catalog,
  onClose,
  onAdd,
  initialCombo,
}: {
  product: Product;
  catalog: Catalog;
  onClose: () => void;
  onAdd: (item: Item) => void;
  initialCombo: boolean;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const side = catalog.products.find((p) => p.id === catalog.combo.sideId)!;
  const drink = catalog.products.find((p) => p.id === catalog.combo.drinkId)!;
  const comboAvailable = side.available && drink.available;
  const [combo, setCombo] = useState(initialCombo && comboAvailable);
  const delta = side.price + drink.price - catalog.combo.discount;
  const total =
    p.price +
    catalog.options
      .filter((o) => options.includes(o.id))
      .reduce((sum, o) => sum + o.price, 0) +
    (combo ? delta : 0);
  return (
    <Modal onClose={onClose} label={`Настроить ${p.name}`}>
      <div className="customize">
        <div className="product-visual">
          <span className="eyebrow">СОБЕРИ ПО-СВОЕМУ</span>
          {combo ? (
            <ComboFood product={p} side={side} drink={drink} />
          ) : (
            <Food index={p.image} />
          )}
          <span className="nutrition">
            {combo
              ? "Бургер + гарнир + напиток"
              : `${p.weight} · ${p.kcal} ккал`}
          </span>
        </div>
        <div className="customize-body">
          <span className="eyebrow orange">ТВОЙ ВКУС. ТВОИ ПРАВИЛА.</span>
          <h2>
            {p.name}
            {combo ? " комбо" : ""}
          </h2>
          <p>{p.description}</p>
          {combo && (
            <div className="combo-includes">
              <b>В комбо входят</b>
              <ul>
                {[p, side, drink].map((part) => (
                  <li key={part.id}>
                    <Check size={14} aria-hidden="true" />
                    {part.name} <span>{part.weight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.options.length > 0 && (
            <>
              <h3>Сделаем ещё вкуснее?</h3>
              <div className="options">
                {catalog.options
                  .filter((o) => p.options.includes(o.id))
                  .map((o) => (
                    <label
                      key={o.id}
                      className={
                        options.includes(o.id) ? "option selected" : "option"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={options.includes(o.id)}
                        onChange={() =>
                          setOptions((prev) =>
                            prev.includes(o.id)
                              ? prev.filter((x) => x !== o.id)
                              : [...prev, o.id],
                          )
                        }
                      />
                      <span>{o.name}</span>
                      <b>{o.price ? `+ ${money(o.price)}` : "Бесплатно"}</b>
                    </label>
                  ))}
              </div>
            </>
          )}
          {p.category === "burgers" && comboAvailable && (
            <label className={`combo-choice ${combo ? "selected" : ""}`}>
              <input
                type="checkbox"
                checked={combo}
                onChange={(e) => setCombo(e.target.checked)}
              />
              <div>
                <b>{combo ? "Комбо выбрано" : "А давай комбо?"}</b>
                <small>
                  Фри + кола · экономия {money(catalog.combo.discount)}
                </small>
              </div>
              <strong>+ {money(delta)}</strong>
            </label>
          )}
          <div className="allergen-note">
            Состав и аллергены уточняйте у сотрудника. Изображения
            иллюстративные.
          </div>
          <button
            className="primary full"
            onClick={() =>
              onAdd({
                productId: p.id,
                quantity: 1,
                optionIds: options.sort(),
                combo,
              })
            }
          >
            <span>Добавить в заказ</span>
            <b>
              {money(total)} <Plus size={19} />
            </b>
          </button>
        </div>
      </div>
    </Modal>
  );
}

const categories = [
  { id: "popular", name: "Популярное", icon: Flame },
  { id: "burgers", name: "Бургеры", icon: Burger },
  { id: "combo", name: "Комбо", icon: Package },
  { id: "sides", name: "Снэки", icon: LayoutGrid },
  { id: "drinks", name: "Напитки", icon: Coffee },
];

type PricedKioskOffer = {
  offer: Offer;
  items: Item[];
  quote: Quote;
  delta: number;
};
type KioskOfferGate = {
  attemptId: string;
  baseTotal: number;
  active: PricedKioskOffer;
  fallback: PricedKioskOffer | null;
  step: 0 | 1;
};

function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState("popular");
  const [mode, setMode] = useState<Mode>("dine-in");
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<{
    product: Product;
    combo: boolean;
  } | null>(null);
  const [priced, setPriced] = useState<{
    fingerprint: string;
    quote: Quote;
  } | null>(null);
  const [offers, setOffers] = useState<{
    fingerprint: string;
    values: Offer[];
  } | null>(null);
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [offerGate, setOfferGate] = useState<KioskOfferGate | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [idleWarning, setIdleWarning] = useState(false);
  const lastAction = useRef(Date.now());
  const orderKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const fingerprint = JSON.stringify({ items, mode });
  const fingerprintRef = useRef(fingerprint);
  fingerprintRef.current = fingerprint;
  const gateSeen = useRef(new Set<string>());
  const gateRequest = useRef(0);
  const gateDecisionKey = useRef<string | null>(null);
  const quote = priced?.fingerprint === fingerprint ? priced.quote : null;
  const currentOffers =
    offers?.fingerprint === fingerprint ? offers.values : [];
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const cartRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  function loadMenu() {
    setLoadError(false);
    api<Catalog>("menu")
      .then(setCatalog)
      .catch(() => setLoadError(true));
  }
  useEffect(loadMenu, []);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setOffers(null);
    api<Quote>("quote", { items, mode }, controller.signal)
      .then((quote) => setPriced({ fingerprint, quote }))
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e.message || "Не удалось рассчитать заказ");
      });
    if (items.length)
      api<{ offers: Offer[] }>(
        "recommendations",
        { items, mode },
        controller.signal,
      )
        .then((x) => setOffers({ fingerprint, values: x.offers }))
        .catch(() => {});
    return () => controller.abort();
  }, [fingerprint]); // fingerprint includes all price-affecting input
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  function reset() {
    setItems([]);
    setSelected(null);
    setCheckout(false);
    setOfferGate(null);
    setGateLoading(false);
    gateSeen.current.clear();
    gateRequest.current++;
    gateDecisionKey.current = null;
    setOrder(null);
    setCategory("popular");
    setMode("dine-in");
    setIdleWarning(false);
    setError("");
    orderKey.current = null;
    lastAction.current = Date.now();
  }
  useEffect(() => {
    const touch = () => {
      lastAction.current = Date.now();
      setIdleWarning(false);
    };
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    const timer = setInterval(() => {
      if ((items.length || order) && !busy && !gateLoading) {
        const elapsed = Date.now() - lastAction.current;
        if (elapsed > 180000) reset();
        else if (elapsed > 160000) setIdleWarning(true);
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [items.length, order, busy, gateLoading]);

  function add(item: Item) {
    if (count >= 50) {
      setToast("В одном заказе — до 50 блюд");
      return;
    }
    const idx = items.findIndex(
      (i) =>
        i.productId === item.productId &&
        i.combo === item.combo &&
        JSON.stringify(i.optionIds) === JSON.stringify(item.optionIds),
    );
    if (idx >= 0 && items[idx].quantity >= 20) {
      setToast("До 20 одинаковых блюд в заказе");
      return;
    }
    setItems((prev) =>
      idx >= 0
        ? prev.map((x, i) =>
            i === idx ? { ...x, quantity: x.quantity + 1 } : x,
          )
        : [...prev, item],
    );
    setSelected(null);
    setToast("Добавлено. Отличный выбор!");
  }
  function changeQuantity(index: number, delta: number) {
    setItems((prev) =>
      prev
        .map((item, i) =>
          i === index ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((i) => i.quantity > 0),
    );
  }
  function acceptOffer(offer: Offer) {
    if (offer.kind === "combo" && offer.itemIndex !== null) {
      setItems((prev) =>
        prev.map((item, i) =>
          i === offer.itemIndex ? { ...item, combo: true } : item,
        ),
      );
      setToast("Готово! Теперь это комбо.");
    } else
      add({
        productId: offer.productId,
        quantity: 1,
        optionIds: [],
        combo: false,
      });
  }
  async function openCheckout() {
    if (!catalog || !quote || !items.length || gateLoading) return;
    const cartKey = JSON.stringify(items);
    if (gateSeen.current.has(cartKey)) {
      setCheckout(true);
      return;
    }
    const requestId = ++gateRequest.current;
    const requestFingerprint = fingerprint;
    const baseTotal = quote.total;
    const requestItems = items;
    const requestMode = mode;
    const requestCatalog = catalog;
    setGateLoading(true);
    try {
      const priceSuggestions = async (suggestions: Offer[]) => {
        const results = await Promise.all(
          suggestions.slice(0, 2).map(async (offer) => {
            const nextItems = applyKioskOffer(requestItems, offer);
            if (!nextItems || kioskOfferCost(requestItems, offer) === null)
              return null;
            try {
              const nextQuote = await api<Quote>("quote", {
                items: nextItems,
                mode: requestMode,
              });
              const delta = nextQuote.total - baseTotal;
              if (!Number.isSafeInteger(delta) || delta <= 0) return null;
              return { offer, items: nextItems, quote: nextQuote, delta };
            } catch {
              return null;
            }
          }),
        );
        return results.filter(
          (candidate): candidate is PricedKioskOffer => candidate !== null,
        );
      };
      const nativeSuggestions = async () => {
        if (offers?.fingerprint === requestFingerprint) return offers.values;
        try {
          return (
            await api<{ offers: Offer[] }>("recommendations", {
              items: requestItems,
              mode: requestMode,
            })
          ).offers;
        } catch {
          return [];
        }
      };
      const configured = readConfiguredKioskOffers(
        requestCatalog,
        requestItems,
      );
      const native = await nativeSuggestions();
      let valid = await priceSuggestions(
        kioskGateCandidates(requestCatalog, requestItems, configured, native),
      );
      if (configured.length && !valid.length)
        valid = await priceSuggestions(
          filterNativeKioskGateOffers(native, requestItems),
        );
      if (
        requestId !== gateRequest.current ||
        requestFingerprint !== fingerprintRef.current
      )
        return;
      if (!valid.length) {
        setCheckout(true);
        return;
      }
      const fallbackChoice = cheaperKioskFallback(valid);
      const fallback = fallbackChoice
        ? (valid.find(
            (candidate) => candidate.offer === fallbackChoice.offer,
          ) ?? null)
        : null;
      const attemptId = crypto.randomUUID();
      gateSeen.current.add(cartKey);
      gateDecisionKey.current = null;
      recordKioskOfferEvent({
        type: "shown",
        offerKey: kioskOfferKey(valid[0].offer),
        attemptId,
        at: Date.now(),
      });
      setOfferGate({
        attemptId,
        baseTotal,
        active: valid[0],
        fallback,
        step: 0,
      });
    } catch {
      if (
        requestId === gateRequest.current &&
        requestFingerprint === fingerprintRef.current
      )
        setCheckout(true);
    } finally {
      if (requestId === gateRequest.current) setGateLoading(false);
    }
  }
  function declineGate(showFallback: boolean) {
    if (!offerGate) return;
    const decisionKey = `${offerGate.attemptId}:${offerGate.step}`;
    if (gateDecisionKey.current === decisionKey) return;
    gateDecisionKey.current = decisionKey;
    recordKioskOfferEvent({
      type: "declined",
      offerKey: kioskOfferKey(offerGate.active.offer),
      attemptId: offerGate.attemptId,
      at: Date.now(),
    });
    if (showFallback && offerGate.step === 0 && offerGate.fallback) {
      recordKioskOfferEvent({
        type: "shown",
        offerKey: kioskOfferKey(offerGate.fallback.offer),
        attemptId: offerGate.attemptId,
        at: Date.now(),
      });
      setOfferGate({
        ...offerGate,
        active: offerGate.fallback,
        fallback: null,
        step: 1,
      });
    } else {
      setOfferGate(null);
      setCheckout(true);
    }
  }
  function acceptGate() {
    if (!offerGate) return;
    const decisionKey = `${offerGate.attemptId}:${offerGate.step}`;
    if (gateDecisionKey.current === decisionKey) return;
    gateDecisionKey.current = decisionKey;
    recordKioskOfferEvent({
      type: "accepted",
      offerKey: kioskOfferKey(offerGate.active.offer),
      attemptId: offerGate.attemptId,
      at: Date.now(),
    });
    gateSeen.current.add(JSON.stringify(offerGate.active.items));
    setItems(offerGate.active.items);
    setOfferGate(null);
    setCheckout(true);
  }
  async function submit() {
    if (busy || !quote) return;
    setBusy(true);
    setError("");
    if (orderKey.current?.fingerprint !== fingerprint)
      orderKey.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const result = await api<Order>(
        "orders",
        { items, mode },
        undefined,
        orderKey.current.key,
      );
      setOrder(result);
      setCheckout(false);
      setItems([]);
      lastAction.current = Date.now();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Не удалось оформить заказ. Повторите попытку.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setToast("Полный экран недоступен в этом окне");
    }
  }

  if (!catalog)
    return (
      <main className="loading">
        <div className="brand">
          bite<span>os</span>
          <i />
        </div>
        <h1>
          {loadError ? "Меню пока недоступно" : "Готовим кое-что вкусное…"}
        </h1>
        <p>
          {loadError
            ? IS_DEMO
              ? "Обновите страницу или проверьте подключение к интернету."
              : "Проверьте, запущен ли сервер BiteOS."
            : "Ещё одно мгновение"}
        </p>
        {loadError && (
          <button className="primary" onClick={loadMenu}>
            Попробовать снова
          </button>
        )}
      </main>
    );
  const comboSide = catalog.products.find(
    (p) => p.id === catalog.combo.sideId,
  )!;
  const comboDrink = catalog.products.find(
    (p) => p.id === catalog.combo.drinkId,
  )!;
  const comboAvailable = comboSide.available && comboDrink.available;
  const comboDelta =
    comboSide.price + comboDrink.price - catalog.combo.discount;
  const products = catalog.products.filter(
    (p) =>
      category === "popular" ||
      (category === "combo"
        ? p.category === "burgers"
        : p.category === category),
  );
  const title =
    category === "popular"
      ? "Любовь с первого укуса"
      : category === "combo"
        ? "Вместе вкуснее"
        : categories.find((c) => c.id === category)!.name;
  const gateProduct = offerGate
    ? catalog.products.find((p) => p.id === offerGate.active.offer.productId)
    : null;
  const gateQuantity =
    offerGate?.active.offer.kind === "combo"
      ? (items[offerGate.active.offer.itemIndex!]?.quantity ?? 1)
      : 1;
  const visibleOffers =
    offers?.fingerprint === fingerprint && items.length
      ? kioskGateCandidates(
          catalog,
          items,
          readConfiguredKioskOffers(catalog, items),
          currentOffers,
        )
      : [];

  return (
    <div className="app-shell">
      <header className="header">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="BiteOS — главная"
        >
          bite<span>os</span>
          <i />
        </a>
        <div className="location">
          <span className="status-dot" />
          ГОРЯЧЕЕ. СВЕЖЕЕ. ТВОЁ.
        </div>
        <div className="header-end">
          <a className="kiosk-delivery-link" href="#delivery">
            Доставка <ArrowUpRight size={15} />
          </a>
          <span className="demo-label">
            {IS_DEMO ? "ОНЛАЙН-ДЕМО" : "ДЕМО-КИОСК"}
          </span>
          <button
            className="icon-button"
            aria-label="Полный экран"
            onClick={fullscreen}
          >
            <Maximize size={19} />
          </button>
        </div>
      </header>
      <nav className="rail" aria-label="Категории меню">
        <div className="rail-label">МЕНЮ</div>
        {categories.map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${category === id ? "active" : ""}`}
            aria-pressed={category === id}
            onClick={() => {
              setCategory(id);
              menuRef.current?.scrollIntoView({ block: "start" });
            }}
          >
            <Icon size={25} strokeWidth={1.65} />
            <span>{name}</span>
          </button>
        ))}
        <div className="rail-bottom">
          <Leaf size={24} />
          <span>
            Хороший день
            <br />
            начинается
            <br />
            со вкуса.
          </span>
        </div>
      </nav>
      <main className="menu" ref={menuRef}>
        <div className="welcome">
          <div>
            <span className="eyebrow">ПРИВЕТ, ГОЛОДНЫЙ ДРУГ</span>
            <h1>
              Ну что, перекусим<span>?</span>
            </h1>
          </div>
          <span className="menu-note">Выбирай. Добавляй. Наслаждайся.</span>
        </div>
        {category === "popular" &&
          comboAvailable &&
          catalog.products[0].available && (
            <section className="hero">
              <div className="hero-copy">
                <span className="hero-label">
                  <Sparkles size={14} /> СОБРАНО ДЛЯ ТЕБЯ
                </span>
                <h2>
                  Двойной смэш.
                  <br />
                  Двойное <em>да.</em>
                </h2>
                <p>
                  Сочный бургер, хрустящий фри
                  <br />и холодная кола. Идеальное трио.
                </p>
                <button
                  className="hero-cta"
                  onClick={() =>
                    setSelected({ product: catalog.products[0], combo: true })
                  }
                >
                  Хочу комбо{" "}
                  <span>
                    {money(catalog.products[0].price + comboDelta)}{" "}
                    <ArrowUpRight size={20} />
                  </span>
                </button>
              </div>
              <div className="hero-art">
                <div className="orbit" />
                <Food index={0} />
                <span className="hero-stamp">
                  ВМЕСТЕ
                  <br />
                  <b>−{money(catalog.combo.discount)}</b>
                  <br />
                  ВЫГОДНЕЕ
                </span>
              </div>
              <div className="hero-index">
                01 <span>/ 01</span>
              </div>
            </section>
          )}
        <section className="products-section">
          <div className="section-heading">
            <div>
              <h2>{title}</h2>
              <p>
                {category === "popular"
                  ? "Наши любимчики. Скоро станут и твоими."
                  : category === "combo"
                    ? "Бургер + картофель фри + кола. Скидка уже внутри."
                    : "Всё, что нужно для хорошего перерыва."}
              </p>
            </div>
            <span className="item-count">Блюд: {products.length}</span>
          </div>
          <div className="product-grid">
            {products.map((p) => (
              <button
                className="product-card"
                key={p.id}
                disabled={
                  !p.available || (category === "combo" && !comboAvailable)
                }
                onClick={() =>
                  setSelected({ product: p, combo: category === "combo" })
                }
                aria-label={`Выбрать ${p.name}${category === "combo" ? " комбо" : ""}`}
              >
                <div className="card-image">
                  <span className={`badge ${p.id === "smash" ? "hot" : ""}`}>
                    {!p.available || (category === "combo" && !comboAvailable)
                      ? "Скоро вернётся"
                      : category === "combo"
                        ? `Выгода ${money(catalog.combo.discount)}`
                        : p.badge}
                  </span>
                  {category === "combo" ? (
                    <ComboFood
                      product={p}
                      side={comboSide}
                      drink={comboDrink}
                    />
                  ) : (
                    <Food index={p.image} />
                  )}
                </div>
                <div className="card-body">
                  <div className="card-meta">
                    {category === "combo" ? "БУРГЕР + ФРИ + КОЛА" : p.weight}
                  </div>
                  <h3>
                    {p.name}
                    {category === "combo" ? " комбо" : ""}
                  </h3>
                  <p>
                    {category === "combo"
                      ? `${p.name}, ${comboSide.name.toLowerCase()} ${comboSide.weight} и ${comboDrink.name.toLowerCase()} ${comboDrink.weight}.`
                      : p.description}
                  </p>
                  <div className="card-bottom">
                    <div className="card-price">
                      {category === "combo" && (
                        <s
                          aria-label={`По отдельности ${money(p.price + comboSide.price + comboDrink.price)}`}
                        >
                          {money(p.price + comboSide.price + comboDrink.price)}
                        </s>
                      )}
                      <strong>
                        {money(
                          p.price + (category === "combo" ? comboDelta : 0),
                        )}
                      </strong>
                    </div>
                    <span className="add-button">
                      <Plus size={22} />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
        <footer className="menu-footer">
          <span>
            <Leaf size={14} /> Готовим после заказа
          </span>
          <span>Сделано со вкусом · BiteOS</span>
        </footer>
      </main>
      <aside className="cart" aria-label="Ваш заказ" ref={cartRef}>
        <div className="cart-heading">
          <h2>
            Твой заказ<span>{count.toString().padStart(2, "0")}</span>
          </h2>
          <ShoppingBag size={22} />
        </div>
        <div className="mode-toggle">
          <button
            aria-pressed={mode === "dine-in"}
            className={mode === "dine-in" ? "chosen" : ""}
            onClick={() => setMode("dine-in")}
          >
            <Utensils size={16} />В зале
          </button>
          <button
            aria-pressed={mode === "takeaway"}
            className={mode === "takeaway" ? "chosen" : ""}
            onClick={() => setMode("takeaway")}
          >
            <ShoppingBag size={16} />С собой
          </button>
        </div>
        <div className="cart-scroll">
          {items.length === 0 ? (
            <div className="empty-cart">
              <div className="bag-illustration">
                <ShoppingBag size={53} strokeWidth={1.2} />
                <span>+</span>
              </div>
              <h3>
                Пока пусто.
                <br />
                Но это ненадолго.
              </h3>
              <p>
                Добавь что-нибудь вкусное —<br />
                начнём с любимого бургера?
              </p>
              <button
                className="text-button"
                onClick={() =>
                  setSelected({ product: catalog.products[0], combo: false })
                }
              >
                Выбрать бургер <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="cart-items">
              {items.map((item, index) => {
                const p = catalog.products.find(
                  (p) => p.id === item.productId,
                )!;
                const extras = catalog.options.filter((o) =>
                  item.optionIds.includes(o.id),
                );
                const total =
                  (p.price +
                    extras.reduce((n, o) => n + o.price, 0) +
                    (item.combo ? comboDelta : 0)) *
                  item.quantity;
                return (
                  <div className="cart-item" key={`${index}-${p.id}`}>
                    <Food index={p.image} />
                    <div className="cart-item-info">
                      <h3>{p.name}</h3>
                      <p>
                        {item.combo ? "Комбо · фри + кола" : p.weight}
                        {extras.length
                          ? ` · ${extras.map((o) => o.name).join(", ")}`
                          : ""}
                      </p>
                      <div className="cart-item-bottom">
                        <div className="quantity">
                          <button
                            aria-label={`Убрать одну порцию ${p.name}, позиция ${index + 1}`}
                            onClick={() => changeQuantity(index, -1)}
                          >
                            <Minus size={14} />
                          </button>
                          <b>{item.quantity}</b>
                          <button
                            aria-label={`Добавить порцию ${p.name}, позиция ${index + 1}`}
                            disabled={item.quantity >= 20 || count >= 50}
                            onClick={() => changeQuantity(index, 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <strong>{money(total)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {visibleOffers.length > 0 && (
            <section className="recommendations">
              <span className="eyebrow">
                <Sparkles size={13} /> К ТВОЕМУ ЗАКАЗУ
              </span>
              {visibleOffers.map((offer, index) => {
                const p = catalog.products.find(
                  (p) => p.id === offer.productId,
                )!;
                return (
                  <button
                    className="offer"
                    key={index}
                    onClick={() => acceptOffer(offer)}
                  >
                    <Food index={offer.kind === "combo" ? 3 : p.image} />
                    <div>
                      <b>
                        {offer.kind === "combo" ? "Собрать в комбо" : p.name}
                      </b>
                      <small>{offer.reason}</small>
                      <strong>
                        + {money(offer.price)}
                        {offer.kind === "combo" ? " / порция" : ""}
                      </strong>
                    </div>
                    <Plus size={18} />
                  </button>
                );
              })}
            </section>
          )}
        </div>
        <div className="cart-summary">
          {quote && quote.discount > 0 && (
            <div className="savings">
              <span>Выгода с комбо</span>
              <b>−{money(quote.discount)}</b>
            </div>
          )}
          <div className="total">
            <span>Итого</span>
            <strong>{money(quote?.total ?? 0)}</strong>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button
            className="primary full"
            disabled={!count || !quote || gateLoading}
            onClick={openCheckout}
          >
            <span>
              {gateLoading
                ? "Подбираем к заказу…"
                : count && !quote
                  ? "Считаем заказ…"
                  : "К оформлению"}
            </span>
            <ArrowRight size={21} />
          </button>
          <p className="demo-note">Демозаказ · без списания денег</p>
          {count > 0 && (
            <button className="reset-button" onClick={reset}>
              <RotateCcw size={13} />
              Начать заново
            </button>
          )}
        </div>
      </aside>
      <button
        className="mobile-cart primary"
        onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth" })}
      >
        <ShoppingBag size={19} />
        <span>Твой заказ · {count}</span>
        <b>{money(quote?.total ?? 0)}</b>
      </button>
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {toast}
        </div>
      )}
      {selected && (
        <Customize
          product={selected.product}
          initialCombo={selected.combo}
          catalog={catalog}
          onClose={() => setSelected(null)}
          onAdd={add}
        />
      )}
      {offerGate && gateProduct && (
        <Modal
          label="Предложение перед оформлением"
          onClose={() => declineGate(false)}
        >
          <div className="checkout-offer">
            <span className="eyebrow orange">
              <Sparkles size={15} />{" "}
              {offerGate.step === 0 ? "К ТВОЕМУ ЗАКАЗУ" : "ВАРИАНТ ДЕШЕВЛЕ"}
            </span>
            <h2>
              {offerGate.active.offer.kind === "combo"
                ? "Сделаем комбо?"
                : `Добавим ${gateProduct.name.toLowerCase()}?`}
            </h2>
            <div className="checkout-offer-art">
              {offerGate.active.offer.kind === "combo" ? (
                <ComboFood
                  product={gateProduct}
                  side={comboSide}
                  drink={comboDrink}
                />
              ) : (
                <Food index={gateProduct.image} />
              )}
            </div>
            <p>{offerGate.active.offer.reason}</p>
            {offerGate.active.offer.kind === "combo" && (
              <p className="checkout-offer-detail">
                Комбо на {gateQuantity} порц. · в каждом бургер, фри и кола
              </p>
            )}
            <div className="checkout-offer-prices">
              <div>
                <span>Сейчас</span>
                <b>{money(offerGate.baseTotal)}</b>
              </div>
              <div>
                <span>
                  Доплата{gateQuantity > 1 ? ` за ${gateQuantity} порции` : ""}
                </span>
                <b>+{money(offerGate.active.delta)}</b>
              </div>
              <div className="checkout-offer-total">
                <span>Итого с предложением</span>
                <strong>{money(offerGate.active.quote.total)}</strong>
              </div>
            </div>
            <button className="primary full" onClick={acceptGate}>
              Добавить и оформить <ArrowRight size={19} />
            </button>
            <button
              className="text-button checkout-offer-decline"
              onClick={() => declineGate(true)}
            >
              {offerGate.step === 0 && offerGate.fallback
                ? "Нет, покажите вариант дешевле"
                : "Нет, к оформлению"}
            </button>
            {offerGate.step === 0 && offerGate.fallback && (
              <button
                className="text-button checkout-offer-skip"
                onClick={() => declineGate(false)}
              >
                Сразу к оформлению без предложения
              </button>
            )}
          </div>
        </Modal>
      )}
      {checkout && (
        <Modal
          label="Оформление демозаказа"
          onClose={() => {
            if (!busy) setCheckout(false);
          }}
        >
          <div className="checkout">
            <span className="eyebrow orange">ПОСЛЕДНИЙ ШТРИХ</span>
            <h2>Всё как ты любишь.</h2>
            <p>
              {mode === "dine-in"
                ? "Поедим здесь, в зале."
                : "Упакуем с собой."}
            </p>
            <div className="review-items">
              {items.map((i, index) => (
                <div key={index}>
                  <span>
                    {catalog.products.find((p) => p.id === i.productId)!.name}
                    {i.combo ? " · комбо" : ""}
                  </span>
                  <b>× {i.quantity}</b>
                </div>
              ))}
            </div>
            <div className="total">
              <span>К оплате в демо</span>
              <strong>{quote ? money(quote.total) : "Пересчитываем…"}</strong>
            </div>
            <div className="checkout-notice">
              <ShoppingBag size={22} />
              <p>
                {IS_DEMO
                  ? "Это демонстрация BiteOS. Заказ останется только в этой вкладке до обновления страницы. Деньги не спишутся, на кухню он не поступит."
                  : "Это демонстрация BiteOS. Заказ сохранится локально, деньги не спишутся и на кухню он не поступит."}
              </p>
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button
              className="primary full"
              disabled={busy || !quote}
              onClick={submit}
            >
              {busy ? "Сохраняем…" : "Оформить демозаказ"}
              <ArrowRight size={20} />
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setCheckout(false)}
            >
              Вернуться к меню
            </button>
          </div>
        </Modal>
      )}
      {order && (
        <Modal label="Заказ оформлен" onClose={reset}>
          <div className="success">
            <div className="success-icon">
              <Check size={34} />
            </div>
            <span className="eyebrow">ДЕМОЗАКАЗ ОФОРМЛЕН</span>
            <h2>Спасибо за аппетит!</h2>
            <p>Номер твоего заказа</p>
            <div className="order-number">
              {order.number.toString().padStart(3, "0")}
            </div>
            <p>
              Сумма: {money(order.quote.total)}
              <br />
              {IS_DEMO
                ? "Демо в этой вкладке. Заказ не отправлен, оплата не проводилась."
                : "Сохранено в BiteOS. Оплата не проводилась."}
            </p>
            <button className="primary full" onClick={reset}>
              Начать новый заказ
              <ChevronRight size={20} />
            </button>
          </div>
        </Modal>
      )}
      {idleWarning && !busy && (
        <div role="alert" className="idle-warning">
          <span>Ты ещё здесь? Через 20 секунд начнём новый заказ.</span>
          <button
            onClick={() => {
              lastAction.current = Date.now();
              setIdleWarning(false);
            }}
          >
            Продолжить
          </button>
        </div>
      )}
    </div>
  );
}
function BiteOS() {
  const [kiosk, setKiosk] = useState(location.hash === "#kiosk");
  useEffect(() => {
    const route = () => setKiosk(location.hash === "#kiosk");
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  return kiosk ? <App /> : <DeliveryApp />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BiteOS />
  </React.StrictMode>,
);
