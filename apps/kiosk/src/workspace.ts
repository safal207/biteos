export type WorkspaceLang = "tr" | "ru" | "en";
type Names = Record<WorkspaceLang,string>;
type Entry = {route:string;group:"commerce"|"operations"|"analysis"|"studio";name:Names;description:Names;mode:"demo"|"local"|"simulation"};
const n=(tr:string,ru:string,en:string):Names=>({tr,ru,en});
export const workspaceEntries: readonly Entry[] = [
 {route:"#kiosk",group:"commerce",name:n("Restoran kiosk","Киоск ресторана","Restaurant kiosk"),description:n("Örnek restoran siparişi","Демонстрационный ресторанный заказ","Sample restaurant order"),mode:"demo"},
 {route:"#retail",group:"commerce",name:n("Market vitrini","Витрина магазина","Retail storefront"),description:n("Sepet, teslimat, alışveriş listeleri","Корзина, доставка, списки покупок","Cart, delivery, shopping lists"),mode:"demo"},
 {route:"#retail-demand",group:"commerce",name:n("Ürün isteği","Запрос товара","Product request"),description:n("Eksik ürün sinyali","Сигнал отсутствующего товара","Missing-item interest"),mode:"demo"},
 {route:"#retail-business",group:"operations",name:n("Rol çalışma alanı","Кабинеты сотрудников","Role workspace"),description:n("Beş örnek rol; işlem yetkisi yok","Пять тестовых ролей без права исполнения","Five sample roles; no action authority"),mode:"local"},
 {route:"#retail-brain",group:"operations",name:n("Karar merkezi","Центр решений","Decision center"),description:n("Risk ve inceleme kuyruğu","Очередь рисков и проверок","Risk and review queue"),mode:"local"},
 {route:"#retail-lifetime",group:"operations",name:n("Partiler","Сроки партий","Lot dates"),description:n("Tarih ve stok incelemesi","Проверка сроков запасов","Stock date review"),mode:"demo"},
 {route:"#retail-finance",group:"analysis",name:n("Finans","Финансы","Finance"),description:n("Örnek gelir ve maliyet","Условные доходы и расходы","Illustrative revenue and costs"),mode:"demo"},
 {route:"#retail-growth",group:"analysis",name:n("Kampanya","Акции","Promotions"),description:n("İndirim ve marj sınırları","Скидки и ограничения маржи","Discount and margin limits"),mode:"simulation"},
 {route:"#retail-demand-business",group:"analysis",name:n("Talep analizi","Анализ спроса","Demand analysis"),description:n("Satın alma senaryosu","Сценарий закупки","Procurement scenario"),mode:"simulation"},
 {route:"#retail-twin",group:"analysis",name:n("Dijital ikiz","Цифровой двойник","Digital twin"),description:n("Stok senaryoları","Сценарии запасов","Inventory scenarios"),mode:"simulation"},
 {route:"#retail-spatial",group:"analysis",name:n("Rota laboratuvarı","Лаборатория маршрутов","Route lab"),description:n("Kurgu rota ağı","Условная сеть маршрутов","Fictional route network"),mode:"simulation"},
 {route:"#retail-economics",group:"analysis",name:n("Ekonomik model","Экономическая модель","Economic model"),description:n("Talep, kapasite ve katkı","Спрос, мощности и вклад","Demand, capacity and contribution"),mode:"simulation"},
 {route:"#retail-observatory",group:"analysis",name:n("Gözlem merkezi","Обсерватория бизнеса","Business observatory"),description:n("Tahmin ve bildirilen sonuç","Прогноз и заявленный результат","Forecast and reported outcome"),mode:"simulation"},
 {route:"#retail-robys-growth",group:"analysis",name:n("Roby’s büyüme paneli","Roby’s аналитика роста","Roby’s growth dashboard"),description:n("Kanal, ürün ve kasa raporları","Каналы, блюда и отчёты кассы","Channels, products and counter reports"),mode:"local"},
 {route:"#retail-robys-pilot",group:"analysis",name:n("Roby’s ticari pilot","Roby’s коммерческий пилот","Roby’s commercial pilot"),description:n("İki dönem; gelir, maliyet ve ilgi","Два периода: выручка, расходы и интерес","Two windows: revenue, costs and interest"),mode:"local"},
 {route:"#retail-robys-experiment",group:"analysis",name:n("Roby’s deney stüdyosu","Roby’s студия экспериментов","Roby’s experiment studio"),description:n("A/B taslağı ve güvenlik sınırları","A/B-план и ограничения","A/B draft and safety gates"),mode:"local"},
 {route:"#retail-robys-loyalty",group:"analysis",name:n("Roby’s sadakat analizi","Roby’s лояльность гостей","Roby’s loyalty intelligence"),description:n("Tekrar alışveriş ve ürün ilgisi","Повторные покупки и любимые блюда","Repeat purchases and favorite products"),mode:"local"},
 {route:"#retail-robys-campaign",group:"studio",name:n("Roby’s kampanya stüdyosu","Roby’s студия кампаний","Roby’s campaign studio"),description:n("UTM, ölçüm dönemi ve sonuç","UTM, период и оценка результата","UTM, observation window and results"),mode:"local"},
 {route:"#retail-robys-community",group:"studio",name:n("Roby’s topluluk stüdyosu","Roby’s студия сообщества","Roby’s community studio"),description:n("Hikâye, ödül bütçesi ve geri bildirim","Истории, бюджет наград и обратная связь","Stories, reward budget and feedback"),mode:"simulation"},
 {route:"#retail-robys-context",group:"studio",name:n("Roby’s bağlam asistanı","Roby’s контекстный агент","Roby’s context assistant"),description:n("Hava, takvim ve tercih senaryoları","Погода, календарь и предпочтения","Weather, calendar and preference scenarios"),mode:"simulation"},
 {route:"#retail-robys-experience",group:"studio",name:n("Benim Roby’s deneyimim","Мой Roby’s — адаптивное меню","My Roby’s adaptive experience"),description:n("Ruh hâli, öneri, keşif ve paylaşım","Настроение, предложение, открытия и обмен","Mood, offer, discovery and sharing"),mode:"simulation"},
 {route:"#retail-decision-studio",group:"studio",name:n("Karar stüdyosu","Студия решений","Decision studio"),description:n("Tahmin, geçmiş ve öğrenme","Прогноз, история и анализ ошибок","Forecast, history and error analysis"),mode:"simulation"},
 {route:"#retail-brand",group:"studio",name:n("Marka stüdyosu","Студия бренда","Brand studio"),description:n("Renk ve dil taslağı","Черновики цветов и языка","Color and language drafts"),mode:"simulation"},
 {route:"#retail-catalog-studio",group:"studio",name:n("Katalog stüdyosu","Студия каталога","Catalog studio"),description:n("Ürün, seçenek ve fiyat taslağı","Черновики товаров, опций и цен","Draft items, options and prices"),mode:"simulation"},
];
export const workspaceGroups=["commerce","operations","analysis","studio"] as const;
export function workspaceSearch(lang:WorkspaceLang,query:string):Entry[]{
 const q=query.trim().toLocaleLowerCase(lang);
 return workspaceEntries.filter(e=>!q||[e.route,e.name[lang],e.description[lang]].some(v=>v.toLocaleLowerCase(lang).includes(q)));
}
