import { useEffect,useState } from "react";
import { IS_DEMO } from "./types";
import "./retail.css";
import "./retail-finance.css";

type Lang="tr"|"ru"|"en";
type Product={id:string;name:Record<Lang,string>;price:number;cost:number;stock:number};
type Data={products:Product[];pairs:{first:string;second:string;orders:number}[];fulfilled:number};
type Plan={salePrice:number;minPrice:number;unitProfit:number;baselineProfit:number;expectedProfit:number;incrementalProfit:number;breakEvenUnits:number|null;decision:string};
const sample:Data={products:[{id:"milk",name:{tr:"Süt",ru:"Молоко",en:"Milk"},price:4900,cost:3100,stock:20},{id:"avocado",name:{tr:"Avokado",ru:"Авокадо",en:"Avocado"},price:4500,cost:2800,stock:18}],pairs:[],fulfilled:0};
const copy={
tr:["Kampanya planlayıcı","Yalnızca senaryo · kampanya yayınlanmaz","Ürün","İndirim (%)","Asgari marj (%)","Normal satış adedi","Beklenen satış adedi","Reklam gideri (₺)","Hesapla","Kampanya fiyatı","Asgari fiyat","Birim kâr","Normal kâr","Beklenen katkı","Ek katkı","Başa baş adedi","Birlikte alınanlar","Yeterli veri yok","Hesaplama başarısız"],
ru:["Планировщик акций","Только сценарий · акция не публикуется","Товар","Скидка (%)","Минимальная маржа (%)","Обычный объём, шт.","Ожидаемый объём, шт.","Расходы на рекламу (₺)","Рассчитать","Цена по акции","Минимальная цена","Прибыль с единицы","Обычная прибыль","Ожидаемый вклад","Дополнительный вклад","Объём для сохранения прибыли","Совместные покупки","Недостаточно данных","Расчёт недоступен"],
en:["Promotion planner","Scenario only · no campaign activation","Product","Discount (%)","Minimum margin (%)","Baseline units","Expected units","Ad expense (₺)","Calculate","Sale price","Minimum price","Unit profit","Baseline profit","Expected contribution","Incremental contribution","Units to preserve profit","Co-purchases","Insufficient data","Calculation unavailable"]
};
const statuses:Record<string,Record<Lang,string>>={NO_STOCK:{tr:"Stok yok",ru:"Нет товара",en:"No stock"},MARGIN_BLOCK:{tr:"Marj yetersiz",ru:"Маржа ниже порога",en:"Margin too low"},STOCK_BLOCK:{tr:"Stok yetersiz",ru:"Недостаточно запасов",en:"Insufficient stock"},BREAK_EVEN_UNREACHABLE:{tr:"Hedef stokla mümkün değil",ru:"Цель недостижима при текущем запасе",en:"Target cannot be reached with stock"},REVIEW_VOLUME:{tr:"Hacmi gözden geçirin",ru:"Нужно увеличить объём",en:"Review volume"},SCENARIO_VIABLE:{tr:"Senaryo uygun",ru:"Сценарий выгоден при допущениях",en:"Scenario viable under assumptions"}};
export function RetailGrowth(){
 const [lang,setLang]=useState<Lang>("tr"),[data,setData]=useState<Data|null>(IS_DEMO?sample:null);
 const [id,setId]=useState("milk"),[discount,setDiscount]=useState(10),[margin,setMargin]=useState(20),[baseline,setBaseline]=useState(5),[expected,setExpected]=useState(10),[ad,setAd]=useState(0);
 const [result,setResult]=useState<Plan|null>(null),[error,setError]=useState(false),[busy,setBusy]=useState(false);
 const t=copy[lang];
 useEffect(()=>{if(IS_DEMO)return;const c=new AbortController();fetch("/api/retail/growth",{signal:c.signal,cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<Data>}).then(d=>{setData(d);setId(d.products[0]?.id??"")}).catch(()=>{if(!c.signal.aborted)setError(true)});return()=>c.abort()},[]);
 const p=data?.products.find(p=>p.id===id);
 const money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 const update=(setter:(n:number)=>void,n:number)=>{setter(n);setResult(null);setError(false)};
 const valid=[discount,margin,baseline,expected,ad].every(Number.isFinite)&&discount>=0&&discount<=90&&margin>=0&&margin<=90&&Number.isInteger(baseline)&&baseline>=0&&baseline<=100000&&Number.isInteger(expected)&&expected>=1&&expected<=100000&&ad>=0&&ad<=100000000;
 async function calculate(){
  if(!p||!valid||busy)return;setBusy(true);setError(false);setResult(null);
  try{
   const input={productId:id,discountBps:Math.round(discount*100),minMarginBps:Math.round(margin*100),baselineUnits:baseline,expectedUnits:expected,campaignCost:Math.round(ad*100)};
   if(IS_DEMO){
    const salePrice=Math.floor(p.price*(10000-input.discountBps)/10000),minPrice=Math.ceil(p.cost*10000/(10000-input.minMarginBps)),unitProfit=salePrice-p.cost,baselineProfit=baseline*(p.price-p.cost),expectedProfit=expected*unitProfit-input.campaignCost,incrementalProfit=expectedProfit-baselineProfit,breakEvenUnits=unitProfit>0?Math.ceil(Math.max(0,baselineProfit+input.campaignCost)/unitProfit):null;
    const decision=p.stock<=0||p.cost<=0?"NO_STOCK":salePrice<minPrice||unitProfit<=0?"MARGIN_BLOCK":baseline>p.stock||expected>p.stock?"STOCK_BLOCK":breakEvenUnits===null||breakEvenUnits>p.stock?"BREAK_EVEN_UNREACHABLE":incrementalProfit<0?"REVIEW_VOLUME":"SCENARIO_VIABLE";
    setResult({salePrice,minPrice,unitProfit,baselineProfit,expectedProfit,incrementalProfit,breakEvenUnits,decision});
   }else{
    const r=await fetch("/api/retail/growth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});if(!r.ok)throw Error();setResult(await r.json() as Plan);
   }
  }catch{setError(true)}finally{setBusy(false)}
 }
 return <main className="retail finance"><header><a href="#retail-finance">← Finance</a><strong>BiteOS <small>GROWTH</small></strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="tr">TR</option><option value="ru">RU</option><option value="en">EN</option></select></header><section className="retail-hero"><p>ROZAL · DEMO</p><h1>{t[0]}</h1><p>{t[1]}</p></section>
 {error&&<p role="alert">{t[18]}</p>}
 <section className="retail-cart"><label>{t[2]} <select disabled={busy||!data} value={id} onChange={e=>{setId(e.target.value);setResult(null)}}>{data?.products.map(p=><option key={p.id} value={p.id}>{p.name[lang]}</option>)}</select></label>
 {p&&<p>{p.name[lang]} · {money(p.price)} · {money(p.cost)} · {p.stock} pcs</p>}
 {([[t[3],discount,setDiscount,90],[t[4],margin,setMargin,90],[t[5],baseline,setBaseline,100000],[t[6],expected,setExpected,100000],[t[7],ad,setAd,100000000]] as [string,number,(n:number)=>void,number][]).map(([label,value,setter,max])=><label key={label}>{label}<input disabled={busy} type="number" min={0} max={max} step={label===t[5]||label===t[6]?1:0.01} value={Number.isFinite(value)?value:""} onChange={e=>update(setter,e.target.valueAsNumber)}/></label>)}
 <button disabled={!p||!valid||busy} onClick={()=>void calculate()}>{t[8]}</button></section>
 {result&&<section className="retail-cart" aria-live="polite"><h2>{statuses[result.decision]?.[lang]??result.decision}</h2><div className="finance-detail">{([[t[9],result.salePrice],[t[10],result.minPrice],[t[11],result.unitProfit],[t[12],result.baselineProfit],[t[13],result.expectedProfit],[t[14],result.incrementalProfit]] as [string,number][]).map(([k,v])=><div key={k}><span>{k}</span><b>{money(v)}</b></div>)}<div><span>{t[15]}</span><b>{result.breakEvenUnits??"—"}</b></div></div></section>}
 <section className="retail-cart"><h2>{t[16]}</h2>{data?.pairs.length?<ul>{data.pairs.map(x=><li key={x.first+":"+x.second}>{data.products.find(p=>p.id===x.first)?.name[lang]} + {data.products.find(p=>p.id===x.second)?.name[lang]} · {x.orders}</li>)}</ul>:<p>{t[17]}</p>}</section></main>
}
