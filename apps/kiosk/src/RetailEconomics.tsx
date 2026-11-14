import {useState} from "react";
import catalogPresets from "../../../services/api/universal-catalog-presets.json";
import recipePresets from "../../../services/api/recipe-cost-presets.json";
import "./retail.css";
import "./retail-finance.css";

type Lang="tr"|"ru"|"en";
const copy={
 tr:{title:"Ekonomik istihbarat",note:"Yerel örnek simülasyon; gerçek veri veya talep tahmini değil.",discount:"İndirim (%)",conversion:"Kampanya dönüşümü (%)",visits:"Ziyaretçi",capacity:"Üretim kapasitesi (adet)",budget:"Ortak malzeme bütçesi (porsiyon)",expense:"Kampanya gideri (₺)",base:"Normal",promo:"Kampanya",sold:"Satılan",unmet:"Karşılanmayan",contribution:"Katkı",difference:"Ek katkı",window:"Zaman / kanal",counter:"Tezgâh",delivery:"Teslimat",day:"Gün",cost:"Malzeme maliyeti / porsiyon",limit:"Sınır",demand:"Talep",ingredients:"Malzeme",cap:"Kapasite",block:"Marj kontrolü gerekli",none:"Satış mümkün değil",review:"Ekonomiyi inceleyin",reviewCap:"Kapasiteyi inceleyin",scenario:"Senaryoyu inceleyin",hint:"Normal dönüşüm %20. Diğer örnek birim giderleri 5 ₺ (tezgâh), 12 ₺ (teslimat). Kira, vergi ve diğer sabit giderler dahil değil. Malzeme bütçesi ölçülmüş stok değildir."},
 ru:{title:"Экономический интеллект",note:"Локальная симуляция на примере; не реальные данные и не прогноз спроса.",discount:"Скидка (%)",conversion:"Конверсия акции (%)",visits:"Посетители",capacity:"Мощность (порций)",budget:"Общий запас ингредиентов (порций)",expense:"Расходы на акцию (₺)",base:"Обычные продажи",promo:"Акция",sold:"Продано",unmet:"Не обслужено",contribution:"Вклад",difference:"Дополнительный вклад",window:"Время / канал",counter:"У стойки",delivery:"Доставка",day:"День",cost:"Ингредиенты / порция",limit:"Ограничение",demand:"Спрос",ingredients:"Ингредиенты",cap:"Мощность",block:"Проверить маржу",none:"Нет возможных продаж",review:"Пересмотреть экономику",reviewCap:"Пересмотреть мощности",scenario:"Рассмотреть сценарий",hint:"Обычная конверсия 20%. Условные прочие расходы на порцию: 5 ₺ у стойки, 12 ₺ при доставке. Аренда, налоги и другие фиксированные расходы не учтены. Запас задан как допущение."},
 en:{title:"Economic intelligence",note:"Local illustrative simulation, not measured data or demand forecast.",discount:"Discount (%)",conversion:"Campaign conversion (%)",visits:"Visitors",capacity:"Capacity (servings)",budget:"Shared ingredient budget (servings)",expense:"Campaign expense (₺)",base:"Normal sales",promo:"Campaign",sold:"Sold",unmet:"Unserved",contribution:"Contribution",difference:"Incremental contribution",window:"Time / channel",counter:"Counter",delivery:"Delivery",day:"Day",cost:"Ingredients / serving",limit:"Constraint",demand:"Demand",ingredients:"Ingredients",cap:"Capacity",block:"Review margin",none:"No feasible sales",review:"Review economics",reviewCap:"Review capacity",scenario:"Review scenario",hint:"Normal conversion is 20%. Sample other costs per serving: 5 ₺ counter, 12 ₺ delivery. Excludes rent, taxes and other fixed expenses. Ingredient budget is an assumption."}
};
const coffee=catalogPresets.find(x=>x.tenantId==="robys")!.items.find(x=>x.id==="latte")!;
const book=recipePresets.find(x=>x.tenantId==="robys")!;
const portion=book.recipes.find(x=>x.itemId==="latte")!.portions.find(x=>x.variantId==="regular")!;
const price=coffee.variants.find(x=>x.id==="regular")!.price;
const cost=portion.components.reduce((sum,p)=>{const pack=book.costs.find(x=>x.ingredientId===p.ingredientId)!;return sum+Math.ceil(p.quantity*pack.packCost/pack.packQuantity)},0);
type Window={id:string;day:number;channel:"counter"|"delivery";visits:number;conversion:number;capacity:number;other:number};
const initial:Window[]=[{id:"morning",day:1,channel:"counter",visits:100,conversion:30,capacity:25,other:500},{id:"delivery",day:1,channel:"delivery",visits:50,conversion:40,capacity:20,other:1200},{id:"next",day:2,channel:"counter",visits:50,conversion:40,capacity:25,other:500}];
function simulate(windows:Window[],budget:number,discount:number,expense:number,promo:boolean){
 const unitPrice=promo?Math.floor(price*(100-discount)/100):price;
 let remaining=budget;
 const rows=windows.map(w=>{const demand=Math.floor(w.visits*(promo?w.conversion:20)/100);const sold=Math.min(demand,w.capacity,remaining);const limit=sold<Math.min(demand,w.capacity)?"ingredients":sold<demand?"cap":"demand";remaining-=sold;const unit=unitPrice-cost-w.other;return {...w,demand,sold,limit,unit,contribution:sold*unit}});
 return {rows,sold:rows.reduce((s,r)=>s+r.sold,0),unmet:rows.reduce((s,r)=>s+r.demand-r.sold,0),total:rows.reduce((s,r)=>s+r.contribution,0)-(promo?expense*100:0),unitPrice};
}
export function RetailEconomics(){
 const [lang,setLang]=useState<Lang>("tr"),[windows,setWindows]=useState(initial),[budget,setBudget]=useState(60),[discount,setDiscount]=useState(10),[expense,setExpense]=useState(100);
 const t=copy[lang],money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 const base=simulate(windows,budget,discount,expense,false),promo=simulate(windows,budget,discount,expense,true);
 const diff=promo.total-base.total;
 const decision=promo.rows.some(r=>r.demand>0&&(r.unit<=0||r.unit*10000<promo.unitPrice*2000))?t.block:!promo.sold?t.none:diff<=0?t.review:promo.unmet>0?t.reviewCap:t.scenario;
 function update(id:string,key:"visits"|"conversion"|"capacity",value:number){setWindows(old=>old.map(w=>w.id===id?{...w,[key]:value}:w))}
 return <main className="retail finance"><header><a href="#retail-catalog-studio">← BiteOS</a><strong>ECONOMICS</strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}>{["tr","ru","en"].map(l=><option key={l}>{l}</option>)}</select></header><section className="retail-hero"><h1>{t.title}</h1><p>{t.note}</p><p>Latte · {money(price)} · {t.cost}: {money(cost)}</p></section>
 <section className="retail-cart"><label>{t.discount}: {discount}<input type="range" min="0" max="90" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></label><label>{t.budget}: {budget}<input type="range" min="0" max="200" value={budget} onChange={e=>setBudget(Number(e.target.value))}/></label><label>{t.expense}: {expense}<input type="range" min="0" max="1000" value={expense} step="10" onChange={e=>setExpense(Number(e.target.value))}/></label></section>
 {windows.map(w=><section key={w.id} className="retail-cart"><h3>{t.day} {w.day} · {t[w.channel]}</h3>{(["visits","conversion","capacity"] as const).map(k=><label key={k}>{t[k]}: {w[k]}<input type="range" min="0" max={k==="conversion"?100:200} value={w[k]} onChange={e=>update(w.id,k,Number(e.target.value))}/></label>)}</section>)}
 <section className="retail-cart"><h2>{t.difference}: {money(diff)}</h2><p role="status">{decision}</p><div className="finance-table"><table><thead><tr><th></th><th>{t.base}</th><th>{t.promo}</th></tr></thead><tbody><tr><th scope="row">{t.sold}</th><td>{base.sold}</td><td>{promo.sold}</td></tr><tr><th scope="row">{t.unmet}</th><td>{base.unmet}</td><td>{promo.unmet}</td></tr><tr><th scope="row">{t.contribution}</th><td>{money(base.total)}</td><td>{money(promo.total)}</td></tr></tbody></table></div>
 <div className="finance-table"><table><thead><tr><th>{t.window}</th><th>{t.sold}</th><th>{t.unmet}</th><th>{t.limit}</th></tr></thead><tbody>{promo.rows.map(r=><tr key={r.id}><th scope="row">{t.day} {r.day} · {t[r.channel]}</th><td>{r.sold}</td><td>{r.demand-r.sold}</td><td>{t[r.limit as "ingredients"|"cap"|"demand"]}</td></tr>)}</tbody></table></div></section><p className="finance-note">{t.hint}</p></main>
}
