import {useEffect,useState} from "react";
import {IS_DEMO} from "./types";
import "./retail.css";
import "./retail-finance.css";

type Lang="tr"|"ru"|"en";
type Lot={quantity:number;cost:number;useBy?:string};
type Product={id:string;name:Record<Lang,string>;price:number;lots:Lot[]};
type Input={productId:string;days:number;baselineDailyUnits:number;campaignDailyUnits:number;discountBps:number;fulfillmentPerUnit:number;campaignCost:number;includeUnknown:boolean};
type Day={date:string;demand:number;sold:number;unmet:number;remaining:number;heldValue:number;contribution:number};
type Scenario={price:number;sold:number;unmet:number;revenue:number;cogs:number;fulfillment:number;campaignCost:number;contribution:number;remaining:number;heldValue:number;unknownValue:number;daily:Day[]};
type Result={baseline:Scenario;campaign:Scenario;asOf:string;incrementalContribution:number;avoidedHeldValue:number};
const sample={asOf:"2026-11-14",products:[{id:"milk",name:{tr:"Süt",ru:"Молоко",en:"Milk"},price:6500,lots:[{quantity:10,cost:4000,useBy:"2026-11-16"}]}]};
function simulate(p:Product,i:Input,asOf:string,demand:number,price:number,expense:number):Scenario{
 const lots=p.lots.map(l=>({...l}));
 const r:Scenario={price,sold:0,unmet:0,revenue:0,cogs:0,fulfillment:0,campaignCost:expense,contribution:-expense,remaining:0,heldValue:0,unknownValue:0,daily:[]};
 for(let day=0;day<i.days;day++){
  const date=new Date(Date.parse(asOf+"T00:00:00Z")+day*86400000).toISOString().slice(0,10);
  let need=demand,cost=0;
  for(const lot of lots){
   if(!need)break;if(!lot.quantity)continue;
   if(!lot.useBy&&!i.includeUnknown||lot.useBy&&lot.useBy<=date)break;
   const take=Math.min(need,lot.quantity);lot.quantity-=take;need-=take;cost+=take*lot.cost;
  }
  const sold=demand-need,revenue=sold*price,fee=sold*i.fulfillmentPerUnit;
  r.sold+=sold;r.unmet+=need;r.revenue+=revenue;r.cogs+=cost;r.fulfillment+=fee;r.contribution+=revenue-cost-fee;
  r.remaining=lots.reduce((s,l)=>s+l.quantity,0);
  r.heldValue=lots.reduce((s,l)=>s+(l.useBy&&l.useBy<=date?l.quantity*l.cost:0),0);
  r.unknownValue=lots.reduce((s,l)=>s+(!l.useBy?l.quantity*l.cost:0),0);
  r.daily.push({date,demand,sold,unmet:need,remaining:r.remaining,heldValue:r.heldValue,contribution:revenue-cost-fee-(day===0?expense:0)});
 }
 return r;
}
const copy={
 tr:{title:"Dijital ikiz",note:"Varsayım simülasyonu; tahmin veya gerçek işlem değil.",sample:"Sabit örnek stok",local:"Yerel FIFO stok anlık görüntüsü",product:"Ürün",days:"Gün",base:"Normal günlük talep",campaign:"Kampanya günlük talebi",discount:"İndirim (%)",fee:"Birim hazırlama/teslimat gideri (₺)",expense:"Kampanya gideri (₺)",unknown:"Tarihsiz demo stok dahil",calc:"Karşılaştır",normal:"Normal",offer:"Kampanya",sales:"Satılan adet",unmet:"Karşılanmayan talep",contribution:"Katkı",held:"Bloke stok maliyeti",remaining:"Kalan adet",unknownValue:"Tarihsiz stok maliyeti",delta:"Ek katkı",avoid:"Bloke stok farkı",date:"Tarih",error:"Simülasyon alınamadı",warning:"Günlük talep kullanıcı varsayımıdır. Yeni alım, vergi, iade ve fiili imha yok. Bloke stok maliyeti katkıdan düşülmedi; FIFO engeli atlanmaz.",loading:"Yükleniyor"},
 ru:{title:"Цифровой двойник",note:"Сценарная модель, не прогноз и не реальная операция.",sample:"Фиксированный пример запасов",local:"Снимок локального FIFO-запаса",product:"Товар",days:"Горизонт, дней",base:"Обычный спрос в день, шт.",campaign:"Спрос при акции в день, шт.",discount:"Скидка (%)",fee:"Расходы выполнения на единицу (₺)",expense:"Расходы на акцию (₺)",unknown:"Включить недатированные демопартии",calc:"Сравнить сценарии",normal:"Обычные продажи",offer:"Акция",sales:"Продано, шт.",unmet:"Неудовлетворённый спрос",contribution:"Вклад",held:"Стоимость заблокированного запаса",remaining:"Остаток, шт.",unknownValue:"Стоимость запаса без дат",delta:"Дополнительный вклад",avoid:"Разница заблокированного запаса",date:"Дата",error:"Симуляция недоступна",warning:"Дневной спрос — допущение пользователя. Без новых закупок, налогов, возвратов и фактических списаний. Стоимость заблокированного запаса не вычтена из вклада; FIFO-барьер не обходится.",loading:"Загрузка"},
 en:{title:"Digital twin",note:"Scenario simulation, not a forecast or real transaction.",sample:"Fixed illustrative stock",local:"Local FIFO stock snapshot",product:"Product",days:"Days",base:"Normal daily demand",campaign:"Campaign daily demand",discount:"Discount (%)",fee:"Fulfillment cost per unit (₺)",expense:"Campaign expense (₺)",unknown:"Include undated demo lots",calc:"Compare scenarios",normal:"Normal",offer:"Campaign",sales:"Units sold",unmet:"Unmet demand",contribution:"Contribution",held:"Held stock cost",remaining:"Units remaining",unknownValue:"Undated stock cost",delta:"Incremental contribution",avoid:"Difference in held stock",date:"Date",error:"Simulation unavailable",warning:"Daily demand is user-assumed. No replenishment, taxes, returns or actual disposal. Held stock cost is not deducted from contribution; FIFO barriers are preserved.",loading:"Loading"}
};
export function RetailTwin(){
 const [lang,setLang]=useState<Lang>("tr");
 const [data,setData]=useState<{asOf:string;products:Product[]}|null>(IS_DEMO?sample:null);
 const [id,setId]=useState("milk"),[days,setDays]=useState(3),[base,setBase]=useState(2),[campaign,setCampaign]=useState(5),[discount,setDiscount]=useState(10),[fee,setFee]=useState(3),[expense,setExpense]=useState(10),[unknown,setUnknown]=useState(false);
 const [result,setResult]=useState<Result|null>(null),[error,setError]=useState(false),[busy,setBusy]=useState(false);
 const t=copy[lang],p=data?.products.find(p=>p.id===id);
 useEffect(()=>{if(IS_DEMO)return;const c=new AbortController();fetch("/api/retail/twin",{signal:c.signal,cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<{asOf:string;products:Product[]}>}).then(d=>{if(!c.signal.aborted){setData(d);setId(d.products.find(p=>p.id==="milk")?.id??d.products[0]?.id??"")}}).catch(()=>{if(!c.signal.aborted)setError(true)});return()=>c.abort()},[]);
 const valid=!!p&&Number.isInteger(days)&&days>=1&&days<=30&&[base,campaign].every(n=>Number.isInteger(n)&&n>=0&&n<=1000)&&Number.isFinite(discount)&&discount>=0&&discount<=90&&Number.isFinite(fee)&&fee>=0&&fee<=1000000&&Number.isFinite(expense)&&expense>=0&&expense<=100000000;
 const money=(v:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(v/100);
 const fields:[string,number,(n:number)=>void,number,number][]=[[t.days,days,setDays,1,30],[t.base,base,setBase,1,1000],[t.campaign,campaign,setCampaign,1,1000],[t.discount,discount,setDiscount,.01,90],[t.fee,fee,setFee,.01,1000000],[t.expense,expense,setExpense,.01,100000000]];
 async function calculate(){
  if(!p||!data||!valid||busy)return;setBusy(true);setResult(null);setError(false);
  try{
   const i:Input={productId:id,days,baselineDailyUnits:base,campaignDailyUnits:campaign,discountBps:Math.round(discount*100),fulfillmentPerUnit:Math.round(fee*100),campaignCost:Math.round(expense*100),includeUnknown:unknown};
   if(IS_DEMO){
    const a=simulate(p,i,data.asOf,base,p.price,0),b=simulate(p,i,data.asOf,campaign,Math.floor(p.price*(10000-i.discountBps)/10000),i.campaignCost);
    setResult({baseline:a,campaign:b,asOf:data.asOf,incrementalContribution:b.contribution-a.contribution,avoidedHeldValue:a.heldValue-b.heldValue});
   }else{
    const r=await fetch("/api/retail/twin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(i)});if(!r.ok)throw Error();setResult(await r.json() as Result);
   }
  }catch{setError(true)}finally{setBusy(false)}
 }
 return <main className="retail finance"><header><a href="#retail-finance">← Finance</a><strong>BiteOS <small>TWIN</small></strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="tr">TR</option><option value="ru">RU</option><option value="en">EN</option></select></header><section className="retail-hero"><p>ROZAL · LAB</p><h1>{t.title}</h1><p>{t.note}</p></section>
 <p>{IS_DEMO?t.sample:t.local}</p>{error&&<p role="alert">{t.error}</p>}{!data&&!error&&<p role="status">{t.loading}</p>}
 <section className="retail-cart"><label>{t.product}<select value={id} disabled={busy||!data} onChange={e=>{setId(e.target.value);setResult(null)}}>{data?.products.map(p=><option key={p.id} value={p.id}>{p.name[lang]}</option>)}</select></label>
 {fields.map(([label,v,setter,step,max])=><label key={label}>{label}<input disabled={busy} type="number" min={0} max={max} step={step} value={Number.isFinite(v)?v:""} onChange={e=>{setter(e.target.valueAsNumber);setResult(null)}}/></label>)}
 <label><input type="checkbox" disabled={busy} checked={unknown} onChange={e=>{setUnknown(e.target.checked);setResult(null)}}/>{t.unknown}</label>
 <button disabled={!valid||busy} onClick={()=>void calculate()}>{t.calc}</button></section>
 {result&&<><p>{result.asOf} · TRT</p><div className="finance-kpis"><article><p>{t.delta}</p><strong>{money(result.incrementalContribution)}</strong></article><article><p>{t.avoid}</p><strong>{money(result.avoidedHeldValue)}</strong></article></div>
 <div className="finance-table"><table><thead><tr><th></th><th scope="col">{t.normal}</th><th scope="col">{t.offer}</th></tr></thead><tbody>{([[t.sales,result.baseline.sold,result.campaign.sold,false],[t.unmet,result.baseline.unmet,result.campaign.unmet,false],[t.contribution,result.baseline.contribution,result.campaign.contribution,true],[t.remaining,result.baseline.remaining,result.campaign.remaining,false],[t.held,result.baseline.heldValue,result.campaign.heldValue,true],[t.unknownValue,result.baseline.unknownValue,result.campaign.unknownValue,true]] as [string,number,number,boolean][]).map(([label,a,b,c])=><tr key={label}><th scope="row">{label}</th><td>{c?money(a):a}</td><td>{c?money(b):b}</td></tr>)}</tbody></table></div>
 <div className="finance-table"><table><thead><tr><th scope="col">{t.date}</th><th scope="col">{t.normal} · {t.sales}</th><th scope="col">{t.offer} · {t.sales}</th><th scope="col">{t.normal} · {t.held}</th><th scope="col">{t.offer} · {t.held}</th></tr></thead><tbody>{result.baseline.daily.map((d,i)=><tr key={d.date}><th scope="row">{d.date}</th><td>{d.sold}</td><td>{result.campaign.daily[i].sold}</td><td>{money(d.heldValue)}</td><td>{money(result.campaign.daily[i].heldValue)}</td></tr>)}</tbody></table></div></>}
 <p className="finance-note">{t.warning}</p></main>
}
