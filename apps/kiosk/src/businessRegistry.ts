export type BusinessCase = {
  id: string;
  name: string;
  sector: string;
  connection: "native" | "linked-demo" | "pilot";
  summary: string;
  existing: readonly string[];
  unknown: readonly string[];
  url: string;
  linkLabel: string;
};

export const businessCases: readonly BusinessCase[] = [
  {
    id: "bite-burger",
    name: "Bite Burger",
    sector: "Фастфуд · собственный демокейс",
    connection: "native",
    summary: "Встроенный киоск и демодоставка. Не реальные заказы и продажи.",
    existing: ["Меню и комбо", "Расчёт цены через Go", "Правила допродаж Rust", "Демозаказы"],
    unknown: ["Реальная себестоимость", "Средний чек и поток гостей", "Результат A/B-теста"],
    url: "#kiosk",
    linkLabel: "Открыть киоск",
  },
  {
    id: "robys",
    name: "Roby's Coffee House",
    sector: "Кофейня",
    connection: "native",
    summary: "Отдельное демоменю Roby's уже представлено в BiteOS. Это не синхронизация с кассой.",
    existing: ["Отдельная витрина и фото", "Smart Choice в исходном проекте", "Часть меню и сочетаний в BiteOS"],
    unknown: ["Актуальность цен и наличия", "Разрешение владельца на коммерческое использование", "Оплаченные заказы"],
    url: "https://safal207.github.io/robys-coffee-house-demo/",
    linkLabel: "Открыть оригинальную витрину",
  },
  {
    id: "miora",
    name: "MIORA Coffee",
    sector: "Кафе · семейные посещения",
    connection: "linked-demo",
    summary: "Самостоятельная публичная фотолента и меню; общего каталога с BiteOS пока нет.",
    existing: ["Каталог из 93 позиций", "Меню RU / TR / EN", "Фотолента и локальная корзина"],
    unknown: ["Подтверждение меню владельцем", "Фактические потребности семей", "POS и измеренные продажи"],
    url: "https://safal207.github.io/miora-coffee/",
    linkLabel: "Открыть MIORA",
  },
  {
    id: "ai-cafe",
    name: "AI Café Network",
    sector: "Кафе · гостиницы · сообщества",
    connection: "pilot",
    summary: "Пилотная B2B-концепция для точек и мероприятий; коммерческий эффект ещё не подтверждён.",
    existing: ["Лендинг", "Заявка на пилот", "Программа проверки гипотез на 90 дней"],
    unknown: ["Данные первых площадок", "Платёжеспособный спрос", "ROI мероприятий"],
    url: "https://github.com/safal207/ai-cafe-network",
    linkLabel: "Открыть проект",
  },
];

export const discoveryQuestions = [
  {
    id: "customer",
    title: "Кто покупает и в какой ситуации?",
    hint: "Сегменты, цели визита, повод. Не вводите персональные данные клиентов.",
  },
  {
    id: "need",
    title: "Какую потребность подтверждают клиенты?",
    hint: "Отзывы, интервью, запросы и наблюдения. Отделите факты от гипотез.",
  },
  {
    id: "offer",
    title: "Что бизнес может предложить?",
    hint: "Основные товары и услуги, комбо, доступность, ограничения.",
  },
  {
    id: "economics",
    title: "Какая исходная экономика?",
    hint: "Заказы, выручка, средний чек, себестоимость, маржа, период и источник данных.",
  },
  {
    id: "goal",
    title: "Какой результат и в какие сроки нужен?",
    hint: "Чёткая цель, горизонт, бюджет и показатель успешности.",
  },
  {
    id: "evidence",
    title: "Что нужно проверить перед запуском?",
    hint: "Права на контент, актуальность цен, работа кассы, согласование с владельцем, тест.",
  },
] as const;

export type DiscoveryAnswers = Record<string, string>;

export function discoveryExport(businessId: string, answers: DiscoveryAnswers) {
  const entry = businessCases.find((item) => item.id === businessId);
  if (!entry) throw new Error("Неизвестный бизнес");
  return {
    schema: "biteos.discovery.v1",
    businessId: entry.id,
    sector: entry.sector,
    source: "owner-input-unverified",
    answers: Object.fromEntries(
      discoveryQuestions
        .filter((question) => answers[question.id]?.trim())
        .map((question) => [question.id, answers[question.id].trim()]),
    ),
  };
}
