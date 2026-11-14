import {useEffect,useState} from "react";
import {IS_DEMO} from "./types";
import "./retail.css";
import "./retail-finance.css";
type Lang="tr"|"ru"|"en";
type Lot={lotId:string;productId:string;name:Record<Lang,string>;quantity:number;useBy?:string;status:string;costValue:number;unitCost:number;price:number;reviewPrice:number;reviewEligible:boolean};
type Report={demo:boolean;asOf:string;rows:Lot[];unknownValue:number;heldValue:number;reviewValue:number};
const sample:Report={demo:true,asOf:"2026-11-14",unknownValue:5600,heldValue:6200,reviewValue:15500,rows:[
 {lotId:"sample-1",productId:"milk",name:{tr:"Süt",ru:"Молоко",en:"Milk"},quantity:2,useBy:"2026-11-14",status:"HOLD",costValue:6200,unitCost:3100,price:4900,reviewPrice:0,reviewEligible:false},
 {lotId:"sample-2",productId:"avocado",name:{tr:"Avokado",ru:"Авокадо",en:"Avocado"},quantity:2,status:"UNKNOWN",costValue:5600,unitCost:2800,price:4500,reviewPrice:0,reviewEligible:false},
 {lotId:"sample-3",productId:"milk",name:{tr:"Süt",ru:"Молоко",en:"Milk"},quantity:5,useBy:"2026-11-15",status:"REVIEW_SOON",costValue:15500,unitCost:3100,price:4900,reviewPrice:3920,reviewEligible:true}
]};
const copy={
 tr:{title:"Parti ömrü",sample:"Sabit örnek · gerçek mağaza verisi değil.",local:"Yerel demo · FIFO parti görünümü",unknown:"Tarih bilinmiyor",hold:"Satışa ayırma engeli",review:"Yakın tarih · incele",dated:"Tarihli parti",lot:"Parti",qty:"Adet",date:"Son tüketim tarihi",value:"Stok maliyeti",scenario:"Örnek inceleme fiyatı",none:"—",refresh:"Yenile",error:"Rapor alınamadı",note:"Tarih tek başına gıda güvenliğini kanıtlamaz. Fiziksel kontrol gerekir. Örnek fiyat etkinleştirilmez. Tarihsiz demo stok gerçek satışa uygunluk anlamına gelmez."},
 ru:{title:"Жизненный цикл партий",sample:"Фиксированный пример · не данные магазина.",local:"Локальное демо · партии FIFO",unknown:"Дата неизвестна",hold:"Блокировка резерва",review:"Скоро истекает · проверить",dated:"Дата указана",lot:"Партия",qty:"Шт.",date:"Годен до",value:"Стоимость запаса",scenario:"Цена для рассмотрения",none:"—",refresh:"Обновить",error:"Отчёт недоступен",note:"Дата сама по себе не подтверждает безопасность продукта. Нужна физическая проверка. Цена не активируется. Недатированный демозапас не означает пригодность к реальной продаже."},
 en:{title:"Inventory lifetime",sample:"Fixed illustration · not store data.",local:"Local demo · FIFO lot view",unknown:"Unknown date",hold:"Reservation hold",review:"Near date · review",dated:"Dated lot",lot:"Lot",qty:"Units",date:"Use-by",value:"Inventory cost",scenario:"Review price scenario",none:"—",refresh:"Refresh",error:"Report unavailable",note:"A date alone does not establish food safety. Physical inspection is required. No price is activated. Undated demo inventory is not approved for real sale."}
};
export function RetailLifetime(){
 const [lang,setLang]=useState<Lang>("tr");
 const [report,setReport]=useState<Report|null>(IS_DEMO?sample:null);
 const [error,setError]=useState(false);
 const [reload,setReload]=useState(0);
 const t=copy[lang];
 useEffect(()=>{if(IS_DEMO)return;const c=new AbortController();setError(false);setReport(null);fetch("/api/retail/lifetime",{signal:c.signal,cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<Report>}).then(r=>{if(!c.signal.aborted)setReport(r)}).catch(()=>{if(!c.signal.aborted)setError(true)});return()=>c.abort()},[reload]);
 const money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 const status=(s:string)=>({HOLD:t.hold,UNKNOWN:t.unknown,REVIEW_SOON:t.review,DATED:t.dated}[s]??s);
 return <main className="retail finance"><header><a href="#retail-finance">← Finance</a><strong>BiteOS <small>LIFETIME</small></strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="tr">TR</option><option value="ru">RU</option><option value="en">EN</option></select></header><section className="retail-hero"><p>ROZAL · SAVE / STOCK</p><h1>{t.title}</h1><p>{IS_DEMO?t.sample:t.local}</p></section>
 <p className="finance-note">{t.note}</p>{!IS_DEMO&&<button onClick={()=>setReload(x=>x+1)}>{t.refresh}</button>}
 {error&&<p role="alert">{t.error}</p>}
 {report&&<><p>{report.asOf} · TRT</p><div className="finance-kpis">{([[t.unknown,report.unknownValue],[t.hold,report.heldValue],[t.review,report.reviewValue]] as [string,number][]).map(([label,value])=><article key={label}><p>{label}</p><strong>{money(value)}</strong></article>)}</div><section className="retail-cart"><div className="finance-table"><table><thead><tr>{[t.lot,t.qty,t.date,t.value,t.scenario].map(x=><th scope="col" key={x}>{x}</th>)}</tr></thead><tbody>{report.rows.map(l=><tr key={l.lotId}><th scope="row">{l.name[lang]}<small style={{display:"block"}}>{status(l.status)}</small></th><td>{l.quantity}</td><td>{l.useBy||t.none}</td><td>{money(l.costValue)}</td><td>{l.reviewEligible?money(l.reviewPrice):t.none}</td></tr>)}</tbody></table></div></section></>}
 </main>
}
