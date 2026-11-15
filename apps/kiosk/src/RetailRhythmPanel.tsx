import { useEffect,useState } from "react";
import { IS_DEMO } from "./types";
import type { ClubLang,ClubList,ClubProduct } from "./retailClub";
import { advanceRhythm,createRhythm,localDay,parsePreferences,rhythmStatus,validDay } from "./retailRhythm";
import type { Preferences } from "./retailRhythm";

const key="biteos.rozal.preferences.v1."+(IS_DEMO?"sample":"local");
const copy={
 tr:{title:"Alışveriş ritmim",favorite:"Favori ürünüm",none:"Seçilmedi",review:"Ürünü incele",disclaimer:"Favori seçimi indirim veya puan sağlamaz.",source:"Liste seçin",saved:"Kayıtlı liste",last:"Son tamamlanan sipariş",interval:"Gün aralığı",date:"İlk kontrol tarihi",save:"Planı kaydet",due:"Listeyi kontrol etme günü",upcoming:"Sonraki kontrol",check:"Listeyi incele",advance:"Kontrol ettim · sonraki tarih",remove:"Planı sil",privacy:"Yalnızca bu tarayıcıda; bildirim, otomatik sipariş veya ödeme yok.",invalid:"Geçerli liste ve tarih seçin.",error:"Tarayıcı kaydı kullanılamıyor.",missing:"Ürün şu an katalogda yok",clear:"Tercihleri sil"},
 ru:{title:"Мой ритм покупок",favorite:"Любимый товар",none:"Не выбран",review:"Проверить товар",disclaimer:"Выбор любимого товара пока не даёт скидок или бонусов.",source:"Выберите список",saved:"Сохранённый список",last:"Последний выполненный заказ",interval:"Интервал, дней",date:"Первая дата проверки",save:"Сохранить план",due:"Пора проверить список",upcoming:"Следующая проверка",check:"Проверить список",advance:"Проверил · следующая дата",remove:"Удалить план",privacy:"Только в этом браузере; без уведомлений, автозаказов и платежей.",invalid:"Выберите действующий список и дату.",error:"Хранилище браузера недоступно.",missing:"Товара сейчас нет в каталоге",clear:"Удалить предпочтения"},
 en:{title:"My shopping rhythm",favorite:"Favorite product",none:"Not selected",review:"Review product",disclaimer:"Favorites do not currently grant discounts or points.",source:"Choose list",saved:"Saved list",last:"Last fulfilled order",interval:"Interval in days",date:"First review date",save:"Save plan",due:"Time to review your list",upcoming:"Next review",check:"Review list",advance:"Reviewed · next date",remove:"Delete plan",privacy:"This browser only; no notifications, automatic orders or payments.",invalid:"Select a valid list and date.",error:"Browser storage unavailable.",missing:"Product is no longer in the catalog",clear:"Delete preferences"}
};
function load():Preferences{
 try{return parsePreferences(localStorage.getItem(key))}catch{return {favorite:null,rhythm:null}}
}
export function RetailRhythmPanel({lang,products,saved,last,busy,onReview}:{lang:ClubLang;products:ClubProduct[];saved:ClubList;last:ClubList;busy:boolean;onReview:(list:ClubList)=>void}){
 const t=copy[lang];
 const [prefs,setPrefs]=useState<Preferences>(load);
 const [source,setSource]=useState<"saved"|"last">("saved");
 const [interval,setInterval]=useState(7);
 const [today,setToday]=useState(()=>localDay(new Date()));
 const [date,setDate]=useState(today);
 const [error,setError]=useState(false);
 useEffect(()=>{
  const refresh=()=>setToday(localDay(new Date()));
  window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
  return()=>{window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh)};
 },[]);
 function persist(next:Preferences){
  setPrefs(next);
  try{if(!next.favorite&&!next.rhythm)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify({version:1,...next}));setError(false)}catch{setError(true)}
 }
 const favorite=products.find(p=>p.id===prefs.favorite);
 const selected=source==="saved"?saved:last;
 const plan=createRhythm(selected,interval,date);
 const rhythm=prefs.rhythm;
 const status=rhythm?rhythmStatus(rhythm,today):"unknown";
 const money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 return <section className="rhythm-panel" aria-label={t.title}>
 <h3>{t.title}</h3>
 <p className="club-note">{t.privacy}</p>
 <div className="club-context">
 <label>{t.favorite}<select disabled={busy} value={prefs.favorite??""} onChange={e=>persist({...prefs,favorite:e.target.value||null})}>
 <option value="">{t.none}</option>{prefs.favorite&&!favorite&&<option value={prefs.favorite}>{t.missing}</option>}
 {products.map(p=><option key={p.id} value={p.id}>{p.name[lang]}</option>)}
 </select></label>
 {favorite&&<div><p>{money(favorite.price)}</p><button disabled={busy} onClick={()=>onReview([{id:favorite.id,quantity:1,previousPrice:favorite.price}])}>{t.review}</button></div>}
 </div><p className="club-note">{t.disclaimer}</p>
 <div className="club-context">
 <label>{t.source}<select disabled={busy} value={source} onChange={e=>setSource(e.target.value as "saved"|"last")}><option value="saved">{t.saved} ({saved.length})</option><option value="last">{t.last} ({last.length})</option></select></label>
 <label>{t.interval}<input disabled={busy} type="number" min={1} max={90} step={1} value={Number.isFinite(interval)?interval:""} onChange={e=>setInterval(e.target.valueAsNumber)}/></label>
 <label>{t.date}<input disabled={busy} type="date" min={validDay(today)?today:undefined} max="2099-12-31" value={date} onChange={e=>setDate(e.target.value)}/></label>
 </div>
 <button disabled={busy||!plan||date<today} onClick={()=>{if(plan&&date>=today)persist({...prefs,rhythm:plan})}}>{t.save}</button>
 {!plan&&<p className="club-note">{t.invalid}</p>}
 {rhythm&&<div className="rhythm-current">
 <p role="status"><b>{status==="due"?t.due:t.upcoming}: {rhythm.nextDate}</b> · {rhythm.list.length}</p>
 <div className="club-actions"><button disabled={busy} onClick={()=>onReview(rhythm.list)}>{t.check}</button><button disabled={busy||status!=="due"} onClick={()=>{const next=advanceRhythm(rhythm,localDay(new Date()));if(next)persist({...prefs,rhythm:next})}}>{t.advance}</button><button disabled={busy} onClick={()=>persist({...prefs,rhythm:null})}>{t.remove}</button></div>
 </div>}
 <button disabled={busy||(!prefs.favorite&&!rhythm)} onClick={()=>persist({favorite:null,rhythm:null})}>{t.clear}</button>
 {error&&<p role="alert">{t.error}</p>}
 </section>
}
