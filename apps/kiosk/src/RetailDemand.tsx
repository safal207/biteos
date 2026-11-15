import { useEffect,useRef,useState } from "react";
import { IS_DEMO } from "./types";
import "./retail.css";
import "./retail-finance.css";

type Lang="tr"|"ru"|"en";
type Candidate={id:string;name:Record<Lang,string>;unit:string;requests:number;units:number};
type Plan={investment:number;revenue:number;contribution:number;unsoldUnits:number;unsoldCost:number;breakEvenUnits:number;unitGrossMarginBPS:number;decision:string};
const sample:Candidate[]=[
 {id:"kefir",name:{tr:"Kefir",ru:"Кефир",en:"Kefir"},unit:"1 L",requests:0,units:0},
 {id:"tvorog",name:{tr:"Lor / tvorog",ru:"Творог",en:"Tvorog"},unit:"250 g",requests:0,units:0},
 {id:"sour-cream",name:{tr:"Ekşi krema",ru:"Сметана",en:"Sour cream"},unit:"200 g",requests:0,units:0},
 {id:"rye-bread",name:{tr:"Çavdar ekmeği",ru:"Ржаной хлеб",en:"Rye bread"},unit:"1 pc",requests:0,units:0}
];
const labels={
 tr:{customer:"Hangi ürünü istersiniz?",owner:"Talep ve satın alma planı",note:"Örnek adaylar · sipariş, ön ödeme veya stok sözü değil.",static:"Bu örnekte kayıt yalnızca açık ekrandadır; mağazaya iletilmez.",local:"Yerel demo; sinyaller benzersiz müşteri veya kesin satış değildir.",product:"Ürün",quantity:"İstenen adet",send:"İlgimi kaydet",done:"İlgi kaydedildi (demo)",retry:"Aynı isteği yeniden dene",error:"İşlem doğrulanamadı",signals:"İstek",units:"İstenen adet",batch:"Parti adedi",cost:"Birim alış maliyeti (₺)",price:"Satış fiyatı (₺)",sold:"Tahmini satış adedi",fixed:"Ek parti gideri (₺)",margin:"Asgari brüt marj (%)",calc:"Senaryoyu hesapla",investment:"Toplam yatırım",revenue:"Tahmini gelir",contribution:"Parti katkısı",unsold:"Satılmayan adedin maliyeti",breakEven:"Başa baş adedi",warning:"Satılmayan ürünün geri kazanım değeri sıfır kabul edilir. Tahmin garanti değildir; vergi ve diğer giderler dahil değil.",refresh:"Yenile"},
 ru:{customer:"Какого товара вам не хватает?",owner:"Спрос и план закупок",note:"Пример товаров-кандидатов · не заказ, предоплата или обещание наличия.",static:"В этом примере запрос остаётся на открытом экране и не отправляется магазину.",local:"Локальное демо: запросы не равны числу покупателей или гарантированным продажам.",product:"Товар",quantity:"Желаемое количество",send:"Оставить запрос",done:"Интерес записан (демо)",retry:"Повторить тот же запрос",error:"Операция не подтверждена",signals:"Запросы",units:"Запрошено, шт.",batch:"Размер партии",cost:"Закупочная цена (₺)",price:"Цена продажи (₺)",sold:"Ожидаемые продажи, шт.",fixed:"Дополнительные расходы (₺)",margin:"Минимальная валовая маржа (%)",calc:"Рассчитать сценарий",investment:"Вложения",revenue:"Ожидаемая выручка",contribution:"Вклад партии",unsold:"Стоимость непроданного остатка",breakEven:"Продать для окупаемости, шт.",warning:"Непроданный остаток условно не имеет остаточной ценности. Прогноз не гарантирован; налоги и прочие расходы не учтены.",refresh:"Обновить"},
 en:{customer:"Which product would you like?",owner:"Demand and procurement planning",note:"Sample candidates · not an order, deposit or stock promise.",static:"In this example requests stay on the open screen and are not sent to the store.",local:"Local demo: signals are not unique buyers or guaranteed sales.",product:"Product",quantity:"Desired quantity",send:"Register interest",done:"Interest recorded (demo)",retry:"Retry same request",error:"Operation not confirmed",signals:"Requests",units:"Requested units",batch:"Batch units",cost:"Unit purchase cost (₺)",price:"Selling price (₺)",sold:"Expected units sold",fixed:"Extra batch cost (₺)",margin:"Minimum gross margin (%)",calc:"Calculate scenario",investment:"Investment",revenue:"Expected revenue",contribution:"Batch contribution",unsold:"Cost of unsold stock",breakEven:"Break-even units",warning:"Unsold stock assumes zero recovery value. Forecast is not guaranteed; excludes taxes and other expenses.",refresh:"Refresh"}
};
const decisions:Record<string,Record<Lang,string>>={
 MARGIN_BLOCK:{tr:"Marj yetersiz",ru:"Недостаточная маржа",en:"Margin too low"},
 BATCH_UNVIABLE:{tr:"Parti başa baş olmaz",ru:"Партия не окупится",en:"Batch cannot break even"},
 REVIEW_SELL_THROUGH:{tr:"Satış tahminini inceleyin",ru:"Пересмотрите объём продаж",en:"Review sell-through"},
 NO_SIGNAL:{tr:"Talep sinyali yok",ru:"Нет сигналов спроса",en:"No demand signal"},
 PILOT_REVIEW:{tr:"Pilot için inceleyin",ru:"Рассмотреть тестовую закупку",en:"Review for pilot"}
};
async function api<T>(path:string,init?:RequestInit):Promise<T>{const r=await fetch(path,init);if(!r.ok)throw Error(String(r.status));return r.json() as Promise<T>}
export function RetailDemand({owner=false}:{owner?:boolean}){
 const [lang,setLang]=useState<Lang>("tr");
 const [rows,setRows]=useState<Candidate[]>(IS_DEMO?sample:[]);
 const [id,setId]=useState("kefir"),[qty,setQty]=useState(1);
 const [batch,setBatch]=useState(30),[cost,setCost]=useState(40),[price,setPrice]=useState(65),[sold,setSold]=useState(24),[fixed,setFixed]=useState(100),[margin,setMargin]=useState(20);
 const [result,setResult]=useState<Plan|null>(null),[error,setError]=useState(false),[done,setDone]=useState(false),[busy,setBusy]=useState(false),[retry,setRetry]=useState(false);
 const request=useRef<{key:string;body:string}|null>(null), pending=useRef(false);
 const t=labels[lang], current=rows.find(p=>p.id===id);
 const money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 async function reload(){if(!IS_DEMO){const d=await api<{candidates:Candidate[]}>("/api/retail/demand",{cache:"no-store"});setRows(d.candidates)}}
 useEffect(()=>{void reload().catch(()=>setError(true))},[]);
 async function send(){
  if(pending.current||(!retry&&(!current||!Number.isInteger(qty)||qty<1||qty>10)))return;
  pending.current=true;setBusy(true);setError(false);setDone(false);
  try{
   if(IS_DEMO){setRows(old=>old.map(p=>p.id===id?{...p,requests:p.requests+1,units:p.units+qty}:p))}
   else{
    if(!request.current)request.current={key:crypto.randomUUID(),body:JSON.stringify({candidateId:id,quantity:qty})};
    await api("/api/retail/demand",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":request.current.key},body:request.current.body});
    request.current=null;setRetry(false);void reload().catch(()=>setError(true));
   }
   setDone(true);
  }catch{setError(true);setRetry(request.current!==null)}finally{pending.current=false;setBusy(false)}
 }
 const valid=!!current&&Number.isInteger(batch)&&batch>=1&&batch<=10000&&Number.isInteger(sold)&&sold>=0&&sold<=batch&&[cost,price].every(v=>Number.isFinite(v)&&v>=.01&&v<=1000000)&&Number.isFinite(fixed)&&fixed>=0&&fixed<=100000000&&Number.isFinite(margin)&&margin>=0&&margin<=90;
 async function calculate(){
  if(pending.current||!current||!valid)return;
  pending.current=true;setBusy(true);setError(false);setResult(null);
  try{
   const input={candidateId:id,batchUnits:batch,unitCost:Math.round(cost*100),salePrice:Math.round(price*100),expectedSold:sold,fixedCost:Math.round(fixed*100),minMarginBps:Math.round(margin*100)};
   if(IS_DEMO){
    const investment=batch*input.unitCost+input.fixedCost,revenue=sold*input.salePrice,contribution=revenue-investment,breakEvenUnits=Math.ceil(investment/input.salePrice),unsoldUnits=batch-sold,unsoldCost=unsoldUnits*input.unitCost,unitGrossMarginBPS=Math.trunc((input.salePrice-input.unitCost)*10000/input.salePrice);
    const decision=input.salePrice<=input.unitCost||(input.salePrice-input.unitCost)*10000<input.minMarginBps*input.salePrice?"MARGIN_BLOCK":breakEvenUnits>batch?"BATCH_UNVIABLE":contribution<0?"REVIEW_SELL_THROUGH":current.requests===0?"NO_SIGNAL":"PILOT_REVIEW";
    setResult({investment,revenue,contribution,breakEvenUnits,unsoldUnits,unsoldCost,unitGrossMarginBPS,decision});
   }else setResult(await api<Plan>("/api/retail/demand/plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}))
  }catch{setError(true)}finally{pending.current=false;setBusy(false)}
 }
 const numberFields:[string,number,(n:number)=>void,number,number][]=[[t.batch,batch,setBatch,1,10000],[t.cost,cost,setCost,.01,1000000],[t.price,price,setPrice,.01,1000000],[t.sold,sold,setSold,1,10000],[t.fixed,fixed,setFixed,.01,100000000],[t.margin,margin,setMargin,.01,90]];
 return <main className="retail finance"><header><a href={owner?"#retail-finance":"#retail"}>← ROZAL</a><strong>BiteOS <small>DEMAND</small></strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="tr">TR</option><option value="ru">RU</option><option value="en">EN</option></select></header>
 <section className="retail-hero"><p>ROZAL · DEMO</p><h1>{owner?t.owner:t.customer}</h1><p>{t.note}</p></section><p>{IS_DEMO?t.static:t.local}</p>
 {error&&<p role="alert">{t.error}</p>}
 {owner&&<><section className="retail-cart"><div className="finance-table"><table><thead><tr><th scope="col">{t.product}</th><th scope="col">{t.signals}</th><th scope="col">{t.units}</th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><th scope="row">{p.name[lang]}</th><td>{p.requests}</td><td>{p.units}</td></tr>)}</tbody></table></div>{!IS_DEMO&&<button disabled={busy} onClick={()=>{setResult(null);void reload().catch(()=>setError(true))}}>{t.refresh}</button>}</section></>}
 <section className="retail-cart"><label>{t.product}<select disabled={busy||retry||!rows.length} value={id} onChange={e=>{setId(e.target.value);setResult(null);setDone(false)}}>{rows.map(p=><option key={p.id} value={p.id}>{p.name[lang]} · {p.unit}</option>)}</select></label>
 {owner?<>{numberFields.map(([label,v,setter,step,max])=><label key={label}>{label}<input type="number" disabled={busy} min={0} max={max} step={step} value={Number.isFinite(v)?v:""} onChange={e=>{setter(e.target.valueAsNumber);setResult(null)}}/></label>)}<button disabled={!valid||busy} onClick={()=>void calculate()}>{t.calc}</button></>:<><label>{t.quantity}<input type="number" min={1} max={10} step={1} disabled={busy||retry} value={Number.isFinite(qty)?qty:""} onChange={e=>{setQty(e.target.valueAsNumber);setDone(false)}}/></label><button disabled={busy||(!retry&&(!current||!Number.isInteger(qty)||qty<1||qty>10))} onClick={()=>void send()}>{retry?t.retry:t.send}</button>{done&&<p role="status">{t.done}</p>}</>}
 </section>
 {owner&&result&&<section className="retail-cart"><h2>{decisions[result.decision]?.[lang]??result.decision}</h2><div className="finance-kpis">{([[t.investment,result.investment],[t.revenue,result.revenue],[t.contribution,result.contribution],[t.unsold,result.unsoldCost]] as [string,number][]).map(([label,value])=><article key={label}><p>{label}</p><strong className={value<0?"finance-negative":""}>{money(value)}</strong></article>)}</div><p>{t.breakEven}: <b>{result.breakEvenUnits}</b> · {lang==="tr"?"Birim brüt marj":lang==="ru"?"Валовая маржа товара":"Unit gross margin"}: {(result.unitGrossMarginBPS/100).toFixed(1)}%</p><p className="finance-note">{t.warning}</p></section>}
 </main>
}
