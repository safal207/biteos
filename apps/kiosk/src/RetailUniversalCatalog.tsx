import {useState} from "react";
import presets from "../../../services/api/universal-catalog-presets.json";
import "./retail.css";
import "./retail-finance.css";
type Lang="tr"|"ru"|"en";
type Names=Record<Lang,string>;
type Option={id:string;name:Names;delta:number;ingredients:string[]};
type Group={id:string;name:Names;min:number;max:number;options:Option[]};
type Item={id:string;kind:string;name:Names;price:number;unit:string;available:boolean;ingredients:string[];allergenStatus:string;durationMinutes?:number;variants:{id:string;name:Names;price:number}[];groups:Group[]};
type Catalog={version:number;tenantId:string;currency:string;ingredients:{id:string;name:Names}[];items:Item[]};
const copy={
 tr:{title:"Evrensel katalog",note:"Örnek katalog ve fiyat önizlemesi; sipariş veya gerçek menü değil.",tenant:"Marka örneği",item:"Ürün / hizmet",name:"Ad",price:"Temel fiyat (₺)",variant:"Boyut",extras:"Ek seçenek",qty:"Adet",total:"Örnek toplam",ingredients:"Örnek içerikler",unknown:"Alerjen bilgisi doğrulanmadı. İçerik listesi eksik olabilir.",json:"Yerel taslak JSON",reset:"Sıfırla",duration:"Süre (dk)",invalid:"Geçerli fiyat ve ad girin.",hint:"Yalnızca taslak. Sunucu kurulumunda tüm yapı ve referanslar yeniden doğrulanır.",available:"Mevcut (örnek)",noQuote:"Geçerli seçim gerekli"},
 ru:{title:"Универсальный каталог",note:"Пример каталога и цены; не реальные меню и заказы.",tenant:"Пример бренда",item:"Товар / услуга",name:"Название",price:"Базовая цена (₺)",variant:"Вариант",extras:"Дополнения",qty:"Количество",total:"Условная сумма",ingredients:"Пример ингредиентов",unknown:"Аллергены не проверены. Список ингредиентов может быть неполным.",json:"Локальный черновик JSON",reset:"Сбросить",duration:"Длительность, мин.",invalid:"Введите корректную цену и название.",hint:"Это черновик. При установке сервер повторно проверяет структуру и все ссылки.",available:"Доступно (пример)",noQuote:"Нужен допустимый выбор"},
 en:{title:"Universal catalog",note:"Sample catalog and price preview; not real menus or orders.",tenant:"Sample brand",item:"Item / service",name:"Name",price:"Base price (₺)",variant:"Variant",extras:"Extras",qty:"Quantity",total:"Illustrative total",ingredients:"Sample ingredients",unknown:"Allergens unverified. Ingredient list may be incomplete.",json:"Local JSON draft",reset:"Reset",duration:"Duration (min)",invalid:"Enter a valid price and name.",hint:"Draft only. Server installation revalidates structure and references.",available:"Available (sample)",noQuote:"Valid selection required"}
};
const langs:Lang[]=["tr","ru","en"];
const kindNames:Record<string,Names>={product:{tr:"Ürün",ru:"Товар",en:"Product"},drink:{tr:"İçecek",ru:"Напиток",en:"Drink"},dish:{tr:"Yemek",ru:"Блюдо",en:"Dish"},service:{tr:"Hizmet",ru:"Услуга",en:"Service"}};
const getCatalog=(id:string):Catalog=>structuredClone((presets.find(c=>c.tenantId===id)??presets[0]) as Catalog);
const validPrice=(p:number)=>Number.isInteger(p)&&p>=1&&p<=100000000;
const validName=(s:string)=>!!s&&s.trim()===s&&Array.from(s).length<=120&&!/[\p{Cc}\p{Cf}\p{Cs}]/u.test(s);
export function RetailUniversalCatalog(){
 const [lang,setLang]=useState<Lang>("tr"),[catalog,setCatalog]=useState<Catalog>(()=>getCatalog("robys"));
 const [id,setId]=useState("latte"),[variant,setVariant]=useState("regular"),[qty,setQty]=useState(1),[picks,setPicks]=useState<Record<string,string[]>>({});
 const t=copy[lang],item=catalog.items.find(i=>i.id===id)!;
 const money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 function selectItem(i:Item){setId(i.id);setVariant(i.variants[0]?.id??"");setPicks({});setQty(1)}
 function selectCatalog(id:string){const c=getCatalog(id);setCatalog(c);selectItem(c.items[0])}
 function update(patch:Partial<Item>){setCatalog(c=>({...c,items:c.items.map(i=>i.id===id?{...i,...patch}:i)}))}
 function updateVariant(id:string,price:number){update({variants:item.variants.map(v=>v.id===id?{...v,price}:v)})}
 function updateOption(group:string,id:string,delta:number){update({groups:item.groups.map(g=>g.id===group?{...g,options:g.options.map(o=>o.id===id?{...o,delta}:o)}:g)})}
 const valid=catalog.items.every(i=>langs.every(l=>validName(i.name[l]))&&validPrice(i.price)&&i.variants.every(v=>validPrice(v.price))&&i.groups.every(g=>g.options.every(o=>Number.isInteger(o.delta)&&o.delta>=0&&o.delta<=100000000)));
 const quoteValid=valid&&item.available&&Number.isInteger(qty)&&qty>=1&&qty<=20&&item.groups.every(g=>(picks[g.id]?.length??0)>=g.min&&(picks[g.id]?.length??0)<=g.max);
 const addons=item.groups.flatMap(g=>g.options.filter(o=>picks[g.id]?.includes(o.id)));
 const unit=(item.variants.find(v=>v.id===variant)?.price??item.price)+addons.reduce((sum,o)=>sum+o.delta,0);
 const ingredients=[...new Set([...item.ingredients,...addons.flatMap(o=>o.ingredients)])];
 const amount=(n:number)=>Number.isFinite(n)?n/100:"";
 return <main className="retail finance"><header><a href="#retail-brand">← BiteOS</a><strong>CATALOG</strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}>{langs.map(l=><option key={l}>{l}</option>)}</select></header><section className="retail-hero"><h1>{t.title}</h1><p>{t.note}</p></section>
 <section className="retail-cart"><label>{t.tenant}<select value={catalog.tenantId} onChange={e=>selectCatalog(e.target.value)}>{presets.map(c=><option key={c.tenantId}>{c.tenantId}</option>)}</select></label><label>{t.item}<select value={id} onChange={e=>selectItem(catalog.items.find(i=>i.id===e.target.value)!)}>{catalog.items.map(i=><option key={i.id} value={i.id}>{i.name[lang]} · {kindNames[i.kind][lang]}</option>)}</select></label>
 {langs.map(l=><label key={l}>{t.name} · {l.toUpperCase()}<input value={item.name[l]} onChange={e=>update({name:{...item.name,[l]:e.target.value}})}/></label>)}<label>{t.price}<input type="number" min=".01" step=".01" value={amount(item.price)} onChange={e=>update({price:Math.round(e.target.valueAsNumber*100)})}/></label>
 <label><input type="checkbox" checked={item.available} onChange={e=>update({available:e.target.checked})}/>{t.available}</label>
 {item.variants.map(v=><label key={v.id}>{t.variant} · {v.name[lang]} (₺)<input type="number" min=".01" step=".01" value={amount(v.price)} onChange={e=>updateVariant(v.id,Math.round(e.target.valueAsNumber*100))}/></label>)}
 {item.groups.flatMap(g=>g.options.map(o=><label key={g.id+":"+o.id}>{g.name[lang]} · {o.name[lang]} (₺)<input type="number" min="0" step=".01" value={amount(o.delta)} onChange={e=>updateOption(g.id,o.id,Math.round(e.target.valueAsNumber*100))}/></label>))}
 <button onClick={()=>selectCatalog(catalog.tenantId)}>{t.reset}</button>{!valid&&<p role="alert">{t.invalid}</p>}</section>
 <section className="retail-cart"><h2>{item.name[lang]}</h2><p>{kindNames[item.kind][lang]} · {item.unit}</p>{item.durationMinutes&&<p>{t.duration}: {item.durationMinutes}</p>}
 {!!item.variants.length&&<label>{t.variant}<select value={variant} onChange={e=>setVariant(e.target.value)}>{item.variants.map(v=><option key={v.id} value={v.id}>{v.name[lang]} · {money(v.price)}</option>)}</select></label>}
 {item.groups.map(g=><fieldset key={g.id}><legend>{g.name[lang]} ({g.min}–{g.max})</legend>{g.options.map(o=><label key={o.id}><input type="checkbox" checked={picks[g.id]?.includes(o.id)??false} disabled={!picks[g.id]?.includes(o.id)&&(picks[g.id]?.length??0)>=g.max} onChange={e=>setPicks(p=>({...p,[g.id]:e.target.checked?[...(p[g.id]??[]),o.id]:(p[g.id]??[]).filter(x=>x!==o.id)}))}/>{o.name[lang]} · +{money(o.delta)}</label>)}</fieldset>)}
 <label>{t.qty}<input type="number" min="1" max="20" step="1" value={Number.isFinite(qty)?qty:""} onChange={e=>setQty(e.target.valueAsNumber)}/></label><h2>{t.total}: {quoteValid?money(qty*unit):t.noQuote}</h2><p>{t.ingredients}: {ingredients.map(id=>catalog.ingredients.find(i=>i.id===id)?.name[lang]??id).join(", ")||"—"}</p><p className="finance-note">{t.unknown}</p></section>
 <section className="retail-cart"><label>{t.json}<textarea readOnly rows={12} style={{width:"100%",font:"inherit"}} value={valid?JSON.stringify(catalog,null,2):""}/></label><p>{t.hint}</p></section></main>
}
