import { useEffect, useState } from "react";
import { IS_DEMO } from "./types";
import "./retail.css";
import "./retail-finance.css";

type Lang="tr"|"ru"|"en";
type Row={id:string;name:Record<Lang,string>;category:string;unitsSold:number;revenue:number;cogs:number;grossProfit:number;availableStock:number;availableValue:number;reservedValue:number};
type Report={demo:boolean;currency:string;method:string;fulfilled:number;open:number;cancelled:number;revenue:number;cogs:number;grossProfit:number;deliveryFees:number;deliveryCost:number;contribution:number;availableValue:number;reservedValue:number;products:Row[]};
const example:Report={demo:true,currency:"TRY",method:"illustrative-static",fulfilled:2,open:1,cancelled:1,revenue:18800,cogs:11800,grossProfit:7000,deliveryFees:3500,deliveryCost:4500,contribution:6000,availableValue:100600,reservedValue:3100,products:[
{id:"milk",name:{tr:"Süt",ru:"Молоко",en:"Milk"},category:"dairy",unitsSold:2,revenue:9800,cogs:6200,grossProfit:3600,availableStock:17,availableValue:52700,reservedValue:3100},
{id:"avocado",name:{tr:"Avokado",ru:"Авокадо",en:"Avocado"},category:"fresh",unitsSold:2,revenue:9000,cogs:5600,grossProfit:3400,availableStock:16,availableValue:44800,reservedValue:0},
{id:"banana",name:{tr:"Muz",ru:"Бананы",en:"Bananas"},category:"fresh",unitsSold:0,revenue:0,cogs:0,grossProfit:0,availableStock:1,availableValue:3100,reservedValue:0}
]};
const labels={
tr:{title:"İşletme finansı",sample:"Sabit örnek rapor — mağaza verisi değil.",local:"Yerel demo siparişleri · örnek açılış ve kurye maliyetleri.",note:"Muhasebe veya net kâr değildir. KDV, kira, maaş, ödeme komisyonu, fire ve iadeler dahil değil.",revenue:"Ürün satışları",cogs:"Ürün maliyeti",gross:"Brüt kâr",contribution:"Teslimat sonrası katkı",fees:"Teslimat geliri",delivery:"Örnek kurye maliyeti",available:"Satılabilir stok değeri",reserved:"Rezerve stok değeri",fulfilled:"Tamamlanan",open:"Açık",cancelled:"İptal",product:"Ürün",units:"Adet",margin:"Marj",stock:"Stok",refresh:"Yenile",loading:"Yükleniyor…",error:"Rapor alınamadı",table:"Ürün performansı"},
ru:{title:"Финансы магазина",sample:"Фиксированный пример — не данные магазина.",local:"Локальные демозаказы · условная начальная себестоимость и расходы курьера.",note:"Не бухгалтерский отчёт и не чистая прибыль. НДС, аренда, зарплаты, эквайринг, списания и возвраты не учтены.",revenue:"Продажи товаров",cogs:"Себестоимость",gross:"Валовая прибыль",contribution:"Вклад после доставки",fees:"Доход от доставки",delivery:"Условные расходы курьера",available:"Стоимость доступного запаса",reserved:"Стоимость резерва",fulfilled:"Выполнено",open:"Открыто",cancelled:"Отменено",product:"Товар",units:"Шт.",margin:"Маржа",stock:"Остаток",refresh:"Обновить",loading:"Загрузка…",error:"Отчёт недоступен",table:"Эффективность товаров"},
en:{title:"Store finance",sample:"Fixed sample — not actual store data.",local:"Local demo orders · illustrative opening and courier costs.",note:"Not accounting or net profit. Excludes VAT, rent, wages, payment fees, wastage and refunds.",revenue:"Product sales",cogs:"Cost of goods",gross:"Gross profit",contribution:"Contribution after delivery",fees:"Delivery fees",delivery:"Sample courier cost",available:"Available inventory value",reserved:"Reserved inventory value",fulfilled:"Fulfilled",open:"Open",cancelled:"Cancelled",product:"Product",units:"Units",margin:"Margin",stock:"Stock",refresh:"Refresh",loading:"Loading…",error:"Report unavailable",table:"Product performance"}
};
export function RetailFinance(){
 const [lang,setLang]=useState<Lang>("tr");
 const [report,setReport]=useState<Report|null>(IS_DEMO?example:null);
 const [error,setError]=useState(false);
 const [version,setVersion]=useState(0);
 const [busy,setBusy]=useState(!IS_DEMO);
 const t=labels[lang];
 useEffect(()=>{
  if(IS_DEMO)return;
  const controller=new AbortController();
  setBusy(true);setError(false);setReport(null);
  fetch("/api/retail/finance",{signal:controller.signal,cache:"no-store"}).then(r=>{if(!r.ok)throw Error(String(r.status));return r.json() as Promise<Report>}).then(r=>{if(!controller.signal.aborted){setReport(r);setBusy(false)}}).catch(()=>{if(!controller.signal.aborted){setError(true);setBusy(false)}});
  return ()=>controller.abort();
 },[version]);
 const money=(n:number)=>new Intl.NumberFormat(lang==="tr"?"tr-TR":lang==="ru"?"ru-RU":"en-US",{style:"currency",currency:"TRY"}).format(n/100);
 const percent=(a:number,b:number)=>b?new Intl.NumberFormat(lang,{style:"percent",maximumFractionDigits:1}).format(a/b):"—";
 return <main className="retail finance">
 <header><a href="#retail">← ROZAL</a><strong>BiteOS <small>FINANCE</small></strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="tr">TR</option><option value="ru">RU</option><option value="en">EN</option></select></header>
 <section className="retail-hero"><p>ROZAL · BUSINESS DEMO</p><h1>{t.title}</h1><p>{IS_DEMO?t.sample:t.local}</p></section>
 <p><a href="#retail-growth">{lang==="tr"?"Kampanya planlayıcı":lang==="ru"?"Планировщик акций":"Promotion planner"}</a></p>
 <p><a href="#retail-demand-business">{lang==="tr"?"Talep ve satın alma":lang==="ru"?"Спрос и закупки":"Demand and procurement"}</a></p>
 <p><a href="#retail-lifetime">{lang==="tr"?"Parti ömrü":lang==="ru"?"Сроки годности партий":"Inventory lifetime"}</a></p>
 <p><a href="#retail-twin">{lang==="tr"?"Dijital ikiz":lang==="ru"?"Цифровой двойник":"Digital twin"}</a></p>
 <p><a href="#retail-spatial">{lang==="tr"?"Teslimat rotaları":lang==="ru"?"Маршруты доставки":"Delivery route lab"}</a></p>
 <p><a href="#retail-brain">{lang==="tr"?"Karar merkezi":lang==="ru"?"Центр решений":"Decision center"}</a></p>
 <p><a href="#retail-business">{lang==="tr"?"İşletme çalışma alanı":lang==="ru"?"Рабочее пространство":"Business workspace"}</a></p>
 {!IS_DEMO&&<button disabled={busy} onClick={()=>setVersion(x=>x+1)}>{t.refresh}</button>}
 {busy&&<p role="status">{t.loading}</p>}{error&&<p role="alert">{t.error}</p>}
 {report&&<>
 <div className="finance-kpis">{([[t.revenue,report.revenue],[t.cogs,report.cogs],[t.gross,report.grossProfit],[t.contribution,report.contribution]] as [string,number][]).map(([label,value])=><article key={label}><p>{label}</p><strong className={value<0?"finance-negative":""}>{money(value)}</strong></article>)}</div>
 <section className="retail-cart finance-detail"><div><span>{t.fulfilled}</span><b>{report.fulfilled}</b></div><div><span>{t.open}</span><b>{report.open}</b></div><div><span>{t.cancelled}</span><b>{report.cancelled}</b></div><div><span>{t.fees}</span><b>{money(report.deliveryFees)}</b></div><div><span>{t.delivery}</span><b>{money(report.deliveryCost)}</b></div><div><span>{t.available}</span><b>{money(report.availableValue)}</b></div><div><span>{t.reserved}</span><b>{money(report.reservedValue)}</b></div></section>
 <section className="retail-cart"><h2>{t.table}</h2><div className="finance-table"><table><thead><tr>{[t.product,t.units,t.revenue,t.cogs,t.gross,t.margin,t.stock].map(x=><th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{[...report.products].sort((a,b)=>b.grossProfit-a.grossProfit).map(p=><tr key={p.id}><th scope="row">{p.name[lang]}</th><td>{p.unitsSold}</td><td>{money(p.revenue)}</td><td>{money(p.cogs)}</td><td className={p.grossProfit<0?"finance-negative":""}>{money(p.grossProfit)}</td><td>{percent(p.grossProfit,p.revenue)}</td><td>{p.availableStock}</td></tr>)}</tbody></table></div></section>
 <p className="finance-note">{t.note}</p>
 </>}
 </main>
}
