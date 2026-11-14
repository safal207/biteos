import {useState} from "react";
import "./retail.css";
import "./retail-finance.css";
import "./retail-decision-studio.css";
type Lang="tr"|"ru"|"en";
type Filter="all"|"reported"|"pending";
const copy={
 tr:{title:"Karar stüdyosu",note:"Kurgu örnek · canlı işletme verisi değil",completed:"Bildirilen sonuçlar",pending:"Gözlem bekleyen",wape:"Satış tahmin hatası (WAPE)",forecast:"Tahmin",actual:"Bildirilen",sold:"Porsiyon",contribution:"Katkı",review:"Tahmin varsayımlarını yeniden inceleyin",why:"Üç ayrı örnekte satış tahmini yüksek kaldı.",all:"Tüm kararlar",reported:"Bildirilen",awaiting:"Gözlem bekliyor",timeline:"Karar geçmişi",reason:"Talep testi",end:"bitiş günü hariç",notRecorded:"Sonuç henüz girilmedi",unknown:"Nedensel etki kanıtlanmadı.",hint:"Sabit, kurgu örnek; kişisel veri yok. Bu sayfa sunucuya bağlanmaz, fiyat veya sipariş değiştirmez.",economics:"Senaryoyu incele",observatory:"Gözlemleri incele",brain:"Riskleri incele"},
 ru:{title:"Студия решений",note:"Условный пример · не данные реального предприятия",completed:"Наблюдения",pending:"Ожидают наблюдений",wape:"Ошибка прогноза продаж (WAPE)",forecast:"Прогноз",actual:"Заявленный факт",sold:"Порции",contribution:"Маржинальный вклад",review:"Пересмотрите предположения прогноза",why:"В трёх отдельных примерах прогноз продаж оказался завышен.",all:"Все решения",reported:"С результатом",awaiting:"Ожидают наблюдения",timeline:"История решений",reason:"Тест спроса",end:"конечный день не включён",notRecorded:"Результат пока не зарегистрирован",unknown:"Причинный эффект не доказан.",hint:"Фиксированный вымышленный пример, без персональных данных. Экран не обращается к серверу и не меняет цены или заказы.",economics:"Изучить сценарий",observatory:"Изучить наблюдения",brain:"Изучить риски"},
 en:{title:"Decision studio",note:"Illustrative example · not live business data",completed:"Reported outcomes",pending:"Awaiting outcomes",wape:"Sales forecast error (WAPE)",forecast:"Forecast",actual:"Reported actual",sold:"Servings",contribution:"Contribution",review:"Review forecast assumptions",why:"Sales forecasts were too high in three separate examples.",all:"All decisions",reported:"Reported outcomes",awaiting:"Awaiting observation",timeline:"Decision history",reason:"Demand test",end:"end exclusive",notRecorded:"No outcome recorded yet",unknown:"Causal effect not established.",hint:"Fixed fictional example, no personal data. This screen does not contact the server or change prices or orders.",economics:"Explore scenario",observatory:"Explore observations",brain:"Explore risks"}
};
const sample=[{id:"pilot-next",start:"2026-11-24",end:"2026-11-26",forecast:60,actual:null,contribution:240000,result:null},{id:"pilot-c",start:"2026-11-21",end:"2026-11-23",forecast:60,actual:55,contribution:240000,result:219400},{id:"pilot-b",start:"2026-11-18",end:"2026-11-20",forecast:60,actual:55,contribution:240000,result:219400},{id:"pilot-a",start:"2026-11-15",end:"2026-11-17",forecast:60,actual:55,contribution:240000,result:219400}];
export function RetailDecisionStudio(){
 const [lang,setLang]=useState<Lang>("tr"),[filter,setFilter]=useState<Filter>("all");
 const t=copy[lang], money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 const reported=sample.filter(r=>r.actual!==null);
 const actual=reported.reduce((a,r)=>a+(r.actual??0),0);
 const absolute=reported.reduce((a,r)=>a+Math.abs((r.actual??0)-r.forecast),0);
 const wape=actual?Math.floor(absolute*10000/actual)/100:0;
 const rows=sample.filter(r=>filter==="all"||(filter==="reported"?r.actual!==null:r.actual===null));
 return <main className="retail finance decision-studio" lang={lang}>
 <header><a href="#workspace">← BiteOS</a><strong>DECISION STUDIO</strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}>{["tr","ru","en"].map(l=><option key={l}>{l}</option>)}</select></header>
 <section className="retail-hero"><p>BITEOS · DEMO</p><h1>{t.title}</h1><p>{t.note}</p></section>
 <div className="finance-kpis"><article><p>{t.completed}</p><strong>{reported.length}</strong></article><article><p>{t.pending}</p><strong>{sample.length-reported.length}</strong></article><article><p>{t.wape}</p><strong>{new Intl.NumberFormat(lang,{minimumFractionDigits:2,maximumFractionDigits:2}).format(wape)}%</strong></article></div>
 <section className="retail-cart decision-advice"><h2>{t.review}</h2><p>{t.why}</p><p>{t.unknown}</p><nav className="decision-links"><a href="#retail-economics">{t.economics}</a><a href="#retail-observatory">{t.observatory}</a><a href="#retail-brain">{t.brain}</a></nav></section>
 <section className="retail-cart"><h2>{t.timeline}</h2><div className="decision-filters">{([["all",t.all],["reported",t.reported],["pending",t.awaiting]] as const).map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
 <div className="decision-timeline">{rows.map(r=><article key={r.id} data-decision-row><div className="decision-row-top"><strong>{r.id}</strong><span>{r.actual===null?t.awaiting:t.reported}</span></div><p>{r.start} — {r.end} ({t.end}) · {t.reason}</p>
 <div className="decision-values"><div><small>{t.forecast} · {t.sold}</small><b>{r.forecast}</b></div><div><small>{t.actual} · {t.sold}</small><b>{r.actual??"—"}</b></div><div><small>{t.forecast} · {t.contribution}</small><b>{money(r.contribution)}</b></div><div><small>{t.actual} · {t.contribution}</small><b>{r.result===null?"—":money(r.result)}</b></div></div>
 {r.actual===null?<p>{t.notRecorded}</p>:<div className="decision-bars" aria-hidden="true"><div style={{width:"100%"}}/><div style={{width:(r.actual/r.forecast*100)+"%"}}/></div>}</article>)}</div></section>
 <p className="finance-note">{t.hint}</p></main>
}
