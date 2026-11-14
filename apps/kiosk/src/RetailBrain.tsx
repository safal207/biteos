import {useEffect,useState} from "react";
import {IS_DEMO} from "./types";
import "./retail.css";
import "./retail-finance.css";
type Lang="tr"|"ru"|"en";
type Fact={key:string;value:number;unit:string};
type Decision={id:string;priority:number;rule:string;subject:string;name?:Record<Lang,string>;facts:Fact[];next:string};
type Report={demo:boolean;mode:string;asOf:string;ruleVersion:string;evidenceHead?:string;externalEffectsAuthorized:boolean;fulfilled:number;contribution:number;decisions:Decision[]};
const sample:Report={demo:true,mode:"review-only",asOf:"2026-11-14",ruleVersion:"brain-v1",externalEffectsAuthorized:false,fulfilled:4,contribution:8800,decisions:[
{id:"HOLD_LOT:sample-1",priority:0,rule:"HOLD_LOT",subject:"sample-1",name:{tr:"Süt",ru:"Молоко",en:"Milk"},facts:[{key:"units",value:2,unit:"units"},{key:"carryingCost",value:6200,unit:"TRY-minor"}],next:"lifetime"},
{id:"REVIEW_EXPIRY:sample-2",priority:2,rule:"REVIEW_EXPIRY",subject:"sample-2",name:{tr:"Ekmek",ru:"Хлеб",en:"Bread"},facts:[{key:"units",value:5,unit:"units"},{key:"carryingCost",value:20000,unit:"TRY-minor"},{key:"reviewPrice",value:5200,unit:"TRY-minor"}],next:"lifetime"},
{id:"REVIEW_DELIVERY_COST:delivery",priority:2,rule:"REVIEW_DELIVERY_COST",subject:"delivery",facts:[{key:"fees",value:10500,unit:"TRY-minor"},{key:"sampleCost",value:13500,unit:"TRY-minor"}],next:"spatial"},
{id:"REVIEW_DEMAND:kefir",priority:3,rule:"REVIEW_DEMAND",subject:"kefir",name:{tr:"Kefir",ru:"Кефир",en:"Kefir"},facts:[{key:"signals",value:8,unit:"count"},{key:"requestedUnits",value:18,unit:"units"}],next:"demand-business"}
]};
const copy={
tr:{title:"Karar merkezi",note:"Sadece inceleme · işlem yetkisi yok.",sample:"Sabit örnek, gerçek mağaza verisi değil.",local:"Yerel demo verileri · tek tutarlı görünüm",refresh:"Yenile",loading:"Yükleniyor",error:"Rapor alınamadı",fulfilled:"Tamamlanan demo siparişler",contribution:"Örnek katkı",open:"İncele",empty:"Kurallar eşleşmedi",priority:["Beklet","Doğrula","İncele","Araştır"],evidence:"Yerel kanıt zinciri başı",limits:"Bu rapor satış, satın alma, indirim veya sevkiyat başlatmaz. Maliyetler örnektir; talep sinyalleri satış değildir.",labs:"Senaryo laboratuvarları",twin:"Dijital ikiz",growth:"Kampanya",spatial:"Rota",demand:"Satın alma"},
ru:{title:"Центр решений",note:"Только рекомендации · без права исполнения.",sample:"Фиксированный пример, не данные магазина.",local:"Локальные демоданные · единый снимок",refresh:"Обновить",loading:"Загрузка",error:"Отчёт недоступен",fulfilled:"Выполненные демозаказы",contribution:"Условный вклад",open:"Рассмотреть",empty:"Правила не сработали",priority:["Блокировка","Проверка","Внимание","Исследование"],evidence:"Голова локальной цепочки свидетельств",limits:"Отчёт не запускает продажи, закупки, скидки или доставку. Затраты условные; запросы не равны продажам.",labs:"Лаборатории сценариев",twin:"Цифровой двойник",growth:"Акции",spatial:"Маршруты",demand:"Закупки"},
en:{title:"Decision center",note:"Review only · no execution authority.",sample:"Fixed illustration, not store data.",local:"Local demo data · consistent snapshot",refresh:"Refresh",loading:"Loading",error:"Report unavailable",fulfilled:"Completed demo orders",contribution:"Sample contribution",open:"Review",empty:"No rule matched",priority:["Hold","Verify","Review","Explore"],evidence:"Local evidence chain head",limits:"This report does not initiate sales, procurement, discounts or dispatch. Costs are illustrative; interest signals are not sales.",labs:"Scenario labs",twin:"Digital twin",growth:"Promotions",spatial:"Routes",demand:"Procurement"}
};
const rules:Record<string,Record<Lang,string>>={
 HOLD_LOT:{tr:"Partiyi satıştan ayırın ve fiziksel kontrol yapın",ru:"Изолировать партию и проверить физически",en:"Isolate lot and physically inspect"},
 HOLD_OPEN_ORDER:{tr:"Açık siparişi güvenlik açısından inceleyin",ru:"Проверить открытый заказ: срок партии истёк",en:"Review open order: lot date reached"},
 VERIFY_DATE:{tr:"Parti tarihini doğrulayın",ru:"Уточнить дату партии",en:"Verify lot date"},
 REVIEW_EXPIRY:{tr:"Yakın tarihli partiyi inceleyin",ru:"Проверить партию с близким сроком",en:"Inspect near-date lot"},
 REVIEW_LOW_STOCK:{tr:"Düşük stoku ve alım ihtiyacını inceleyin",ru:"Проверить низкий остаток и потребность в закупке",en:"Review low stock and replenishment need"},
 REVIEW_DEMAND:{tr:"Tedarikçi teklifi ve talebi değerlendirin",ru:"Проверить спрос и предложение поставщика",en:"Review interest and supplier quote"},
 REVIEW_DELIVERY_COST:{tr:"Teslimat giderlerini değerlendirin",ru:"Проверить убыточность доставки по условным затратам",en:"Review delivery cost shortfall under sample costs"},
 COLLECT_BASELINE:{tr:"Önce temel verileri toplayın",ru:"Сначала собрать базовые данные",en:"Collect baseline data first"}
};
const facts:Record<string,Record<Lang,string>>={
 units:{tr:"Adet",ru:"Количество",en:"Units"},carryingCost:{tr:"Stok maliyeti",ru:"Стоимость запаса",en:"Carrying cost"},reviewPrice:{tr:"Örnek fiyat",ru:"Цена для рассмотрения",en:"Review price"},orderCount:{tr:"Sipariş",ru:"Заказов",en:"Orders"},availableUnits:{tr:"Mevcut adet",ru:"Остаток",en:"Available units"},historicalSold:{tr:"Satılan adet",ru:"Продано ранее",en:"Historical units sold"},signals:{tr:"İstek",ru:"Запросы",en:"Signals"},requestedUnits:{tr:"İstenen adet",ru:"Запрошено, шт.",en:"Requested units"},fees:{tr:"Teslimat geliri",ru:"Плата за доставку",en:"Delivery fees"},sampleCost:{tr:"Örnek gider",ru:"Условные расходы",en:"Sample cost"},fulfilled:{tr:"Tamamlanan",ru:"Выполнено",en:"Fulfilled"}
};
const links:Record<string,string>={lifetime:"#retail-lifetime",finance:"#retail-finance","demand-business":"#retail-demand-business",spatial:"#retail-spatial"};
export function RetailBrain(){
 const [lang,setLang]=useState<Lang>("tr"),[report,setReport]=useState<Report|null>(IS_DEMO?sample:null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 const t=copy[lang],money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 useEffect(()=>{if(IS_DEMO)return;const c=new AbortController();setReport(null);setError(false);fetch("/api/retail/brain",{signal:c.signal,cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<Report>}).then(r=>{if(!c.signal.aborted){if(r.mode!=="review-only"||r.externalEffectsAuthorized!==false)throw Error();setReport(r)}}).catch(()=>{if(!c.signal.aborted)setError(true)});return()=>c.abort()},[revision]);
 return <main className="retail finance"><header><a href="#retail-finance">← Finance</a><strong>BiteOS <small>BRAIN</small></strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="tr">TR</option><option value="ru">RU</option><option value="en">EN</option></select></header><section className="retail-hero"><p>ROZAL · BUSINESS CONTROL</p><h1>{t.title}</h1><p>{t.note}</p></section><p>{IS_DEMO?t.sample:t.local}</p>
 {!IS_DEMO&&<button onClick={()=>setRevision(x=>x+1)}>{t.refresh}</button>}{error&&<p role="alert">{t.error}</p>}{!report&&!error&&<p role="status">{t.loading}</p>}
 {report&&<><p>{report.asOf} · TRT · {report.ruleVersion}</p><div className="finance-kpis"><article><p>{t.fulfilled}</p><strong>{report.fulfilled}</strong></article><article><p>{t.contribution}</p><strong>{money(report.contribution)}</strong></article></div>
 {!report.decisions.length&&<p>{t.empty}</p>}
 {report.decisions.map(d=><section className="retail-cart" key={d.id}><p className={d.priority===0?"finance-negative":""}><b>P{d.priority} · {t.priority[d.priority]}</b></p><h3>{rules[d.rule]?.[lang]??d.rule}</h3>{d.name&&<p>{d.name[lang]}</p>}<small>{d.subject}</small><div className="finance-detail">{d.facts.map(f=><div key={f.key}><span>{facts[f.key]?.[lang]??f.key}</span><b>{f.unit==="TRY-minor"?money(f.value):f.value}</b></div>)}</div>{links[d.next]&&<p><a href={links[d.next]}>{t.open}</a></p>}</section>)}
 {report.evidenceHead&&<p className="finance-note" style={{overflowWrap:"anywhere"}}>{t.evidence}: {report.evidenceHead}</p>}</>}
 <section className="retail-cart"><h2>{t.labs}</h2><p><a href="#retail-twin">{t.twin}</a> · <a href="#retail-growth">{t.growth}</a> · <a href="#retail-spatial">{t.spatial}</a> · <a href="#retail-demand-business">{t.demand}</a></p></section><p className="finance-note">{t.limits}</p></main>
}
