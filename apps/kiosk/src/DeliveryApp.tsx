import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  checkoutOffers,
  comboOffer,
  cuisines,
  deliveryQuote,
  dishAvailable,
  dishPrice,
  preparationTime,
  stages,
  statusLabels,
} from "./delivery";
import { recommendRobys } from "./robysChoice";
import { readKioskOfferEvents } from "./kioskOfferFlow";
import type { ChoiceAnswers } from "./robysChoice";
import type {
  CartLine,
  CheckoutOffer,
  Cuisine,
  DeliveryOrder,
  Dish,
  Restaurant,
} from "./delivery";
import { useDelivery } from "./useDelivery";
import "./delivery.css";

type View = "browse" | "orders" | "restaurant" | "courier";
type Currency = "RUB" | "TRY";
type StoreType = "all" | "cafe" | "fastfood";
type OfferSession = {
  attemptId: string;
  cartKey: string;
  ruleId: string;
  step: 1 | 2;
};
const money = (minor: number, currency: Currency) =>
  `${new Intl.NumberFormat(currency === "TRY" ? "tr-TR" : "ru-RU", {
    maximumFractionDigits: 2,
  }).format(minor / 100)} ${currency === "TRY" ? "₺" : "₽"}`;
const dishImage = () => ({
  backgroundImage: `url('${import.meta.env.BASE_URL}images/food-sheet.png')`,
});
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const cartKey = (restaurantId: string | null, items: CartLine[]) =>
  `${restaurantId ?? ""}:${items
    .map((item) => `${item.productId}=${item.quantity}`)
    .sort()
    .join("|")}`;
const plural = (value: number, forms: [string, string, string]) => {
  const lastTwo = value % 100;
  const last = value % 10;
  return `${value} ${lastTwo >= 11 && lastTwo <= 14 ? forms[2] : last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2]}`;
};
const demoAddresses = [
  "Демо: Солнечная улица, 12, кв. 8",
  "Демо: проспект Мира, 5, офис 3",
  "Демо: Парковый переулок, 21",
];
const robyDemoAddresses = [
  "Демо: Газипаша, тестовая точка 1",
  "Демо: Газипаша, тестовая точка 2",
];
const preparationPresets = [5, 8, 10, 12, 15, 18, 20, 25, 30, 45, 60, 90, 120];
const menuSections = (restaurant: Restaurant) => {
  const sections: { title: string; dishes: Dish[] }[] = [];
  for (const dish of restaurant.dishes) {
    const title = dish.section ?? (dish.components ? "Комбо" : "");
    let section = sections.find((item) => item.title === title);
    if (!section) {
      section = { title, dishes: [] };
      sections.push(section);
    }
    section.dishes.push(dish);
  }
  return sections;
};

function Food({
  image,
  photo,
  className = "",
}: {
  image: number;
  photo?: string;
  className?: string;
}) {
  if (photo) {
    return (
      <img
        className={`delivery-photo ${className}`}
        src={`${import.meta.env.BASE_URL}${photo}`}
        alt=""
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={`food food-${image} ${className}`}
      style={dishImage()}
      aria-hidden="true"
    />
  );
}

function ComboVisual({ restaurant, dish }: { restaurant: Restaurant; dish: Dish }) {
  const parts = (dish.components ?? [])
    .map((id) => restaurant.dishes.find((item) => item.id === id))
    .filter((item): item is Dish => Boolean(item))
    .slice(0, 3);
  return (
    <div className="delivery-combo-visual" aria-hidden="true">
      {parts.map((part, index) => (
        <div className={`delivery-combo-visual-item part-${index + 1}`} key={part.id}>
          <Food image={part.image} photo={part.photo} />
        </div>
      ))}
    </div>
  );
}

function Status({ order }: { order: DeliveryOrder }) {
  const step = stages.indexOf(order.status);
  return (
    <div className="delivery-status">
      <span
        className={`delivery-status-pill ${order.status === "delivered" ? "is-done" : ""}`}
      >
        <span className="delivery-status-dot" />
        {statusLabels[order.status]}
      </span>
      {order.status !== "cancelled" && (
        <div
          className="delivery-progress"
          aria-label={`Этап доставки: ${statusLabels[order.status]}`}
        >
          {stages.map((stage, index) => (
            <span key={stage} className={index <= step ? "active" : ""} />
          ))}
        </div>
      )}
    </div>
  );
}

function PreparationTimer({ order, nowMs }: { order: DeliveryOrder; nowMs: number }) {
  if (order.status !== "preparing") return null;
  const clock = preparationTime(order, nowMs);
  if (!clock) {
    return (
      <div className="delivery-prep-timer is-expired">
        <span>ОРИЕНТИР КУХНИ</span>
        <p>Время приготовления уточняется у ресторана.</p>
      </div>
    );
  }
  const remaining = `${String(Math.floor(clock.remainingSeconds / 60)).padStart(2, "0")}:${String(clock.remainingSeconds % 60).padStart(2, "0")}`;
  return (
    <div className={`delivery-prep-timer ${clock.expired ? "is-expired" : ""}`}>
      <div className="delivery-prep-timer-head">
        <div>
          <span>ОРИЕНТИР КУХНИ</span>
          <p>{clock.expired ? "Плановое время вышло" : "Приготовление идёт"}</p>
        </div>
        <strong role="timer" aria-label={clock.expired ? "Плановое время приготовления вышло" : `До планового времени осталось ${remaining}`} aria-live="off">
          {remaining}
        </strong>
      </div>
      <div className="delivery-prep-timer-track" aria-hidden="true">
        <span style={{ width: `${clock.progressPercent}%` }} />
      </div>
      <small>
        {clock.expired
          ? "Ждём, когда ресторан подтвердит готовность."
          : `Примерно ${order.prepDurationMinutes} мин от начала готовки. Готовность подтвердит ресторан.`}
      </small>
    </div>
  );
}

function OrderCard({
  order,
  nowMs,
  children,
}: {
  order: DeliveryOrder;
  nowMs: number;
  children?: React.ReactNode;
}) {
  const created = new Date(order.createdAt).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <article className="delivery-order-card">
      <div className="delivery-order-top">
        <div>
          <span className="delivery-kicker">
            ЗАКАЗ #{String(order.number).padStart(3, "0")}
          </span>
          <h3>{order.restaurantName}</h3>
        </div>
        <time dateTime={order.createdAt}>{created}</time>
      </div>
      <Status order={order} />
      <PreparationTimer order={order} nowMs={nowMs} />
      <p className="delivery-order-route">
        <Store size={16} /> Выдача: {order.pickup}
      </p>
      <p className="delivery-order-route">
        <MapPin size={16} /> Доставка: {order.address}
      </p>
      <div className="delivery-order-items">
        {order.lines.map((line, index) => (
          <span key={`${line.name}-${index}`}>
            {line.quantity} × {line.name}
          </span>
        ))}
      </div>
      <div className="delivery-order-bottom">
        <strong>{money(order.total, order.currency)}</strong>
        {children}
      </div>
    </article>
  );
}

export function DeliveryApp() {
  const { state, dispatch, error, canReset, resetDemo, pending, clearError } =
    useDelivery();
  const [view, setView] = useState<View>("browse");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cuisine, setCuisine] = useState<Cuisine | "all">("all");
  const [storeType, setStoreType] = useState<StoreType>("all");
  const [cartRestaurantId, setCartRestaurantId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [address, setAddress] = useState(demoAddresses[0]);
  const [notice, setNotice] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [offerSession, setOfferSession] = useState<OfferSession | null>(null);
  const [declinedOffers, setDeclinedOffers] = useState<Record<string, string[]>>(
    {},
  );
  const [declinedPriceCeilings, setDeclinedPriceCeilings] = useState<
    Record<string, number>
  >({});
  const [completedOfferCartKey, setCompletedOfferCartKey] = useState<string | null>(
    null,
  );
  const offerBusyRef = useRef(false);
  const [managerId, setManagerId] = useState("");
  const [showRestaurantForm, setShowRestaurantForm] = useState(false);
  const [showDishForm, setShowDishForm] = useState(false);
  const [courierId, setCourierId] = useState("courier-anna");
  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    description: "",
    cuisine: "burgers" as Cuisine,
    currency: "RUB" as Currency,
    address: "",
    deliveryFee: "99",
    minimum: "250",
    eta: "30",
    prepMinutes: "12",
  });
  const [dishForm, setDishForm] = useState({
    name: "",
    description: "",
    price: "",
    image: "0",
  });
  const [offerForm, setOfferForm] = useState({ triggerId: "", addOnId: "" });
  const [choiceAnswers, setChoiceAnswers] = useState<ChoiceAnswers>({
    intent: "coffee",
    temperature: "any",
    taste: "any",
    partySize: "one",
    budget: 25000,
  });
  const [choiceDone, setChoiceDone] = useState(false);
  const cartRef = useRef<HTMLElement>(null);
  const [cartInView, setCartInView] = useState(false);

  useEffect(() => {
    if (view !== "browse" || !cartRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCartInView(entry.isIntersecting),
      { threshold: 0.08 },
    );
    observer.observe(cartRef.current);
    return () => observer.disconnect();
  }, [view]);

  useEffect(() => {
    if (
      (view !== "orders" && view !== "restaurant") ||
      !state.orders.some((order) => order.status === "preparing")
    ) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [view, state.orders]);

  const selected = state.restaurants.find(
    (restaurant) => restaurant.id === selectedId,
  );
  const manager =
    state.restaurants.find((restaurant) => restaurant.id === managerId) ??
    state.restaurants[0];
  const cartRestaurant = state.restaurants.find(
    (restaurant) => restaurant.id === cartRestaurantId,
  );
  const filtered = useMemo(
    () =>
      state.restaurants.filter((restaurant) => {
        const term = search.trim().toLocaleLowerCase("ru-RU");
        return (
          (storeType === "all" ||
            (storeType === "cafe"
              ? restaurant.cuisine === "cafe"
              : restaurant.cuisine !== "cafe")) &&
          (cuisine === "all" || restaurant.cuisine === cuisine) &&
          (!term ||
            `${restaurant.name} ${restaurant.description} ${restaurant.dishes.map((dish) => dish.name).join(" ")}`
              .toLocaleLowerCase("ru-RU")
              .includes(term))
        );
      }),
    [state.restaurants, search, cuisine, storeType],
  );
  const choice = useMemo(
    () =>
      selected?.id === "robys-coffee-house" && selected.open && choiceDone
        ? recommendRobys(selected, choiceAnswers)
        : null,
    [selected, choiceAnswers, choiceDone],
  );
  const quote = useMemo(() => {
    if (!cartRestaurant || !cart.length) return null;
    try {
      return deliveryQuote(cartRestaurant, cart);
    } catch {
      return null;
    }
  }, [cartRestaurant, cart]);
  const offer = cartRestaurant ? comboOffer(cartRestaurant, cart) : null;
  const offerQuantity = offer ? (cart[offer.index]?.quantity ?? 0) : 0;
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const currentCartKey = cartKey(cartRestaurantId, cart);
  const checkoutCandidates = useMemo(
    () => (cartRestaurant && quote ? checkoutOffers(cartRestaurant, cart) : []),
    [cartRestaurant, cart, quote],
  );
  const pairedOffers = useMemo(() => {
    if (!cartRestaurant || !quote) return [];
    const pairs = new Map<string, CheckoutOffer>();
    for (const line of cart) {
      const withoutLine = cart.filter((item) => item.productId !== line.productId);
      const existingPair = checkoutOffers(cartRestaurant, withoutLine).find(
        (candidate) => candidate.dish.id === line.productId,
      );
      if (existingPair) pairs.set(existingPair.dish.id, existingPair);
    }
    for (const candidate of checkoutCandidates) {
      if (!pairs.has(candidate.dish.id)) pairs.set(candidate.dish.id, candidate);
    }
    return [...pairs.values()].slice(0, 2);
  }, [cartRestaurant, cart, quote, checkoutCandidates]);
  const activeCheckoutOffer =
    offerSession?.cartKey === currentCartKey
      ? checkoutCandidates.find((candidate) =>
          candidate.rule.id === offerSession.ruleId,
        )
      : null;
  const managerOfferEvents = state.offerEvents.filter(
    (event) => event.restaurantId === manager?.id,
  );
  const offerStat = (type: "shown" | "accepted" | "declined") =>
    managerOfferEvents.filter((event) => event.type === type).length;
  const managerOfferDishes =
    manager?.dishes.filter(
      (dish) =>
        !dish.components &&
        dishAvailable(manager, dish) &&
        (!dish.choice || dish.choice.sourceStatus === "confirmed"),
    ) ?? [];
  const offerTriggerId = managerOfferDishes.some(
    (dish) => dish.id === offerForm.triggerId,
  )
    ? offerForm.triggerId
    : (managerOfferDishes[0]?.id ?? "");
  const offerAddOnId = managerOfferDishes.some(
    (dish) => dish.id === offerForm.addOnId && dish.id !== offerTriggerId,
  )
    ? offerForm.addOnId
    : (managerOfferDishes.find((dish) => dish.id !== offerTriggerId)?.id ?? "");
  const offerPairExists =
    manager?.offerRules.some(
      (rule) =>
        rule.triggerId === offerTriggerId && rule.addOnId === offerAddOnId,
    ) ?? false;
  const kioskOfferEvents =
    manager?.id === "bite-burger" ? readKioskOfferEvents() : [];
  const kioskOfferStat = (type: "shown" | "accepted" | "declined") =>
    kioskOfferEvents.filter((event) => event.type === type).length;

  function go(next: View) {
    clearError();
    setNotice("");
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function resetLocalDemo() {
    if (
      !window.confirm(
        "Сбросить демоданные? Рестораны и заказы этой вкладки исчезнут без возможности восстановления.",
      )
    )
      return;
    if (resetDemo()) {
      setCart([]);
      setCartRestaurantId(null);
      setOfferSession(null);
      setDeclinedOffers({});
      setDeclinedPriceCeilings({});
      setCompletedOfferCartKey(null);
      setSelectedId(null);
      setManagerId("");
      go("browse");
      setNotice("Демоданные этой вкладки сброшены.");
    }
  }
  function changeCart(restaurant: Restaurant, dish: Dish, amount: number) {
    if (offerBusyRef.current) return;
    if (amount > 0 && !restaurant.open) {
      setNotice("Ресторан сейчас закрыт");
      return;
    }
    if (amount > 0 && !dishAvailable(restaurant, dish)) {
      setNotice("Это блюдо сейчас недоступно");
      return;
    }
    if (
      amount > 0 &&
      cartRestaurantId &&
      cartRestaurantId !== restaurant.id &&
      cart.length
    ) {
      setNotice(
        `В корзине блюда ресторана «${cartRestaurant?.name}». Очистите корзину, чтобы заказать здесь.`,
      );
      return;
    }
    if (amount > 0 && !cart.length) {
      setAddress(
        restaurant.id === "robys-coffee-house"
          ? robyDemoAddresses[0]
          : demoAddresses[0],
      );
    }
    setNotice("");
    setOfferSession(null);
    setCheckout(false);
    setCartRestaurantId(restaurant.id);
    setCart((previous) => {
      const current = previous.find((line) => line.productId === dish.id);
      const quantity = (current?.quantity ?? 0) + amount;
      if (
        quantity > 20 ||
        (amount > 0 &&
          previous.reduce((sum, line) => sum + line.quantity, 0) + amount > 50)
      ) {
        setNotice(
          "В заказе может быть до 20 порций одного блюда и 50 порций всего",
        );
        return previous;
      }
      if (quantity <= 0)
        return previous.filter((line) => line.productId !== dish.id);
      if (current)
        return previous.map((line) =>
          line.productId === dish.id ? { ...line, quantity } : line,
        );
      return [...previous, { productId: dish.id, quantity }];
    });
  }
  function takeCombo() {
    if (!offer || !cartRestaurant || offerBusyRef.current) return;
    setOfferSession(null);
    setCheckout(false);
    setCart((previous) =>
      previous.map((line, index) =>
        index === offer.index ? { ...line, productId: offer.combo.id } : line,
      ),
    );
    setNotice(
      `Комбо добавлено. Экономия ${money((offer.combo.discount ?? 0) * offerQuantity, cartRestaurant.currency)}!`,
    );
  }
  async function recordOfferEvent(
    restaurantId: string,
    ruleId: string,
    type: "shown" | "accepted" | "declined",
    attemptId: string,
  ) {
    return dispatch({
      type: "offer.record",
      event: {
        id: makeId("offer-event"),
        restaurantId,
        ruleId,
        type,
        attemptId,
        at: Date.now(),
      },
    });
  }
  async function startCheckout() {
    if (
      !cartRestaurant ||
      !quote ||
      quote.missing > 0 ||
      !cart.length ||
      pending ||
      offerBusyRef.current
    )
      return;
    if (completedOfferCartKey === currentCartKey) {
      setCheckout(true);
      return;
    }
    const declined = declinedOffers[currentCartKey] ?? [];
    const priceCeiling = declinedPriceCeilings[currentCartKey];
    const candidate = checkoutCandidates.find(
      (item) =>
        !declined.includes(item.rule.id) &&
        (priceCeiling === undefined || item.price < priceCeiling),
    );
    if (!candidate) {
      setCheckout(true);
      return;
    }
    const attemptId = makeId("offer-attempt");
    offerBusyRef.current = true;
    try {
      const recorded = await recordOfferEvent(
        cartRestaurant.id,
        candidate.rule.id,
        "shown",
        attemptId,
      );
      if (recorded) {
        setOfferSession({
          attemptId,
          cartKey: currentCartKey,
          ruleId: candidate.rule.id,
          step: 1,
        });
      }
    } finally {
      offerBusyRef.current = false;
    }
  }
  async function acceptCheckoutOffer() {
    if (
      !cartRestaurant ||
      !offerSession ||
      !activeCheckoutOffer ||
      offerBusyRef.current
    )
      return;
    offerBusyRef.current = true;
    try {
      const recorded = await recordOfferEvent(
        cartRestaurant.id,
        activeCheckoutOffer.rule.id,
        "accepted",
        offerSession.attemptId,
      );
      if (!recorded) return;
      const nextCart = [
        ...cart,
        { productId: activeCheckoutOffer.dish.id, quantity: 1 },
      ];
      setCart(nextCart);
      setCompletedOfferCartKey(cartKey(cartRestaurant.id, nextCart));
      setOfferSession(null);
      setCheckout(true);
      setNotice(`${activeCheckoutOffer.dish.name} добавлено: 1 порция.`);
    } finally {
      offerBusyRef.current = false;
    }
  }
  async function declineCheckoutOffer(showFallback = true) {
    if (
      !cartRestaurant ||
      !offerSession ||
      !activeCheckoutOffer ||
      offerBusyRef.current
    )
      return;
    offerBusyRef.current = true;
    try {
      const recorded = await recordOfferEvent(
        cartRestaurant.id,
        activeCheckoutOffer.rule.id,
        "declined",
        offerSession.attemptId,
      );
      if (!recorded) return;
      const declined = [
        ...new Set([
          ...(declinedOffers[currentCartKey] ?? []),
          activeCheckoutOffer.rule.id,
        ]),
      ];
      setDeclinedOffers((previous) => ({
        ...previous,
        [currentCartKey]: declined,
      }));
      setDeclinedPriceCeilings((previous) => ({
        ...previous,
        [currentCartKey]: Math.min(
          previous[currentCartKey] ?? Number.POSITIVE_INFINITY,
          activeCheckoutOffer.price,
        ),
      }));
      const fallback =
        showFallback && offerSession.step === 1
          ? checkoutCandidates.find(
              (item) =>
                item.price < activeCheckoutOffer.price &&
                !declined.includes(item.rule.id),
            )
          : null;
      if (fallback) {
        const shown = await recordOfferEvent(
          cartRestaurant.id,
          fallback.rule.id,
          "shown",
          offerSession.attemptId,
        );
        if (shown) {
          setOfferSession({ ...offerSession, ruleId: fallback.rule.id, step: 2 });
          return;
        }
      }
      setOfferSession(null);
      setCompletedOfferCartKey(currentCartKey);
      setCheckout(true);
    } finally {
      offerBusyRef.current = false;
    }
  }
  async function placeOrder() {
    if (!cartRestaurant || !quote || quote.missing || !cart.length) return;
    const ok = await dispatch({
      type: "order.place",
      restaurantId: cartRestaurant.id,
      id: makeId("order"),
      items: cart,
      address,
      note: "",
    });
    if (ok) {
      setCart([]);
      setCartRestaurantId(null);
      setCheckout(false);
      setOfferSession(null);
      setCompletedOfferCartKey(null);
      go("orders");
      setNotice("Заказ оформлен! Следи за его статусом здесь.");
    }
  }
  async function addRestaurant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = makeId("restaurant");
    const ok = await dispatch({
      type: "restaurant.add",
      id,
      input: {
        name: restaurantForm.name,
        description: restaurantForm.description,
        cuisine: restaurantForm.cuisine,
        currency: restaurantForm.currency,
        address: restaurantForm.address,
        deliveryFee: Math.round(Number(restaurantForm.deliveryFee) * 100),
        minimum: Math.round(Number(restaurantForm.minimum) * 100),
        eta: Number(restaurantForm.eta),
        prepMinutes: Number(restaurantForm.prepMinutes),
      },
    });
    if (ok) {
      setManagerId(id);
      setShowRestaurantForm(false);
      setRestaurantForm({
        name: "",
        description: "",
        cuisine: "burgers",
        currency: "RUB",
        address: "",
        deliveryFee: "99",
        minimum: "250",
        eta: "30",
        prepMinutes: "12",
      });
      setNotice("Ресторан добавлен. Теперь добавь блюда в его меню.");
    }
  }
  async function addDish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manager) return;
    const ok = await dispatch({
      type: "dish.add",
      restaurantId: manager.id,
      id: makeId("dish"),
      input: {
        name: dishForm.name,
        description: dishForm.description,
        price: Math.round(Number(dishForm.price) * 100),
        image: Number(dishForm.image),
      },
    });
    if (ok) {
      setShowDishForm(false);
      setDishForm({ name: "", description: "", price: "", image: "0" });
      setNotice("Блюдо появилось в меню ресторана.");
    }
  }
  async function addOfferRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manager || !offerTriggerId || !offerAddOnId) return;
    const ok = await dispatch({
      type: "offer.add",
      restaurantId: manager.id,
      id: makeId("offer-rule"),
      triggerId: offerTriggerId,
      addOnId: offerAddOnId,
    });
    if (ok) setNotice("Пара добавлена. Предложение появится перед оформлением заказа.");
  }

  return (
    <div className="delivery-app">
      <aside className="delivery-sidebar">
        <a
          className="delivery-brand"
          href={import.meta.env.BASE_URL}
          aria-label="BiteOS — доставка"
        >
          bite<span>os</span>
          <i />
        </a>
        <div className="delivery-sidebar-caption">
          КАФЕ И ФАСТФУД · ТРИ РОЛИ
        </div>
        <nav aria-label="Разделы доставки" className="delivery-nav">
          <button
            className={view === "browse" ? "is-active" : ""}
            onClick={() => go("browse")}
          >
            <UtensilsCrossed size={20} />
            <span>Заказать еду</span>
          </button>
          <button
            className={view === "orders" ? "is-active" : ""}
            onClick={() => go("orders")}
          >
            <ShoppingBag size={20} />
            <span>Мои заказы</span>
            {state.orders.length > 0 && <b>{state.orders.length}</b>}
          </button>
          <button
            className={view === "restaurant" ? "is-active" : ""}
            onClick={() => go("restaurant")}
          >
            <Store size={20} />
            <span>Ресторану</span>
          </button>
          <button
            className={view === "courier" ? "is-active" : ""}
            onClick={() => go("courier")}
          >
            <Bike size={20} />
            <span>Курьеру</span>
          </button>
        </nav>
        <div className="delivery-sidebar-bottom">
          <div className="delivery-sidebar-orb">
            <Flame size={22} />
          </div>
          <strong>Горячее в пути.</strong>
          <span>От кухни до двери — каждый шаг на виду.</span>
          <a href="#kiosk">
            Открыть меню на табло <ArrowRight size={15} />
          </a>
        </div>
      </aside>

      <div className="delivery-body">
        <header className="delivery-topbar">
          <div>
            <span className="delivery-live" />
            <span>ДЕМО ДОСТАВКИ</span>
            <span className="delivery-topbar-separator">/</span>
            <strong>
              {view === "browse"
                ? "Рестораны"
                : view === "orders"
                  ? "Мои заказы"
                  : view === "restaurant"
                    ? "Кабинет ресторана"
                    : "Кабинет курьера"}
            </strong>
          </div>
          <a href="#kiosk">
            МЕНЮ НА ТАБЛО <ArrowRight size={16} />
          </a>
        </header>
        {(error || notice || canReset) && (
          <div
            className={`delivery-alert ${error ? "is-error" : ""}`}
            role="status"
          >
            <span>
              {error || notice || "Демоданные этой вкладки нужно восстановить."}
            </span>
            {canReset && (
              <button className="delivery-reset" onClick={resetLocalDemo}>
                Сбросить демоданные
              </button>
            )}
            <button
              aria-label="Закрыть сообщение"
              onClick={() => {
                clearError();
                setNotice("");
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {view === "browse" && (
          <main className="delivery-main delivery-market">
            {!selected ? (
              <>
                <section className="delivery-hero">
                  <div className="delivery-hero-copy">
                    <span className="delivery-hero-eyebrow">
                      <Sparkles size={16} /> ЕДА, КОТОРАЯ РЯДОМ
                    </span>
                    <h1>
                      Вкусное
                      <br />
                      <em>уже в пути.</em>
                    </h1>
                    <p>
                      Выбирай между кафе Roby’s и фастфудом. Смотри меню,
                      собирай комбо и пробуй умный выбор в демо.
                    </p>
                    <a href="#delivery-restaurants">
                      Выбрать заведение <ArrowRight size={19} />
                    </a>
                  </div>
                  <div className="delivery-hero-art">
                    <div className="delivery-hero-circle" />
                    <Food image={0} />
                    <span>
                      ЕЩЁ
                      <br />
                      ГОРЯЧЕЕ
                    </span>
                  </div>
                </section>
                <div
                  className="delivery-section-head"
                  id="delivery-restaurants"
                >
                  <div>
                    <span className="delivery-kicker">КАФЕ И ФАСТФУД</span>
                    <h2>Что закажем сегодня?</h2>
                    <p>
                      Roby’s в Газипаше и демофастфуд. Валюты и цены показаны
                      отдельно.
                    </p>
                  </div>
                  <span className="delivery-count">
                    {plural(filtered.length, [
                      "заведение",
                      "заведения",
                      "заведений",
                    ])}
                  </span>
                </div>
                <div
                  className="delivery-store-types"
                  role="group"
                  aria-label="Выбор типа заведения"
                >
                  {(
                    [
                      ["all", "Все заведения", "Кафе и фастфуд"],
                      ["cafe", "Кафе", "Roby’s Coffee House"],
                      ["fastfood", "Фастфуд", "Бургеры, курица и гриль"],
                    ] as const
                  ).map(([type, label, detail]) => (
                    <button
                      key={type}
                      className={storeType === type ? "active" : ""}
                      aria-pressed={storeType === type}
                      onClick={() => {
                        setStoreType(type);
                        setCuisine("all");
                      }}
                    >
                      <strong>{label}</strong>
                      <small>{detail}</small>
                    </button>
                  ))}
                </div>
                <div className="delivery-filterbar">
                  <label className="delivery-search">
                    <Search size={19} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Ресторан или блюдо"
                      aria-label="Поиск ресторанов и блюд"
                    />
                  </label>
                  <div className="delivery-chips" aria-label="Тип кухни">
                    <button
                      className={cuisine === "all" ? "active" : ""}
                      onClick={() => setCuisine("all")}
                    >
                      Все
                    </button>
                    {(Object.keys(cuisines) as Cuisine[])
                      .filter(
                        (key) =>
                          storeType === "all" ||
                          (storeType === "cafe"
                            ? key === "cafe"
                            : key !== "cafe"),
                      )
                      .map((key) => (
                        <button
                          key={key}
                          className={cuisine === key ? "active" : ""}
                          onClick={() => setCuisine(key)}
                        >
                          {cuisines[key]}
                        </button>
                      ))}
                  </div>
                </div>
                <div className="delivery-restaurants">
                  {filtered.map((restaurant) => (
                    <button
                      className="delivery-restaurant-card"
                      key={restaurant.id}
                      onClick={() => {
                        setSelectedId(restaurant.id);
                        setCheckout(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <div className="delivery-restaurant-art">
                        <Food
                          image={restaurant.dishes[0]?.image ?? 0}
                          photo={
                            restaurant.photo ?? restaurant.dishes[0]?.photo
                          }
                        />
                        <span
                          className={
                            restaurant.open
                              ? "delivery-open"
                              : "delivery-closed"
                          }
                        >
                          {restaurant.open ? "Открыт" : "Закрыт"}
                        </span>
                      </div>
                      <div className="delivery-restaurant-info">
                        <span className="delivery-kicker">
                          {cuisines[restaurant.cuisine]}
                        </span>
                        <h3>{restaurant.name}</h3>
                        <p>{restaurant.description}</p>
                        <div className="delivery-restaurant-meta">
                          {restaurant.id === "robys-coffee-house" ? (
                            <span>Демо · условия доставки не заданы</span>
                          ) : (
                            <>
                              <span>
                                <Clock3 size={15} /> ~{restaurant.eta} мин
                              </span>
                              <span>
                                Доставка{" "}
                                {money(
                                  restaurant.deliveryFee,
                                  restaurant.currency,
                                )}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="delivery-card-arrow">
                        <ArrowRight size={20} />
                      </span>
                    </button>
                  ))}
                </div>
                {!filtered.length && (
                  <div className="delivery-empty">
                    <Search size={30} />
                    <h3>Не нашли ресторан</h3>
                    <p>Попробуй другой запрос или кухню.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  className="delivery-back"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft size={17} /> Все рестораны
                </button>
                <section
                  className={`delivery-restaurant-banner ${selected.cuisine === "cafe" ? "is-cafe" : ""}`}
                >
                  <div>
                    <span className="delivery-kicker">
                      {cuisines[selected.cuisine]} ·{" "}
                      {selected.open ? "ПРИНИМАЕМ ЗАКАЗЫ" : "СЕЙЧАС ЗАКРЫТ"}
                    </span>
                    <h1>{selected.name}</h1>
                    <p>{selected.description}</p>
                    <div>
                      {selected.id === "robys-coffee-house" ? (
                        <span>Демо · без реальной доставки</span>
                      ) : (
                        <span>
                          <Clock3 size={16} /> ~{selected.eta} мин
                        </span>
                      )}
                      <span>
                        <MapPin size={16} /> {selected.address}
                      </span>
                    </div>
                  </div>
                  <Food
                    image={selected.dishes[0]?.image ?? 0}
                    photo={selected.photo ?? selected.dishes[0]?.photo}
                  />
                </section>
                {selected.id === "robys-coffee-house" && (
                  <section
                    className="delivery-smart-choice"
                    aria-labelledby="delivery-smart-title"
                  >
                    <div className="delivery-smart-heading">
                      <div>
                        <span className="delivery-kicker">
                          <Sparkles size={15} /> SMART CHOICE · ROBY’S
                        </span>
                        <h2 id="delivery-smart-title">
                          Не знаешь, что выбрать?
                        </h2>
                        <p>
                          Ответь на пять вопросов. Подберём позиции из
                          доступного меню Roby’s в пределах твоего бюджета. Для
                          двоих и семьи считаем нужное число порций.
                        </p>
                      </div>
                      <span className="delivery-smart-count">5 вопросов</span>
                    </div>
                    <div className="delivery-smart-fields">
                      <label>
                        <span>
                          <b>01</b> Что хочется?
                        </span>
                        <select
                          value={choiceAnswers.intent}
                          onChange={(event) => {
                            setChoiceAnswers({
                              ...choiceAnswers,
                              intent: event.target
                                .value as ChoiceAnswers["intent"],
                            });
                            setChoiceDone(false);
                          }}
                        >
                          <option value="coffee">Кофе</option>
                          <option value="breakfast">Завтрак</option>
                          <option value="snack">Перекус</option>
                          <option value="dessert">Десерт</option>
                          <option value="refresh">Освежиться</option>
                        </select>
                      </label>
                      <label>
                        <span>
                          <b>02</b> Температура?
                        </span>
                        <select
                          value={choiceAnswers.temperature}
                          onChange={(event) => {
                            setChoiceAnswers({
                              ...choiceAnswers,
                              temperature: event.target
                                .value as ChoiceAnswers["temperature"],
                            });
                            setChoiceDone(false);
                          }}
                        >
                          <option value="any">Неважно</option>
                          <option value="hot">Горячее</option>
                          <option value="cold">Холодное</option>
                        </select>
                      </label>
                      <label>
                        <span>
                          <b>03</b> Какой вкус?
                        </span>
                        <select
                          value={choiceAnswers.taste}
                          onChange={(event) => {
                            setChoiceAnswers({
                              ...choiceAnswers,
                              taste: event.target
                                .value as ChoiceAnswers["taste"],
                            });
                            setChoiceDone(false);
                          }}
                        >
                          <option value="any">Любой</option>
                          <option value="sweet">Сладкий</option>
                          <option value="neutral">Нейтральный</option>
                          <option value="savoury">Несладкий</option>
                        </select>
                      </label>
                      <label>
                        <span>
                          <b>04</b> На сколько человек?
                        </span>
                        <select
                          value={choiceAnswers.partySize}
                          onChange={(event) => {
                            setChoiceAnswers({
                              ...choiceAnswers,
                              partySize: event.target
                                .value as ChoiceAnswers["partySize"],
                            });
                            setChoiceDone(false);
                          }}
                        >
                          <option value="one">На одного</option>
                          <option value="two">На двоих</option>
                          <option value="family">
                            Семья (пример: 3 порции)
                          </option>
                        </select>
                      </label>
                      <label>
                        <span>
                          <b>05</b> Бюджет?
                        </span>
                        <select
                          value={choiceAnswers.budget}
                          onChange={(event) => {
                            setChoiceAnswers({
                              ...choiceAnswers,
                              budget: Number(event.target.value),
                            });
                            setChoiceDone(false);
                          }}
                        >
                          <option value={25000}>До 250 ₺</option>
                          <option value={40000}>До 400 ₺</option>
                          <option value={60000}>До 600 ₺</option>
                          <option value={100000}>Гибкий бюджет</option>
                        </select>
                      </label>
                    </div>
                    <button
                      className="delivery-smart-submit"
                      disabled={!selected.open}
                      onClick={() => setChoiceDone(true)}
                    >
                      Подобрать из меню <ArrowRight size={17} />
                    </button>
                    {!selected.open && (
                      <p className="delivery-smart-closed">
                        Кафе сейчас закрыто для демозаказов.
                      </p>
                    )}
                    {choiceDone && selected.open && (
                      <div
                        className="delivery-smart-results"
                        aria-live="polite"
                      >
                        {choice &&
                        (choice.best || choice.economy || choice.premium) ? (
                          (
                            [
                              ["Лучший выбор", choice.best],
                              ["Подешевле", choice.economy],
                              ["Побаловать себя", choice.premium],
                            ] as const
                          ).map(
                            ([label, pick]) =>
                              pick && (
                                <article
                                  className="delivery-smart-pick"
                                  key={label}
                                >
                                  <Food
                                    image={pick.dish.image}
                                    photo={pick.dish.photo}
                                  />
                                  <div>
                                    <span className="delivery-kicker">
                                      {label}
                                    </span>
                                    <h3>{pick.dish.name}</h3>
                                    <p>{pick.reason}</p>
                                    <div>
                                      <strong>
                                        {pick.quantity > 1 && (
                                          <small className="delivery-smart-units">
                                            {pick.quantity} ×{" "}
                                            {money(
                                              pick.unitPrice,
                                              selected.currency,
                                            )}{" "}
                                            ={" "}
                                          </small>
                                        )}
                                        {money(pick.price, selected.currency)}
                                      </strong>
                                      <button
                                        onClick={() =>
                                          changeCart(
                                            selected,
                                            pick.dish,
                                            pick.quantity,
                                          )
                                        }
                                        aria-label={`Добавить ${pick.quantity} × ${pick.dish.name} из рекомендации`}
                                      >
                                        <Plus size={17} /> Добавить
                                      </button>
                                    </div>
                                  </div>
                                </article>
                              ),
                          )
                        ) : (
                          <p className="delivery-smart-empty">
                            Под этот бюджет и ответы сейчас нет доступных блюд.
                            Попробуй изменить выбор.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                )}
                <div className="delivery-section-head">
                  <div>
                    <span className="delivery-kicker">ВЫБИРАЙ СВОЁ</span>
                    <h2>Меню ресторана</h2>
                    {selected.id === "robys-coffee-house" ? (
                      <p>
                        Ориентировочные цены Roby’s в ₺. Оформление и доставка
                        здесь только демо; тариф кафе не указан.{" "}
                        <a
                          className="delivery-source-link"
                          href="https://safal207.github.io/robys-coffee-house-demo/menu.html"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Исходное меню Roby’s ↗
                        </a>
                      </p>
                    ) : (
                      <p>
                        Минимальный заказ{" "}
                        {money(selected.minimum, selected.currency)} · доставка{" "}
                        {money(selected.deliveryFee, selected.currency)}
                      </p>
                    )}
                  </div>
                  <span className="delivery-count">
                    {plural(selected.dishes.length, ["блюдо", "блюда", "блюд"])}
                  </span>
                </div>
                {menuSections(selected).map((section) => (
                  <section
                    className="delivery-menu-section"
                    key={section.title}
                  >
                    {section.title && (
                      <h3 className="delivery-menu-section-title">
                        {section.title}
                      </h3>
                    )}
                    <div className="delivery-dishes">
                      {section.dishes.map((dish) => {
                        const available =
                          selected.open && dishAvailable(selected, dish);
                        const comboParts = (dish.components ?? [])
                          .map((id) => selected.dishes.find((item) => item.id === id))
                          .filter((item): item is Dish => Boolean(item));
                        const isCombo = comboParts.length > 0;
                        const hasSavings = isCombo && (dish.discount ?? 0) > 0;
                        const quantity =
                          selected.id === cartRestaurantId
                            ? (cart.find((line) => line.productId === dish.id)
                                ?.quantity ?? 0)
                            : 0;
                        return (
                          <article
                            className={`delivery-dish ${isCombo ? "delivery-combo-card" : ""} ${available ? "" : "unavailable"}`}
                            key={dish.id}
                          >
                            <div className="delivery-dish-image">
                              {isCombo ? (
                                <ComboVisual restaurant={selected} dish={dish} />
                              ) : (
                                <Food image={dish.image} photo={dish.photo} />
                              )}
                              {hasSavings && (
                                <span className="delivery-combo-tag">
                                  ВЫГОДА −
                                  {money(dish.discount ?? 0, selected.currency)}
                                </span>
                              )}
                            </div>
                            <div className="delivery-dish-info">
                              {isCombo && (
                                <span className="delivery-combo-eyebrow">
                                  {hasSavings ? "КОМБО" : "СЕТ"} · ВСЁ ВМЕСТЕ
                                </span>
                              )}
                              <h3>{dish.name}</h3>
                              <p>{dish.description}</p>
                              {isCombo && (
                                <div className="delivery-combo-parts" aria-label="Состав набора">
                                  {comboParts.map((part) => (
                                    <span key={part.id}>{part.name}</span>
                                  ))}
                                </div>
                              )}
                              <div className="delivery-dish-bottom">
                                <div className="delivery-dish-price">
                                  {hasSavings && (
                                    <del>
                                      {money(
                                        comboParts.reduce((sum, part) => sum + dishPrice(selected, part), 0),
                                        selected.currency,
                                      )}
                                    </del>
                                  )}
                                  <strong>{money(dishPrice(selected, dish), selected.currency)}</strong>
                                </div>
                                {available ? (
                                  quantity ? (
                                    <div className="delivery-stepper">
                                      <button
                                        aria-label={`Убрать ${dish.name}`}
                                        onClick={() =>
                                          changeCart(selected, dish, -1)
                                        }
                                      >
                                        <Minus size={16} />
                                      </button>
                                      <b>{quantity}</b>
                                      <button
                                        aria-label={`Добавить ${dish.name}`}
                                        onClick={() =>
                                          changeCart(selected, dish, 1)
                                        }
                                      >
                                        <Plus size={16} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      className={`delivery-add ${isCombo ? "delivery-combo-add" : ""}`}
                                      onClick={() =>
                                        changeCart(selected, dish, 1)
                                      }
                                      aria-label={`Добавить ${dish.name}`}
                                    >
                                      <Plus size={20} />
                                      {isCombo && <span>В заказ</span>}
                                    </button>
                                  )
                                ) : (
                                  <span className="delivery-soldout">
                                    Недоступно
                                  </span>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
                {!selected.dishes.length && (
                  <div className="delivery-empty">
                    <UtensilsCrossed size={30} />
                    <h3>Меню скоро появится</h3>
                    <p>Ресторан ещё добавляет блюда.</p>
                  </div>
                )}
              </>
            )}
          </main>
        )}

        {view === "browse" && (
          <aside className="delivery-cart" ref={cartRef}>
            <div className="delivery-cart-heading">
              <div>
                <ShoppingBag size={22} />
                <h2>Твой заказ</h2>
              </div>
              <span>{count}</span>
            </div>
            {cart.length && cartRestaurant ? (
              <>
                <div className="delivery-cart-restaurant">
                  <span>ИЗ РЕСТОРАНА</span>
                  <strong>{cartRestaurant.name}</strong>
                </div>
                <div className="delivery-cart-lines">
                  {cart.map((line) => {
                    const dish = cartRestaurant.dishes.find(
                      (item) => item.id === line.productId,
                    );
                    if (!dish) return null;
                    return (
                      <article className="delivery-cart-line" key={line.productId}>
                        <Food image={dish.image} photo={dish.photo} />
                        <div className="delivery-cart-line-copy">
                          <strong>{dish.name}</strong>
                          <span>
                            {money(dishPrice(cartRestaurant, dish), cartRestaurant.currency)} за порцию
                          </span>
                        </div>
                        <div className="delivery-cart-line-bottom">
                          <strong>{money(dishPrice(cartRestaurant, dish) * line.quantity, cartRestaurant.currency)}</strong>
                          <div className="delivery-stepper">
                            <button
                              aria-label={`Убрать ${dish.name}`}
                              onClick={() => changeCart(cartRestaurant, dish, -1)}
                            >
                              <Minus size={15} />
                            </button>
                            <b>{line.quantity}</b>
                            <button
                              aria-label={`Добавить ${dish.name}`}
                              onClick={() => changeCart(cartRestaurant, dish, 1)}
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {offer && (
                  <section className="delivery-upsell" aria-label="Предложение комбо">
                    <div className="delivery-upsell-top">
                      <div className="delivery-upsell-media">
                        <Food image={offer.combo.image} photo={offer.combo.photo} />
                      </div>
                      <div>
                        <span className="delivery-upsell-kicker"><Sparkles size={13} /> СОБРАТЬ В КОМБО</span>
                        <h3>{offer.combo.name}</h3>
                        <p>
                          {offer.combo.components?.slice(1).map((id) =>
                            cartRestaurant.dishes.find((dish) => dish.id === id)?.name,
                          ).filter(Boolean).join(" + ")} к каждой порции
                        </p>
                      </div>
                    </div>
                    <div className="delivery-upsell-deal">
                      <span>Экономия {money((offer.combo.discount ?? 0) * offerQuantity, cartRestaurant.currency)}</span>
                      <strong>+{money(offer.extra * offerQuantity, cartRestaurant.currency)}</strong>
                    </div>
                    <button onClick={takeCombo}>
                      {offerQuantity === 1 ? "Заменить на комбо" : `Заменить ${plural(offerQuantity, ["порцию", "порции", "порций"])} на комбо`}
                      <ArrowRight size={16} />
                    </button>
                  </section>
                )}
                {!checkout && !activeCheckoutOffer && pairedOffers.length > 0 && (
                  <section className="delivery-pair-section" aria-label="Подходящие дополнения">
                    <div className="delivery-pair-heading">
                      <span><Sparkles size={15} /> СОЧЕТАЕТСЯ С ЗАКАЗОМ</span>
                      <p>Добавь к блюду или убери одним нажатием.</p>
                    </div>
                    <div className="delivery-pair-grid">
                      {pairedOffers.map((candidate) => {
                        const quantity = cart.find((line) => line.productId === candidate.dish.id)?.quantity ?? 0;
                        return (
                          <article className={`delivery-pair-card ${quantity ? "is-added" : ""}`} key={candidate.dish.id}>
                            <div className="delivery-pair-media" aria-hidden="true">
                              <Food image={candidate.trigger.image} photo={candidate.trigger.photo} />
                              <span><Plus size={15} /></span>
                              <Food image={candidate.dish.image} photo={candidate.dish.photo} />
                            </div>
                            <small>К «{candidate.trigger.name}» подойдёт</small>
                            <h3>{candidate.dish.name}</h3>
                            <div className="delivery-pair-foot">
                              <strong>+{money(candidate.price, cartRestaurant.currency)}</strong>
                              {quantity ? (
                                <div className="delivery-stepper">
                                  <button aria-label={`Убрать ${candidate.dish.name}`} onClick={() => changeCart(cartRestaurant, candidate.dish, -1)}><Minus size={14} /></button>
                                  <b>{quantity}</b>
                                  <button aria-label={`Добавить ${candidate.dish.name}`} onClick={() => changeCart(cartRestaurant, candidate.dish, 1)}><Plus size={14} /></button>
                                </div>
                              ) : (
                                <button className="delivery-pair-add" onClick={() => changeCart(cartRestaurant, candidate.dish, 1)} aria-label={`Добавить ${candidate.dish.name}`}><Plus size={15} /> Добавить</button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
                {quote ? (
                  <>
                    <div className="delivery-cart-totals">
                      <div>
                        <span>Блюда</span>
                        <strong>
                          {money(quote.subtotal, cartRestaurant.currency)}
                        </strong>
                      </div>
                      <div>
                        <span>
                          {cartRestaurant.id === "robys-coffee-house"
                            ? "Демо-доставка"
                            : "Доставка"}
                        </span>
                        <strong>
                          {money(quote.deliveryFee, cartRestaurant.currency)}
                        </strong>
                      </div>
                      <div className="delivery-grand-total">
                        <span>Итого</span>
                        <strong>
                          {money(quote.total, cartRestaurant.currency)}
                        </strong>
                      </div>
                    </div>
                    {cartRestaurant.id === "robys-coffee-house" && (
                      <p className="delivery-demo-hint">
                        0 ₺ за доставку здесь — значение демо, не тариф Roby’s.
                      </p>
                    )}
                    {quote.missing > 0 && (
                      <p className="delivery-minimum">
                        До минимального заказа ещё{" "}
                        {money(quote.missing, cartRestaurant.currency)}
                      </p>
                    )}
                    {checkout ? (
                      <div className="delivery-checkout">
                        <label>
                          Демоадрес доставки
                          <select
                            value={address}
                            onChange={(event) => setAddress(event.target.value)}
                          >
                            {(cartRestaurant.id === "robys-coffee-house"
                              ? robyDemoAddresses
                              : demoAddresses
                            ).map((place) => (
                              <option key={place} value={place}>
                                {place}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="delivery-demo-hint">
                          Это вымышленные адреса. Настоящий адрес вводить не
                          нужно.
                        </p>
                        <button
                          className="delivery-primary"
                          disabled={
                            pending ||
                            quote.missing > 0 ||
                            address.trim().length < 5
                          }
                          onClick={placeOrder}
                        >
                          Подтвердить демозаказ <ArrowRight size={18} />
                        </button>
                        <button
                          className="delivery-link-button"
                          onClick={() => setCheckout(false)}
                        >
                          Вернуться в корзину
                        </button>
                      </div>
                    ) : activeCheckoutOffer ? (
                      <section className="delivery-checkout-offer" aria-live="polite">
                        <span className="delivery-offer-kicker">
                          <Sparkles size={17} />
                          {offerSession?.step === 2
                            ? "ЕЩЁ ОДИН ВАРИАНТ"
                            : "ПОДОЙДЁТ К ЗАКАЗУ"}
                        </span>
                        <h3>Хорошая пара к «{activeCheckoutOffer.trigger.name}»</h3>
                        <div className="delivery-checkout-offer-dish">
                          <div className="delivery-checkout-pair-media" aria-hidden="true">
                            <Food image={activeCheckoutOffer.trigger.image} photo={activeCheckoutOffer.trigger.photo} />
                            <span><Plus size={15} /></span>
                            <Food image={activeCheckoutOffer.dish.image} photo={activeCheckoutOffer.dish.photo} />
                          </div>
                          <div>
                            <strong>{activeCheckoutOffer.dish.name}</strong>
                            <small>К {activeCheckoutOffer.trigger.name} · 1 порция · по желанию</small>
                          </div>
                        </div>
                        <div className="delivery-checkout-offer-prices">
                          <div>
                            <span>Доплата за 1 порцию</span>
                            <strong>
                              +{money(activeCheckoutOffer.price, cartRestaurant.currency)}
                            </strong>
                          </div>
                          <div>
                            <span>Новый итог с доставкой</span>
                            <strong>
                              {money(quote.total + activeCheckoutOffer.price, cartRestaurant.currency)}
                            </strong>
                          </div>
                        </div>
                        <button
                          className="delivery-primary"
                          disabled={pending}
                          onClick={() => void acceptCheckoutOffer()}
                        >
                          Добавить 1 порцию <Plus size={18} />
                        </button>
                        <button
                          className="delivery-offer-decline"
                          disabled={pending}
                          onClick={() => void declineCheckoutOffer()}
                        >
                          {offerSession?.step === 2
                            ? "Продолжить без дополнения"
                            : "Не подходит"}
                        </button>
                        {offerSession?.step === 1 && (
                          <button
                            className="delivery-link-button"
                            disabled={pending}
                            onClick={() => void declineCheckoutOffer(false)}
                          >
                            Сразу к оформлению
                          </button>
                        )}
                        {offerSession?.step === 1 && (
                          <p>
                            Если есть более доступное дополнение, покажем его
                            один раз.
                          </p>
                        )}
                        <button
                          className="delivery-link-button"
                          disabled={pending}
                          onClick={() => {
                            setCompletedOfferCartKey(currentCartKey);
                            setOfferSession(null);
                          }}
                        >
                          Вернуться в корзину
                        </button>
                      </section>
                    ) : (
                      <button
                        className="delivery-primary"
                        disabled={pending || quote.missing > 0}
                        onClick={() => void startCheckout()}
                      >
                        Оформить заказ <ArrowRight size={18} />
                      </button>
                    )}
                  </>
                ) : (
                  <p className="delivery-minimum">
                    Одно из блюд больше недоступно. Убери его из корзины.
                  </p>
                )}
                <button
                  className="delivery-clear"
                  onClick={() => {
                    setCart([]);
                    setCartRestaurantId(null);
                    setCheckout(false);
                    setOfferSession(null);
                  }}
                >
                  Очистить корзину
                </button>
              </>
            ) : (
              <div className="delivery-cart-empty">
                <div>
                  <ShoppingBag size={34} />
                </div>
                <h3>Пока пусто</h3>
                <p>
                  Выбери ресторан и добавь любимое блюдо. Мы сохраним всё здесь.
                </p>
              </div>
            )}
            <p className="delivery-cart-foot">
              Демо в этой вкладке: оплаты и реальной отправки заказа нет.
            </p>
          </aside>
        )}

        {view === "orders" && (
          <main className="delivery-main delivery-wide">
            <div className="delivery-page-head">
              <span className="delivery-kicker">НА СВЯЗИ С КУХНЕЙ</span>
              <h1>
                Твои заказы<span>.</span>
              </h1>
              <p>Следи, как еда проходит путь от ресторана до двери.</p>
            </div>
            {state.orders.length ? (
              <div className="delivery-order-grid">
                {state.orders.map((order) => (
                  <OrderCard order={order} nowMs={nowMs} key={order.id}>
                    {order.status === "new" && (
                      <button
                        className="delivery-outline"
                        disabled={pending}
                        onClick={() =>
                          void dispatch({
                            type: "order.cancel",
                            orderId: order.id,
                          })
                        }
                      >
                        Отменить
                      </button>
                    )}
                  </OrderCard>
                ))}
              </div>
            ) : (
              <div className="delivery-empty">
                <PackageCheck size={34} />
                <h3>Здесь появятся заказы</h3>
                <p>
                  Добавь блюда из ресторана, и мы покажем их путь до доставки.
                </p>
                <button
                  className="delivery-primary"
                  onClick={() => go("browse")}
                >
                  Выбрать ресторан <ArrowRight size={18} />
                </button>
              </div>
            )}
          </main>
        )}

        {view === "restaurant" && (
          <main className="delivery-main delivery-wide">
            <div className="delivery-page-head delivery-page-head-row">
              <div>
                <span className="delivery-kicker">ДЛЯ ПАРТНЁРОВ</span>
                <h1>
                  Кухня под контролем<span>.</span>
                </h1>
                <p>
                  Демо без входа в аккаунт: добавляй ресторан и блюда, отмечай
                  готовность заказа.
                </p>
              </div>
              <button
                className="delivery-primary"
                onClick={() => setShowRestaurantForm((value) => !value)}
              >
                <Plus size={18} /> Добавить ресторан
              </button>
            </div>
            {showRestaurantForm && (
              <form
                className="delivery-form delivery-panel"
                onSubmit={addRestaurant}
              >
                <h2>Новый ресторан</h2>
                <div className="delivery-form-grid">
                  <label>
                    Название
                    <input
                      required
                      minLength={2}
                      maxLength={60}
                      value={restaurantForm.name}
                      onChange={(event) =>
                        setRestaurantForm({
                          ...restaurantForm,
                          name: event.target.value,
                        })
                      }
                      placeholder="Например, Бургер №1"
                    />
                  </label>
                  <label>
                    Кухня
                    <select
                      value={restaurantForm.cuisine}
                      onChange={(event) => {
                        const nextCuisine = event.target.value as Cuisine;
                        setRestaurantForm({
                          ...restaurantForm,
                          cuisine: nextCuisine,
                          currency: nextCuisine === "cafe" ? "TRY" : "RUB",
                        });
                      }}
                    >
                      {(Object.keys(cuisines) as Cuisine[]).map((key) => (
                        <option value={key} key={key}>
                          {cuisines[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Валюта меню
                    <select
                      value={restaurantForm.currency}
                      onChange={(event) =>
                        setRestaurantForm({
                          ...restaurantForm,
                          currency: event.target.value as Currency,
                        })
                      }
                    >
                      <option value="RUB">Рубли (₽)</option>
                      <option value="TRY">Турецкие лиры (₺)</option>
                    </select>
                  </label>
                  <label className="delivery-span-2">
                    Короткое описание
                    <input
                      maxLength={180}
                      value={restaurantForm.description}
                      onChange={(event) =>
                        setRestaurantForm({
                          ...restaurantForm,
                          description: event.target.value,
                        })
                      }
                      placeholder="Чем кормите гостей"
                    />
                  </label>
                  <label className="delivery-span-2">
                    Демоадрес выдачи
                    <input
                      required
                      minLength={5}
                      maxLength={180}
                      value={restaurantForm.address}
                      onChange={(event) =>
                        setRestaurantForm({
                          ...restaurantForm,
                          address: event.target.value,
                        })
                      }
                      placeholder="Демо: улица Вкусная, 12"
                    />
                  </label>
                  <label>
                    Доставка, {restaurantForm.currency === "TRY" ? "₺" : "₽"}
                    <input
                      required
                      type="number"
                      min="0"
                      max="5000"
                      step="1"
                      value={restaurantForm.deliveryFee}
                      onChange={(event) =>
                        setRestaurantForm({
                          ...restaurantForm,
                          deliveryFee: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Мин. заказ, {restaurantForm.currency === "TRY" ? "₺" : "₽"}
                    <input
                      required
                      type="number"
                      min="0"
                      max="10000"
                      step="1"
                      value={restaurantForm.minimum}
                      onChange={(event) =>
                        setRestaurantForm({
                          ...restaurantForm,
                          minimum: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Доставка, мин
                    <input
                      required
                      type="number"
                      min="10"
                      max="180"
                      step="1"
                      value={restaurantForm.eta}
                      onChange={(event) =>
                        setRestaurantForm({
                          ...restaurantForm,
                          eta: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Приготовление, мин
                    <input
                      required
                      type="number"
                      min="5"
                      max="120"
                      step="1"
                      value={restaurantForm.prepMinutes}
                      onChange={(event) =>
                        setRestaurantForm({
                          ...restaurantForm,
                          prepMinutes: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <button
                  className="delivery-primary"
                  disabled={pending}
                  type="submit"
                >
                  Сохранить ресторан <ArrowRight size={18} />
                </button>
              </form>
            )}
            <div className="delivery-manager-toolbar">
              <label>
                Управлять рестораном
                <select
                  value={manager?.id ?? ""}
                  onChange={(event) => {
                    setManagerId(event.target.value);
                    setShowDishForm(false);
                  }}
                >
                  {state.restaurants.map((restaurant) => (
                    <option value={restaurant.id} key={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {manager && (
              <>
                <section className="delivery-manager-summary delivery-panel">
                  <div>
                    <span className="delivery-kicker">
                      {cuisines[manager.cuisine]}
                    </span>
                    <h2>{manager.name}</h2>
                    <p>
                      <MapPin size={16} /> {manager.address}
                    </p>
                  </div>
                  <button
                    className={`delivery-switch ${manager.open ? "is-on" : ""}`}
                    disabled={pending}
                    onClick={() =>
                      void dispatch({
                        type: "restaurant.toggle",
                        restaurantId: manager.id,
                      })
                    }
                  >
                    <span />
                    {manager.open ? "Принимает заказы" : "Закрыт для заказов"}
                  </button>
                </section>
                <section className="delivery-prep-setting delivery-panel">
                  <div>
                    <span className="delivery-kicker">ТАЙМЕР КУХНИ</span>
                    <h3>Ориентир приготовления</h3>
                    <p>
                      Отсчёт начнётся, когда ресторан нажмёт «Начать готовить».
                      Готовность отмечается отдельно.
                    </p>
                  </div>
                  <label>
                    Минут
                    <select
                      value={manager.prepMinutes}
                      disabled={pending}
                      onChange={(event) =>
                        void dispatch({
                          type: "restaurant.prepTime",
                          restaurantId: manager.id,
                          prepMinutes: Number(event.target.value),
                        })
                      }
                    >
                      {[...new Set([...preparationPresets, manager.prepMinutes])]
                        .sort((left, right) => left - right)
                        .map((minutes) => (
                          <option value={minutes} key={minutes}>
                            {minutes} мин
                          </option>
                        ))}
                    </select>
                  </label>
                  <small>Новая настройка не меняет уже запущенные отсчёты.</small>
                </section>
                <div className="delivery-manager-section-head">
                  <div>
                    <span className="delivery-kicker">В МЕНЮ</span>
                    <h2>
                      Блюда <span>{manager.dishes.length}</span>
                    </h2>
                  </div>
                  <button
                    className="delivery-outline"
                    onClick={() => setShowDishForm((value) => !value)}
                  >
                    <Plus size={17} /> Добавить блюдо
                  </button>
                </div>
                {showDishForm && (
                  <form
                    className="delivery-form delivery-panel"
                    onSubmit={addDish}
                  >
                    <h3>Новое блюдо</h3>
                    <div className="delivery-form-grid">
                      <label>
                        Название
                        <input
                          required
                          minLength={2}
                          maxLength={70}
                          value={dishForm.name}
                          onChange={(event) =>
                            setDishForm({
                              ...dishForm,
                              name: event.target.value,
                            })
                          }
                          placeholder="Название блюда"
                        />
                      </label>
                      <label>
                        Цена, {manager.currency === "TRY" ? "₺" : "₽"}
                        <input
                          required
                          type="number"
                          min="1"
                          max="100000"
                          step="1"
                          value={dishForm.price}
                          onChange={(event) =>
                            setDishForm({
                              ...dishForm,
                              price: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="delivery-span-2">
                        Описание
                        <input
                          maxLength={180}
                          value={dishForm.description}
                          onChange={(event) =>
                            setDishForm({
                              ...dishForm,
                              description: event.target.value,
                            })
                          }
                          placeholder="Состав и вкус"
                        />
                      </label>
                      <label>
                        Иллюстрация
                        <select
                          value={dishForm.image}
                          onChange={(event) =>
                            setDishForm({
                              ...dishForm,
                              image: event.target.value,
                            })
                          }
                        >
                          {[
                            "Бургер",
                            "Чикен",
                            "BBQ",
                            "Фри",
                            "Напиток",
                            "Наггетсы",
                          ].map((name, image) => (
                            <option value={image} key={image}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button
                      className="delivery-primary"
                      disabled={pending}
                      type="submit"
                    >
                      Добавить в меню <Plus size={18} />
                    </button>
                  </form>
                )}
                <div className="delivery-manager-dishes">
                  {manager.dishes.map((dish) => (
                    <div className="delivery-manager-dish" key={dish.id}>
                      <Food image={dish.image} photo={dish.photo} />
                      <div>
                        <strong>{dish.name}</strong>
                        <small>
                          {dish.components
                            ? (dish.discount ?? 0) > 0
                              ? "Комбо · "
                              : "Набор · "
                            : ""}
                          {money(dishPrice(manager, dish), manager.currency)}
                        </small>
                        {dish.components &&
                          dish.available &&
                          !dishAvailable(manager, dish) && (
                            <em className="delivery-component-warning">
                              Компоненты недоступны: комбо не продаётся
                            </em>
                          )}
                      </div>
                      <button
                        className={`delivery-availability ${dish.available ? "available" : ""}`}
                        disabled={pending}
                        onClick={() =>
                          void dispatch({
                            type: "dish.toggle",
                            restaurantId: manager.id,
                            productId: dish.id,
                          })
                        }
                      >
                        {dish.available ? "Включено" : "Скрыто"}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="delivery-manager-section-head">
                  <div>
                    <span className="delivery-kicker">ПЕРЕД ОФОРМЛЕНИЕМ</span>
                    <h2>
                      Подходящие дополнения <span>{manager.offerRules.length}</span>
                    </h2>
                  </div>
                </div>
                <section className="delivery-panel delivery-offer-manager">
                  <p className="delivery-muted">
                    Свяжи два блюда своего меню. Когда первое окажется в корзине,
                    гостю можно предложить одну порцию второго с точной доплатой.
                  </p>
                  <p className="delivery-demo-hint">
                    {manager.id === "bite-burger"
                      ? "На большом табло работают пары из исходного каталога Bite Burger. Пары с блюдами, добавленными вручную, пока работают только в доставке."
                      : "Для этого ресторана пары пока работают только в доставке; большое табло подключено к Bite Burger."}
                  </p>
                  <form className="delivery-offer-editor" onSubmit={addOfferRule}>
                    <label>
                      После блюда
                      <select
                        value={offerTriggerId}
                        disabled={managerOfferDishes.length < 2 || pending}
                        onChange={(event) =>
                          setOfferForm((previous) => ({
                            triggerId: event.target.value,
                            addOnId:
                              previous.addOnId === event.target.value
                                ? ""
                                : previous.addOnId,
                          }))
                        }
                      >
                        {managerOfferDishes.map((dish) => (
                          <option key={dish.id} value={dish.id}>
                            {dish.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Предложить дополнение
                      <select
                        value={offerAddOnId}
                        disabled={managerOfferDishes.length < 2 || pending}
                        onChange={(event) =>
                          setOfferForm((previous) => ({
                            ...previous,
                            addOnId: event.target.value,
                          }))
                        }
                      >
                        {managerOfferDishes
                          .filter((dish) => dish.id !== offerTriggerId)
                          .map((dish) => (
                            <option key={dish.id} value={dish.id}>
                              {dish.name} · {money(dishPrice(manager, dish), manager.currency)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <button
                      className="delivery-primary"
                      type="submit"
                      disabled={
                        pending ||
                        !offerTriggerId ||
                        !offerAddOnId ||
                        offerPairExists ||
                        manager.offerRules.length >= 30
                      }
                    >
                      Добавить пару <Plus size={18} />
                    </button>
                  </form>
                  {managerOfferDishes.length < 2 && (
                    <p className="delivery-demo-hint">
                      Для пары нужны хотя бы два доступных блюда, не комбо.
                    </p>
                  )}
                  {offerPairExists && (
                    <p className="delivery-demo-hint">Такая пара уже есть в списке.</p>
                  )}
                  <div className="delivery-offer-rules">
                    {manager.offerRules.map((rule) => {
                      const trigger = manager.dishes.find(
                        (dish) => dish.id === rule.triggerId,
                      );
                      const addOn = manager.dishes.find(
                        (dish) => dish.id === rule.addOnId,
                      );
                      const events = managerOfferEvents.filter(
                        (event) => event.ruleId === rule.id,
                      );
                      return (
                        <div className="delivery-offer-rule" key={rule.id}>
                          <div>
                            <strong>
                              {trigger?.name ?? "Блюдо удалено"} <ArrowRight size={14} />{" "}
                              {addOn?.name ?? "Дополнение удалено"}
                            </strong>
                            <small>
                              {addOn
                                ? `+${money(dishPrice(manager, addOn), manager.currency)} за 1 порцию`
                                : "Недоступно"}
                              {" · "}Показано {events.filter((event) => event.type === "shown").length}
                              {" · "}Добавлено {events.filter((event) => event.type === "accepted").length}
                            </small>
                          </div>
                          <div className="delivery-offer-rule-actions">
                            <button
                              className={`delivery-availability ${rule.active ? "available" : ""}`}
                              disabled={pending}
                              aria-label={`${rule.active ? "Выключить" : "Включить"} пару ${trigger?.name ?? ""} — ${addOn?.name ?? ""}`}
                              onClick={() =>
                                void dispatch({
                                  type: "offer.toggle",
                                  restaurantId: manager.id,
                                  ruleId: rule.id,
                                })
                              }
                            >
                              {rule.active ? "Включено" : "Выключено"}
                            </button>
                            <button
                              className="delivery-offer-remove"
                              disabled={pending}
                              aria-label={`Удалить пару ${trigger?.name ?? ""} — ${addOn?.name ?? ""}`}
                              onClick={() =>
                                void dispatch({
                                  type: "offer.remove",
                                  restaurantId: manager.id,
                                  ruleId: rule.id,
                                })
                              }
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!manager.offerRules.length && (
                      <p className="delivery-muted">Пары ещё не созданы.</p>
                    )}
                  </div>
                </section>
                <section className="delivery-offer-analytics delivery-panel">
                  <div>
                    <span className="delivery-kicker">ДЕМОСТАТИСТИКА ЭТОЙ ВКЛАДКИ</span>
                    <h3>Предложения перед оформлением · {manager.name}</h3>
                  </div>
                  <div className="delivery-offer-stats">
                    <div><span>Показано</span><strong>{offerStat("shown")}</strong></div>
                    <div><span>Добавлено</span><strong>{offerStat("accepted")}</strong></div>
                    <div><span>Отклонено</span><strong>{offerStat("declined")}</strong></div>
                    <div>
                      <span>Доля добавлений от показов</span>
                      <strong>
                        {offerStat("shown")
                          ? `${Math.round((offerStat("accepted") / offerStat("shown")) * 100)}%`
                          : "—"}
                      </strong>
                    </div>
                  </div>
                  <p className="delivery-demo-hint">
                    Здесь учтены предложения на шаге оформления. Карточки
                    сочетаний в корзине в эти счётчики не входят. Это не
                    оплаченные продажи. История включает удалённые пары.
                  </p>
                </section>
                {manager.id === "bite-burger" && (
                  <section className="delivery-offer-analytics delivery-panel">
                    <div>
                      <span className="delivery-kicker">ОТДЕЛЬНО · ДЕМО ЭТОЙ ВКЛАДКИ</span>
                      <h3>Предложения на большом табло</h3>
                    </div>
                    <div className="delivery-offer-stats">
                      <div><span>Показано</span><strong>{kioskOfferStat("shown")}</strong></div>
                      <div><span>Добавлено</span><strong>{kioskOfferStat("accepted")}</strong></div>
                      <div><span>Отклонено</span><strong>{kioskOfferStat("declined")}</strong></div>
                      <div>
                        <span>Доля добавлений от показов</span>
                        <strong>
                          {kioskOfferStat("shown")
                            ? `${Math.round((kioskOfferStat("accepted") / kioskOfferStat("shown")) * 100)}%`
                            : "—"}
                        </strong>
                      </div>
                    </div>
                    <p className="delivery-demo-hint">
                      Локальные действия на табло. Эти числа не смешиваются с
                      доставкой и не подтверждают оплату.
                    </p>
                  </section>
                )}
                <div className="delivery-manager-section-head">
                  <div>
                    <span className="delivery-kicker">НА КУХНЕ</span>
                    <h2>
                      Заказы{" "}
                      <span>
                        {
                          state.orders.filter(
                            (order) => order.restaurantId === manager.id,
                          ).length
                        }
                      </span>
                    </h2>
                  </div>
                </div>
                <div className="delivery-order-grid">
                  {state.orders
                    .filter((order) => order.restaurantId === manager.id)
                    .map((order) => (
                      <OrderCard order={order} nowMs={nowMs} key={order.id}>
                        {order.status === "new" && (
                          <button
                            className="delivery-primary"
                            disabled={pending}
                            onClick={() =>
                              void dispatch({
                                type: "order.prepare",
                                restaurantId: manager.id,
                                orderId: order.id,
                              })
                            }
                          >
                            Начать готовить <ChevronRight size={17} />
                          </button>
                        )}
                        {order.status === "preparing" && (
                          <button
                            className="delivery-primary"
                            disabled={pending}
                            onClick={() =>
                              void dispatch({
                                type: "order.ready",
                                restaurantId: manager.id,
                                orderId: order.id,
                              })
                            }
                          >
                            Готов к выдаче <Check size={17} />
                          </button>
                        )}
                      </OrderCard>
                    ))}
                </div>
                {!state.orders.some(
                  (order) => order.restaurantId === manager.id,
                ) && (
                  <p className="delivery-muted">
                    Пока нет заказов этого ресторана.
                  </p>
                )}
              </>
            )}
          </main>
        )}

        {view === "courier" && (
          <main className="delivery-main delivery-wide">
            <div className="delivery-page-head">
              <span className="delivery-kicker">РАБОТА В ДВИЖЕНИИ</span>
              <h1>
                Горячее в пути<span>.</span>
              </h1>
              <p>
                Демо без входа в аккаунт: выбери курьера и отмечай этапы
                доставки.
              </p>
            </div>
            <section className="delivery-courier-banner">
              <div className="delivery-courier-icon">
                <Bike size={33} />
              </div>
              <div>
                <span className="delivery-kicker">ТЫ НА СМЕНЕ</span>
                <h2>Кто сегодня доставляет?</h2>
              </div>
              <select
                value={courierId}
                onChange={(event) => setCourierId(event.target.value)}
                aria-label="Выбрать курьера"
              >
                <option value="courier-anna">Анна · курьер 01</option>
                <option value="courier-max">Макс · курьер 02</option>
              </select>
            </section>
            <div className="delivery-manager-section-head">
              <div>
                <span className="delivery-kicker">МОЖНО ЗАБРАТЬ</span>
                <h2>
                  Готовые заказы{" "}
                  <span>
                    {
                      state.orders.filter((order) => order.status === "ready")
                        .length
                    }
                  </span>
                </h2>
              </div>
            </div>
            <div className="delivery-order-grid">
              {state.orders
                .filter((order) => order.status === "ready")
                .map((order) => (
                  <OrderCard order={order} nowMs={nowMs} key={order.id}>
                    <button
                      className="delivery-primary"
                      disabled={pending}
                      onClick={() =>
                        void dispatch({
                          type: "order.claim",
                          courierId,
                          orderId: order.id,
                        })
                      }
                    >
                      Взять заказ <ArrowRight size={17} />
                    </button>
                  </OrderCard>
                ))}
            </div>
            {!state.orders.some((order) => order.status === "ready") && (
              <div className="delivery-empty">
                <Bike size={32} />
                <h3>Пока нет готовых заказов</h3>
                <p>Когда ресторан отметит заказ готовым, он появится здесь.</p>
              </div>
            )}
            <div className="delivery-manager-section-head">
              <div>
                <span className="delivery-kicker">ТВОЙ МАРШРУТ</span>
                <h2>
                  Мои доставки{" "}
                  <span>
                    {
                      state.orders.filter(
                        (order) =>
                          order.courierId === courierId &&
                          ["assigned", "picked-up"].includes(order.status),
                      ).length
                    }
                  </span>
                </h2>
              </div>
            </div>
            <div className="delivery-order-grid">
              {state.orders
                .filter(
                  (order) =>
                    order.courierId === courierId &&
                    ["assigned", "picked-up"].includes(order.status),
                )
                .map((order) => (
                  <OrderCard order={order} nowMs={nowMs} key={order.id}>
                    {order.status === "assigned" && (
                      <button
                        className="delivery-primary"
                        disabled={pending}
                        onClick={() =>
                          void dispatch({
                            type: "order.pickup",
                            courierId,
                            orderId: order.id,
                          })
                        }
                      >
                        Забрал из ресторана <PackageCheck size={17} />
                      </button>
                    )}
                    {order.status === "picked-up" && (
                      <button
                        className="delivery-primary"
                        disabled={pending}
                        onClick={() =>
                          void dispatch({
                            type: "order.deliver",
                            courierId,
                            orderId: order.id,
                          })
                        }
                      >
                        Доставил клиенту <Check size={17} />
                      </button>
                    )}
                  </OrderCard>
                ))}
            </div>
            {!state.orders.some(
              (order) =>
                order.courierId === courierId &&
                ["assigned", "picked-up"].includes(order.status),
            ) && (
              <p className="delivery-muted">
                У этого курьера нет активных доставок.
              </p>
            )}
          </main>
        )}
        {view === "browse" && count > 0 && !cartInView && (
          <button
            className="delivery-mobile-cart"
            onClick={() =>
              cartRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          >
            <ShoppingBag size={18} />
            <span>Корзина · {plural(count, ["блюдо", "блюда", "блюд"])}</span>
            <strong>
              {quote && cartRestaurant
                ? money(quote.total, cartRestaurant.currency)
                : "Проверить"}
            </strong>
            <ArrowRight size={17} />
          </button>
        )}
        <footer className="delivery-footer">
          BITEOS DELIVERY · ДЕМО-РОЛИ БЕЗ АВТОРИЗАЦИИ · ДАННЫЕ ТОЛЬКО В ЭТОЙ
          ВКЛАДКЕ · БЕЗ ОПЛАТЫ И РЕАЛЬНОЙ ДОСТАВКИ
        </footer>
      </div>
    </div>
  );
}
