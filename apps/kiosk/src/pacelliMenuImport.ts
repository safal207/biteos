import type { SourceCatalog, SourceCatalogItem } from "./catalogIntelligence.ts";

/**
 * Browser-only import for the Pacelli discovery workspace.
 * Parsed data never becomes an ordering catalog, a GitHub commit, or a POS feed.
 * No guesswork is applied to missing menu prices.
 */
const MAX_ITEMS = 1000;
const MAX_FILE_LENGTH = 2_000_000;
const MAX_PRICE_MINOR = 1_000_000_000;
const safeText = (value: unknown) => typeof value === "string" ? value.trim() : "";
const validId = (value: string) => /^[a-zA-Z0-9_-]{1,80}$/.test(value);

function priceToMinor(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0 || value > MAX_PRICE_MINOR / 100)
      throw new Error("Цена должна быть положительным числом в допустимых пределах.");
    const minor = Math.round(value * 100);
    if (Math.abs(value * 100 - minor) > 1e-7)
      throw new Error("Цена не может содержать более двух знаков после запятой.");
    return minor;
  }
  if (typeof value !== "string") throw new Error("Цена должна быть числом или строкой.");
  const source = value.trim().replace(/\s/g, "").replace(/₺|₽|TRY|RUB/gi, "");
  if (!source) return null;
  let normalized: string;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(source))
    normalized = source.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(source))
    normalized = source.replace(/,/g, "");
  else if (/^\d+(?:[.,]\d{1,2})?$/.test(source))
    normalized = source.replace(",", ".");
  else throw new Error("Неверный формат цены: " + value);
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > MAX_PRICE_MINOR / 100)
    throw new Error("Цена должна быть больше нуля и не превышать лимит.");
  return Math.round(numeric * 100);
}

function readCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const countDelimiter = (char: string) => {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === '"') {
        if (quoted && firstLine[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && firstLine[i] === char) count++;
    }
    return count;
  };
  const delimiter = countDelimiter(";") > countDelimiter(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let afterQuote = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { inQuotes = false; afterQuote = true; }
      else field += char;
      continue;
    }
    if (afterQuote && char !== delimiter && char !== "\n" && char !== "\r" && char !== " " && char !== "\t")
      throw new Error("CSV: неожиданный символ после кавычек.");
    if (char === '"' && field === "" && !afterQuote) { inQuotes = true; continue; }
    if (char === delimiter) { row.push(field.trim()); field = ""; afterQuote = false; continue; }
    if (char === "\n") {
      row.push(field.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = []; field = ""; afterQuote = false;
      continue;
    }
    if (char === "\r" && text[i + 1] === "\n") continue;
    if (afterQuote && (char === " " || char === "\t")) continue;
    field += char;
  }
  if (inQuotes) throw new Error("CSV: незакрытые кавычки.");
  row.push(field.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function importedItem(value: unknown, index: number): SourceCatalogItem {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Строка " + (index + 1) + ": неверная запись товара.");
  const record = value as Record<string, unknown>;
  const id = safeText(record.id) || "row-" + (index + 1);
  const name = safeText(record.name) || safeText(record.title);
  const category = safeText(record.category) || "Без категории";
  if (!validId(id)) throw new Error("Строка " + (index + 1) + ": недопустимый ID.");
  if (!name || name.length > 180 || category.length > 90)
    throw new Error("Строка " + (index + 1) + ": проверьте название и категорию.");
  if (/\p{Cc}/u.test(name + category)) throw new Error("Строка " + (index + 1) + ": недопустимый символ.");
  const priceMinor = record.priceMinor === undefined
    ? priceToMinor(record.price)
    : (() => {
      const p = record.priceMinor;
      if (p === null || p === "") return null;
      if (!Number.isSafeInteger(p) || (p as number) <= 0 || (p as number) > MAX_PRICE_MINOR)
        throw new Error("Строка " + (index + 1) + ": неверная сумма в копейках/курушах.");
      return p as number;
    })();
  return { id, name, category, priceMinor };
}

export function parsePacelliMenu(
  content: string,
  fileName: string,
  csvCurrency: "TRY" | "RUB" = "TRY",
): SourceCatalog {
  if (!["TRY", "RUB"].includes(csvCurrency)) throw new Error("Выберите валюту CSV.");
  if (content.length === 0 || content.length > MAX_FILE_LENGTH)
    throw new Error("Файл пустой или слишком большой (до 2 МБ).");
  if (!/^[-\p{L}\p{N}_. ]+\.(json|csv)$/iu.test(fileName) || fileName.length > 120)
    throw new Error("Разрешены только локальные файлы .json и .csv.");
  const text = content.replace(/^\uFEFF/, "").trim();
  let rawItems: unknown[];
  let currency: "TRY" | "RUB";
  if (/\.json$/i.test(fileName)) {
    let data: unknown;
    try { data = JSON.parse(text); }
    catch { throw new Error("JSON: синтаксическая ошибка."); }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("JSON должен содержать businessId, currency и items.");
    const obj = data as Record<string, unknown>;
    if (obj.businessId !== "pacelli")
      throw new Error("JSON принадлежит другому клиенту или не содержит businessId: pacelli.");
    if (obj.currency !== "TRY" && obj.currency !== "RUB")
      throw new Error("JSON должен указывать currency: TRY или RUB.");
    if (!Array.isArray(obj.items))
      throw new Error("JSON: items должен быть массивом.");
    rawItems = obj.items;
    currency = obj.currency;
  } else {
    const rows = readCsv(text);
    if (rows.length < 2) throw new Error("CSV должен содержать заголовок и хотя бы одну позицию.");
    const headers = rows.shift()!.map((h) => h.toLowerCase().trim());
    if (new Set(headers).size !== headers.length)
      throw new Error("CSV: дублирующиеся названия столбцов.");
    if (!headers.includes("name") && !headers.includes("title"))
      throw new Error("CSV: нужен столбец name или title.");
    if (!headers.includes("price") && !headers.includes("priceminor"))
      throw new Error("CSV: нужен столбец price или priceMinor.");
    const businessColumn = headers.indexOf("businessid");
    rawItems = rows.map((row, index) => {
      if (row.length !== headers.length)
        throw new Error("CSV: неодинаковое число столбцов в строке " + (index + 2) + ".");
      if (businessColumn >= 0 && row[businessColumn]?.toLowerCase() !== "pacelli")
        throw new Error("CSV: строка " + (index + 2) + " относится не к Pacelli.");
      const obj: Record<string, unknown> = {};
      headers.forEach((h, j) => { obj[h] = row[j]; });
      return {
        id: obj.id, name: obj.name ?? obj.title, category: obj.category,
        price: obj.price, priceMinor: obj.priceminor === "" ? null : obj.priceminor === undefined ? undefined : Number(obj.priceminor),
      };
    });
    currency = csvCurrency;
  }
  if (rawItems.length < 1 || rawItems.length > MAX_ITEMS)
    throw new Error("Меню должно содержать от 1 до 1000 позиций.");
  const items = rawItems.map(importedItem);
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error("Повторяющиеся ID товаров. Исправьте исходный файл.");
  return {
    businessId: "pacelli",
    source: "Локальный файл: " + fileName,
    sourceSha: null,
    capturedAt: null,
    currency,
    status: "working-menu-snapshot",
    items,
  };
}
