export type BusinessCase = {
  id: string;
  name: string;
  sector: string;
  connection: "native" | "linked-demo" | "pilot" | "discovery";
  summary: string;
  existing: readonly string[];
  unknown: readonly string[];
  url?: string;
  linkLabel?: string;
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
    summary: "Самостоятельная фотолента и меню; в BitOS подключён рабочий снимок каталога для исследования и расчётов, без передачи заказов.",
    existing: ["Каталог из 93 позиций", "Меню RU / TR / EN", "Фотолента и локальная корзина"],
    unknown: ["Проверка актуальности меню перед реальными продажами", "Фактические потребности семей", "POS и измеренные продажи"],
    url: "https://safal207.github.io/miora-coffee/",
    linkLabel: "Открыть MIORA",
  },
  {
    id: "sefa-beach",
    name: "Sefa Beach",
    sector: "Пляжный ресторан · Газипаша",
    connection: "linked-demo",
    summary: "Рабочее QR-меню из 123 введённых позиций; применяем цены для расчётов, реальные заказы и оплата не подключены.",
    existing: ["Каталог из 123 позиций", "RU / TR / EN, поиск и избранное", "Корзина как список официанту", "Локальные шаблоны анализа выручки и себестоимости"],
    unknown: ["Заполнение пяти отсутствующих цен", "Актуальные фото и права на использование", "Реальные чеки и себестоимость", "Согласование с владельцем"],
    url: "https://safal207.github.io/sefa-beach/",
    linkLabel: "Открыть демо Sefa Beach",
  },
  {
    id: "riva-bella",
    name: "Riva Bella",
    sector: "Ресторан · Газипаша",
    connection: "linked-demo",
    summary: "Публичный Revenue Lab моделирует допродажи на 8 вымышленных позициях. Отдельный приватный концепт содержит 176 позиций и не опубликован через BitOS.",
    existing: ["Revenue Lab и сценарии сочетаний", "RU / TR / EN и локальная корзина", "Демо-симулятор маржинального вклада", "Приватный концепт: 176 позиций в 16 категориях"],
    unknown: ["Подготовка разрешённого к публикации каталога и фотографий", "Проверка полноты 176 позиций", "Реальная себестоимость и POS-чеки", "Разрешение на публикацию концепта"],
    url: "https://safal207.github.io/riva-bella-revenue/",
    linkLabel: "Открыть публичный Revenue Lab",
  },
  {
    id: "pacelli",
    name: "Pacelli (Пачелли)",
    sector: "Ресторанный проект · локация уточняется",
    connection: "discovery",
    summary: "Ресторанный кейс из предыдущего обсуждения. Пока нет подтверждённого исходного меню, проекта сайта или ссылки — начинаем с диагностики потребностей.",
    existing: ["Добавлен в реестр BitOS для исследования", "Общая анкета потребностей доступна"],
    unknown: ["Исходный файл меню и введённые цены", "Ссылка на текущий проект или витрину", "Клиентские сценарии, спрос и экономика", "Местоположение и условия сотрудничества"],
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
    hint: "Проверка исходных данных для реальных продаж, права на контент, работа кассы и тест.",
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
