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
  comboOffer,
  cuisines,
  deliveryQuote,
  dishAvailable,
  dishPrice,
  stages,
  statusLabels,
} from "./delivery";
import type {
  CartLine,
  Cuisine,
  DeliveryOrder,
  Dish,
  Restaurant,
} from "./delivery";
import { useDelivery } from "./useDelivery";
import "./delivery.css";

type View = "browse" | "orders" | "restaurant" | "courier";
const money = (kopeks: number) =>
  `${new Intl.NumberFormat("ru-RU").format(kopeks / 100)} ₽`;
const dishImage = () => ({
  backgroundImage: `url('${import.meta.env.BASE_URL}images/food-sheet.png')`,
});
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
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

function Food({
  image,
  className = "",
}: {
  image: number;
  className?: string;
}) {
  return (
    <div
      className={`food food-${image} ${className}`}
      style={dishImage()}
      aria-hidden="true"
    />
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

function OrderCard({
  order,
  children,
}: {
  order: DeliveryOrder;
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
        <strong>{money(order.total)}</strong>
        {children}
      </div>
    </article>
  );
}

export function DeliveryApp() {
  const { state, dispatch, error, canReset, resetDemo, pending, clearError } =
    useDelivery();
  const [view, setView] = useState<View>("browse");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cuisine, setCuisine] = useState<Cuisine | "all">("all");
  const [cartRestaurantId, setCartRestaurantId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [address, setAddress] = useState(demoAddresses[0]);
  const [notice, setNotice] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [managerId, setManagerId] = useState("");
  const [showRestaurantForm, setShowRestaurantForm] = useState(false);
  const [showDishForm, setShowDishForm] = useState(false);
  const [courierId, setCourierId] = useState("courier-anna");
  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    description: "",
    cuisine: "burgers" as Cuisine,
    address: "",
    deliveryFee: "99",
    minimum: "250",
    eta: "30",
  });
  const [dishForm, setDishForm] = useState({
    name: "",
    description: "",
    price: "",
    image: "0",
  });
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
          (cuisine === "all" || restaurant.cuisine === cuisine) &&
          (!term ||
            `${restaurant.name} ${restaurant.description} ${restaurant.dishes.map((dish) => dish.name).join(" ")}`
              .toLocaleLowerCase("ru-RU")
              .includes(term))
        );
      }),
    [state.restaurants, search, cuisine],
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
      setSelectedId(null);
      setManagerId("");
      go("browse");
      setNotice("Демоданные этой вкладки сброшены.");
    }
  }
  function changeCart(restaurant: Restaurant, dish: Dish, amount: number) {
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
    setNotice("");
    setCartRestaurantId(restaurant.id);
    setCart((previous) => {
      const current = previous.find((line) => line.productId === dish.id);
      const quantity = (current?.quantity ?? 0) + amount;
      if (
        quantity > 20 ||
        (amount > 0 &&
          previous.reduce((sum, line) => sum + line.quantity, 0) >= 50)
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
    if (!offer || !cartRestaurant) return;
    setCart((previous) =>
      previous.map((line, index) =>
        index === offer.index ? { ...line, productId: offer.combo.id } : line,
      ),
    );
    setNotice(
      `Комбо добавлено. Экономия ${money((offer.combo.discount ?? 0) * offerQuantity)}!`,
    );
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
        address: restaurantForm.address,
        deliveryFee: Math.round(Number(restaurantForm.deliveryFee) * 100),
        minimum: Math.round(Number(restaurantForm.minimum) * 100),
        eta: Number(restaurantForm.eta),
      },
    });
    if (ok) {
      setManagerId(id);
      setShowRestaurantForm(false);
      setRestaurantForm({
        name: "",
        description: "",
        cuisine: "burgers",
        address: "",
        deliveryFee: "99",
        minimum: "250",
        eta: "30",
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
        <div className="delivery-sidebar-caption">ОДИН ГОРОД · ТРИ РОЛИ</div>
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
                      Любимые рестораны и фастфуд в одном месте. Выбирай,
                      добавляй комбо и следи за заказом.
                    </p>
                    <a href="#delivery-restaurants">
                      Выбрать ресторан <ArrowRight size={19} />
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
                    <span className="delivery-kicker">
                      ТВОЙ ГОРОД. ТВОЙ ВКУС.
                    </span>
                    <h2>Что закажем сегодня?</h2>
                    <p>Только рестораны и фастфуд. Время и цены для демо.</p>
                  </div>
                  <span className="delivery-count">
                    {plural(filtered.length, [
                      "ресторан",
                      "ресторана",
                      "ресторанов",
                    ])}
                  </span>
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
                  <div className="delivery-chips" aria-label="Кухня">
                    <button
                      className={cuisine === "all" ? "active" : ""}
                      onClick={() => setCuisine("all")}
                    >
                      Все
                    </button>
                    {(Object.keys(cuisines) as Cuisine[]).map((key) => (
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
                        <Food image={restaurant.dishes[0]?.image ?? 0} />
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
                          <span>
                            <Clock3 size={15} /> ~{restaurant.eta} мин
                          </span>
                          <span>Доставка {money(restaurant.deliveryFee)}</span>
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
                <section className="delivery-restaurant-banner">
                  <div>
                    <span className="delivery-kicker">
                      {cuisines[selected.cuisine]} ·{" "}
                      {selected.open ? "ПРИНИМАЕМ ЗАКАЗЫ" : "СЕЙЧАС ЗАКРЫТ"}
                    </span>
                    <h1>{selected.name}</h1>
                    <p>{selected.description}</p>
                    <div>
                      <span>
                        <Clock3 size={16} /> ~{selected.eta} мин
                      </span>
                      <span>
                        <MapPin size={16} /> {selected.address}
                      </span>
                    </div>
                  </div>
                  <Food image={selected.dishes[0]?.image ?? 0} />
                </section>
                <div className="delivery-section-head">
                  <div>
                    <span className="delivery-kicker">ВЫБИРАЙ СВОЁ</span>
                    <h2>Меню ресторана</h2>
                    <p>
                      Минимальный заказ {money(selected.minimum)} · доставка{" "}
                      {money(selected.deliveryFee)}
                    </p>
                  </div>
                  <span className="delivery-count">
                    {plural(selected.dishes.length, ["блюдо", "блюда", "блюд"])}
                  </span>
                </div>
                <div className="delivery-dishes">
                  {selected.dishes.map((dish) => {
                    const available =
                      selected.open && dishAvailable(selected, dish);
                    const quantity =
                      selected.id === cartRestaurantId
                        ? (cart.find((line) => line.productId === dish.id)
                            ?.quantity ?? 0)
                        : 0;
                    return (
                      <article
                        className={`delivery-dish ${available ? "" : "unavailable"}`}
                        key={dish.id}
                      >
                        <div className="delivery-dish-image">
                          <Food image={dish.image} />
                          {dish.components && (
                            <span className="delivery-combo-tag">
                              КОМБО · −{money(dish.discount ?? 0)}
                            </span>
                          )}
                        </div>
                        <div className="delivery-dish-info">
                          <h3>{dish.name}</h3>
                          <p>{dish.description}</p>
                          <div className="delivery-dish-bottom">
                            <strong>{money(dishPrice(selected, dish))}</strong>
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
                                  className="delivery-add"
                                  onClick={() => changeCart(selected, dish, 1)}
                                  aria-label={`Добавить ${dish.name}`}
                                >
                                  <Plus size={20} />
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
                      <div className="delivery-cart-line" key={line.productId}>
                        <Food image={dish.image} />
                        <div>
                          <strong>{dish.name}</strong>
                          <span>
                            {line.quantity} ×{" "}
                            {money(dishPrice(cartRestaurant, dish))}
                          </span>
                        </div>
                        <button
                          aria-label={`Убрать ${dish.name}`}
                          onClick={() => changeCart(cartRestaurant, dish, -1)}
                        >
                          <Minus size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {offer && (
                  <button className="delivery-upsell" onClick={takeCombo}>
                    <Sparkles size={19} />
                    <span>
                      <strong>
                        {offerQuantity === 1
                          ? "Сделать комбо?"
                          : `Комбо для ${plural(offerQuantity, ["порции", "порций", "порций"])}?`}
                      </strong>
                      <small>
                        Фри + кола к каждой порции · экономия{" "}
                        {money(offer.combo.discount ?? 0)} за порцию
                      </small>
                    </span>
                    <b>+{money(offer.extra * offerQuantity)}</b>
                  </button>
                )}
                {quote ? (
                  <>
                    <div className="delivery-cart-totals">
                      <div>
                        <span>Блюда</span>
                        <strong>{money(quote.subtotal)}</strong>
                      </div>
                      <div>
                        <span>Доставка</span>
                        <strong>{money(quote.deliveryFee)}</strong>
                      </div>
                      <div className="delivery-grand-total">
                        <span>Итого</span>
                        <strong>{money(quote.total)}</strong>
                      </div>
                    </div>
                    {quote.missing > 0 && (
                      <p className="delivery-minimum">
                        До минимального заказа ещё {money(quote.missing)}
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
                            {demoAddresses.map((place) => (
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
                    ) : (
                      <button
                        className="delivery-primary"
                        disabled={quote.missing > 0}
                        onClick={() => setCheckout(true)}
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
                  <OrderCard order={order} key={order.id}>
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
                      onChange={(event) =>
                        setRestaurantForm({
                          ...restaurantForm,
                          cuisine: event.target.value as Cuisine,
                        })
                      }
                    >
                      {(Object.keys(cuisines) as Cuisine[]).map((key) => (
                        <option value={key} key={key}>
                          {cuisines[key]}
                        </option>
                      ))}
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
                    Доставка, ₽
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
                    Мин. заказ, ₽
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
                        Цена, ₽
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
                      <Food image={dish.image} />
                      <div>
                        <strong>{dish.name}</strong>
                        <small>
                          {dish.components ? "Комбо · " : ""}
                          {money(dishPrice(manager, dish))}
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
                      <OrderCard order={order} key={order.id}>
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
                  <OrderCard order={order} key={order.id}>
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
                  <OrderCard order={order} key={order.id}>
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
            <strong>{quote ? money(quote.total) : "Проверить"}</strong>
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
