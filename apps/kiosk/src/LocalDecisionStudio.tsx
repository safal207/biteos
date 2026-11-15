import {useEffect,useRef,useState} from "react";
import type {FormEvent} from "react";
import {decodePilotStudio} from "./pilotStudio";
import type {PilotStudio} from "./pilotStudio";
type Lang="tr"|"ru"|"en";
const copy={
 tr:{title:"Karar stüdyosu",note:"Yerel pilot · salt okunur · operatör verileri doğrulanmadı",tenant:"İşletme kimliği",token:"İşletme sahibi anahtarı",load:"Yerel veriyi aç",clear:"Oturumu temizle",busy:"Yükleniyor",auth:"Anahtar veya yetki geçersiz.",fail:"Yerel veri kullanılamıyor.",empty:"Kayıtlı karar yok.",completed:"Bildirilen",pending:"Bekleyen",timeline:"Karar geçmişi",learning:"Tahmin analizi",forecast:"Tahmin",actual:"Bildirilen",sold:"Porsiyon",contribution:"Katkı",unknown:"Nedensel etki kanıtlanmadı.",wape:"Satış WAPE",noCohort:"Tamamlanmış karşılaştırılabilir örnek yok.",sample:"Örnek sayısı",overlap:"Çakışan dönemler; toplam hesaplanmadı.",more:"Daha fazla gözlem toplayın.",over:"Yüksek tahmin varsayımlarını inceleyin.",under:"Düşük tahmin varsayımlarını inceleyin.",variance:"Tahmin değişkenliğini inceleyin.",hint:"Anahtar saklanmaz. Yenilemek için tekrar girin. Diğer ekranlar pilot verisine bağlı değildir."},
 ru:{title:"Студия решений",note:"Локальный пилот · только чтение · данные оператора не проверены",tenant:"ID предприятия",token:"Ключ владельца",load:"Открыть локальные данные",clear:"Очистить сеанс",busy:"Загрузка",auth:"Недействительный ключ или недостаточно прав.",fail:"Локальные данные недоступны.",empty:"Нет зарегистрированных решений.",completed:"С результатом",pending:"Ожидают результата",timeline:"История решений",learning:"Анализ прогнозов",forecast:"Прогноз",actual:"Заявленный факт",sold:"Порции",contribution:"Маржинальный вклад",unknown:"Причинный эффект не доказан.",wape:"Ошибка продаж WAPE",noCohort:"Нет завершённых сопоставимых наблюдений.",sample:"Наблюдений",overlap:"Периоды пересекаются; итог не рассчитан.",more:"Соберите больше наблюдений.",over:"Пересмотрите завышенные прогнозы.",under:"Пересмотрите заниженные прогнозы.",variance:"Изучите разброс прогнозов.",hint:"Ключ не сохраняется. Для обновления введите его снова. Другие экраны не подключены к данным пилота."},
 en:{title:"Decision studio",note:"Local pilot · read only · operator data unverified",tenant:"Business ID",token:"Owner key",load:"Open local data",clear:"Clear session",busy:"Loading",auth:"Invalid key or insufficient access.",fail:"Local data unavailable.",empty:"No registered decisions.",completed:"Reported outcomes",pending:"Awaiting outcomes",timeline:"Decision history",learning:"Forecast analysis",forecast:"Forecast",actual:"Reported actual",sold:"Servings",contribution:"Contribution",unknown:"Causal effect not established.",wape:"Sales WAPE",noCohort:"No completed comparable observations.",sample:"Observations",overlap:"Overlapping windows; totals suppressed.",more:"Collect more observations.",over:"Review overforecast assumptions.",under:"Review underforecast assumptions.",variance:"Review forecast variance.",hint:"The key is not saved. Enter it again to refresh. Other screens are not connected to pilot data."}
};
export function LocalDecisionStudio(){
 const [lang,setLang]=useState<Lang>("tr"),[tenant,setTenant]=useState("robys"),[busy,setBusy]=useState(false),[result,setResult]=useState<PilotStudio|null>(null),[error,setError]=useState<"auth"|"fail"|null>(null);
 const token=useRef<HTMLInputElement>(null),active=useRef<AbortController|null>(null);
 const t=copy[lang],money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 useEffect(()=>()=>active.current?.abort(),[]);
 function clear(){active.current?.abort();active.current=null;if(token.current)token.current.value="";setResult(null);setError(null);setBusy(false)}
 async function load(ev:FormEvent<HTMLFormElement>){
  ev.preventDefault();if(active.current||!token.current)return;
  const key=token.current.value;token.current.value="";
  setResult(null);setError(null);
  if(!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(tenant)||key.length<32||key.length>256||/\s/.test(key)){setError("auth");return}
  const controller=new AbortController();active.current=controller;setBusy(true);
  const timer=window.setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch("/api/tenants/"+encodeURIComponent(tenant)+"/retail/decision-studio",{method:"GET",headers:{Authorization:"Bearer "+key},cache:"no-store",credentials:"omit",redirect:"error",signal:controller.signal});
   if(active.current!==controller)return;
   if(response.status===401||response.status===403){setError("auth");return}
   if(!response.ok)throw new Error("unavailable");
   const data=decodePilotStudio(await response.json(),tenant);
   if(active.current===controller)setResult(data);
  }catch{if(active.current===controller)setError("fail")}
  finally{window.clearTimeout(timer);if(active.current===controller){active.current=null;setBusy(false)}}
 }
 const advisory={REVIEW_OVERLAPPING_WINDOWS:t.overlap,COLLECT_MORE_OBSERVATIONS:t.more,REVIEW_OVERFORECAST_ASSUMPTIONS:t.over,REVIEW_UNDERFORECAST_ASSUMPTIONS:t.under,REVIEW_FORECAST_VARIANCE:t.variance};
 return <main className="retail finance decision-studio" lang={lang}>
 <header><a href="#workspace">← BiteOS</a><strong>LOCAL PILOT</strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}>{["tr","ru","en"].map(l=><option key={l}>{l}</option>)}</select></header>
 <section className="retail-hero"><h1>{t.title}</h1><p>{t.note}</p></section>
 <form className="retail-cart" onSubmit={load} autoComplete="off"><label>{t.tenant}<input value={tenant} maxLength={32} required disabled={busy} onChange={e=>{clear();setTenant(e.target.value)}}/></label><label>{t.token}<input ref={token} type="password" autoComplete="off" required minLength={32} maxLength={256} disabled={busy}/></label><div className="decision-filters"><button type="submit" disabled={busy}>{busy?t.busy:t.load}</button><button type="button" onClick={clear}>{t.clear}</button></div><p className="finance-note">{t.hint}</p></form>
 {error&&<p role="alert">{t[error]}</p>}
 {result&&<><section className="retail-cart" data-local-studio><h2>{result.tenantId}</h2><p>{result.generatedAt}</p><div className="finance-kpis"><article><p>{t.completed}</p><strong>{result.completed}</strong></article><article><p>{t.pending}</p><strong>{result.pending}</strong></article></div></section>
 <section className="retail-cart"><h2>{t.timeline}</h2>{!result.rows.length&&<p>{t.empty}</p>}<div className="decision-timeline">{result.rows.map(r=><article key={r.planId} data-local-decision-row><strong>{r.planId}</strong><p>{r.startDay} — {r.endExclusive} · {r.reason||"—"} · {r.status}</p><div className="decision-values"><div><small>{t.forecast} · {t.sold}</small><b>{r.forecastSold}</b></div><div><small>{t.actual} · {t.sold}</small><b>{r.observation?.actualSold??"—"}</b></div><div><small>{t.forecast} · {t.contribution}</small><b>{money(r.forecastContribution)}</b></div><div><small>{t.actual} · {t.contribution}</small><b>{r.observation?money(r.observation.actualContribution):"—"}</b></div></div></article>)}</div></section>
 <section className="retail-cart"><h2>{t.learning}</h2>{!result.cohorts.length&&<p>{t.noCohort}</p>}<div className="decision-timeline">{result.cohorts.map(c=><article key={c.forecastDigest}><strong>{c.itemId}</strong><p>{t.sample}: {c.sampleCount}</p><p>{t.wape}: {c.soldWapeBps===undefined?"—":new Intl.NumberFormat(lang,{minimumFractionDigits:2,maximumFractionDigits:2}).format(c.soldWapeBps/100)+"%"}</p><p>{advisory[c.advisory]}</p></article>)}</div><p>{t.unknown}</p></section></>}
 </main>
}
