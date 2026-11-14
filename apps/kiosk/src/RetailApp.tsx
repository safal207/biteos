import { useEffect, useRef, useState } from "react";
import { IS_DEMO } from "./types";
import "./retail.css";
import { RetailClubPanel } from "./RetailClubPanel";
import { parseClubList, snapshotCart } from "./retailClub";
import type { ClubList } from "./retailClub";

type Lang = "tr" | "ru" | "en";
type Product = {id:string;name:Record<Lang,string>;category:string;unit:string;price:number;stock:number};
type Slot = {id:string;label:string;capacity:number;remaining:number};
type Zone = {id:string;name:string;fee:number;minimum:number;slots:Slot[]};
const demoZones:Zone[]=[{id:"center",name:"Gazipaşa · merkez",fee:3500,minimum:5000,slots:[{id:"center-a",label:"10:00–12:00",capacity:3,remaining:3},{id:"center-b",label:"16:00–18:00",capacity:5,remaining:5}]},{id:"outer",name:"Gazipaşa · çevre",fee:6500,minimum:15000,slots:[{id:"outer-a",label:"12:00–14:00",capacity:2,remaining:2},{id:"outer-b",label:"18:00–20:00",capacity:3,remaining:3}]}];
const deliveryCopy={tr:{zone:"Bölge",slot:"Örnek zaman aralığı",minimum:"Minimum sipariş",remaining:"Boş yer",unavailable:"Teslimat seçeneği yok"},ru:{zone:"Зона",slot:"Демонстрационный интервал",minimum:"Минимальный заказ",remaining:"Свободно",unavailable:"Нет доступной доставки"},en:{zone:"Zone",slot:"Sample time window",minimum:"Minimum order",remaining:"Available",unavailable:"Delivery unavailable"}};
type RetailOrder = {id:string;status:string;total:number;mode:"pickup"|"delivery";zoneId?:string;slotId?:string;lines?:{id:string;quantity:number;unitPrice:number}[];events:{status:string;at:string}[]};
const seed: Product[] = [
  {id:"avocado",name:{tr:"Avokado",ru:"Авокадо",en:"Avocado"},category:"fresh",unit:"1 pc",price:4500,stock:18},
  {id:"banana",name:{tr:"Muz",ru:"Бананы",en:"Bananas"},category:"fresh",unit:"500 g",price:3900,stock:30},
  {id:"milk",name:{tr:"Süt",ru:"Молоко",en:"Milk"},category:"dairy",unit:"1 L",price:4900,stock:20},
  {id:"eggs",name:{tr:"Yumurta",ru:"Яйца",en:"Eggs"},category:"dairy",unit:"6 pcs",price:7200,stock:12},
  {id:"bread",name:{tr:"Ekmek",ru:"Хлеб",en:"Bread"},category:"pantry",unit:"1 pc",price:6500,stock:15},
  {id:"buckwheat",name:{tr:"Karabuğday",ru:"Гречка",en:"Buckwheat"},category:"international",unit:"500 g",price:9500,stock:9},
  {id:"dumplings",name:{tr:"Pelmeni",ru:"Пельмени",en:"Pelmeni"},category:"international",unit:"400 g",price:16500,stock:8}
];
const icons:Record<string,string>={avocado:"🥑",banana:"🍌",milk:"🥛",eggs:"🥚",bread:"🍞",buckwheat:"🌾",dumplings:"🥟"};
const copy = {
  tr:{title:"Mahallenizin marketi",demo:"Bağımsız konsept · örnek fiyatlar ve stoklar · gerçek sipariş değil",search:"Ürün ara",all:"Tümü",fresh:"Meyve & sebze",dairy:"Kahvaltı",pantry:"Temel gıda",international:"Dünya lezzetleri",cart:"Sepet",pickup:"Mağazadan al",delivery:"Teslimat",contact:"Değişiklik için bana ulaşın (tercih)",skip:"Eksik ürünü çıkar",submit:"Demo sipariş",next:"Sonraki demo adımı",cancel:"İptal",fee:"Teslimat ücreti",total:"Toplam",repeat:"Tekrar alışveriş",available:"Stok",order:"Sipariş",error:"İşlem başarısız; tekrar deneyin."},
  ru:{title:"Магазин вашего района",demo:"Независимый концепт · примерные цены и остатки · не настоящий заказ",search:"Найти продукт",all:"Все",fresh:"Овощи и фрукты",dairy:"Завтрак",pantry:"Бакалея",international:"Мировые продукты",cart:"Корзина",pickup:"Самовывоз",delivery:"Доставка",contact:"Связаться при замене (пожелание)",skip:"Не заменять",submit:"Демозаказ",next:"Следующий демоэтап",cancel:"Отменить",fee:"Стоимость доставки",total:"Итого",repeat:"К покупкам",available:"Остаток",order:"Заказ",error:"Не удалось выполнить запрос. Повторите."},
  en:{title:"Your neighborhood market",demo:"Independent concept · sample prices and inventory · no real orders",search:"Find groceries",all:"All",fresh:"Fruit & veg",dairy:"Breakfast",pantry:"Pantry",international:"International",cart:"Cart",pickup:"Pickup",delivery:"Delivery",contact:"Contact me about replacements (preference)",skip:"Skip missing items",submit:"Demo order",next:"Next demo step",cancel:"Cancel",fee:"Delivery fee",total:"Total",repeat:"Shop again",available:"Stock",order:"Order",error:"Request failed; please retry."}
};
const track:Record<string,Record<Lang,string>>={
  reserved:{tr:"Ayrıldı",ru:"Зарезервирован",en:"Reserved"},
  picking:{tr:"Hazırlanıyor",ru:"Собирается",en:"Picking"},
  packed:{tr:"Hazır",ru:"Собран",en:"Packed"},
  in_transit:{tr:"Yolda",ru:"В пути",en:"In transit"},
  delivered:{tr:"Teslim edildi",ru:"Доставлен",en:"Delivered"},
  collected:{tr:"Teslim alındı",ru:"Получен",en:"Collected"},
  cancelled:{tr:"İptal edildi",ru:"Отменён",en:"Cancelled"}
};
async function getJSON<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(path,init);
  if(!response.ok)throw new Error(String(response.status));
  return await response.json() as T;
}
const clubKey=(kind:"saved"|"last")=>"biteos.rozal.club.v1."+(IS_DEMO?"sample":"local")+"."+kind;
function readClub(kind:"saved"|"last"):ClubList{
 try{return parseClubList(localStorage.getItem(clubKey(kind)))}catch{return []}
}
export function RetailApp(){
  const [lang,setLang]=useState<Lang>("tr");
  const t=copy[lang];
  const d=deliveryCopy[lang];
  const [zones,setZones]=useState<Zone[]>(IS_DEMO?demoZones:[]);
  const [zoneID,setZoneID]=useState("center");
  const [slotID,setSlotID]=useState("center-a");
  const zone=zones.find(z=>z.id===zoneID);
  const slot=zone?.slots.find(s=>s.id===slotID);
  const [products,setProducts]=useState<Product[]>(IS_DEMO?seed:[]);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("all");
  const [cart,setCart]=useState<Record<string,number>>({});
  const [savedList,setSavedList]=useState<ClubList>(()=>readClub("saved"));
  const [lastList,setLastList]=useState<ClubList>(()=>readClub("last"));
  const [orderList,setOrderList]=useState<ClubList>([]);
  const [storageError,setStorageError]=useState(false);
  function saveClub(kind:"saved"|"last",list:ClubList){
    if(kind==="saved")setSavedList(list);else setLastList(list);
    try{localStorage.setItem(clubKey(kind),JSON.stringify(list));setStorageError(false)}catch{setStorageError(true)}
  }
  function clearClub(){
    setSavedList([]);setLastList([]);
    try{localStorage.removeItem(clubKey("saved"));localStorage.removeItem(clubKey("last"));setStorageError(false)}catch{setStorageError(true)}
  }
  const [mode,setMode]=useState<"pickup"|"delivery">("pickup");
  const [replacement,setReplacement]=useState("skip");
  const [order,setOrder]=useState<RetailOrder|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(false);
  const [reserved,setReserved]=useState<{id:string;quantity:number}[]>([]);
  const key=useRef("");
  const pending=useRef(false);
  const money=(n:number)=>new Intl.NumberFormat(lang==="tr"?"tr-TR":lang==="ru"?"ru-RU":"en-US",{style:"currency",currency:"TRY"}).format(n/100);
  const refresh=async()=>{if(!IS_DEMO){const [c,delivery]=await Promise.all([getJSON<{products:Product[]}>("/api/retail/catalog"),getJSON<{zones:Zone[]}>("/api/retail/delivery")]);setProducts(c.products);setZones(delivery.zones);}};
  useEffect(()=>{if(!IS_DEMO){void refresh().catch(()=>setError(true));}},[]);
  const items=Object.entries(cart).filter(([,quantity])=>quantity>0).map(([id,quantity])=>({id,quantity}));
  const subtotal=products.reduce((s,p)=>s+p.price*(cart[p.id]||0),0);
  const fee=mode==="delivery"?(zone?.fee??0):0;
  const deliveryInvalid=mode==="delivery"&&(!zone||!slot||slot.remaining<=0||subtotal<zone.minimum);
  function changeSlotCapacity(id:string,delta:number){setZones(prev=>prev.map(z=>({...z,slots:z.slots.map(s=>s.id===id?{...s,remaining:s.remaining+delta}:s)})));}
  function change(p:Product,delta:number){
    if(pending.current)return;
    key.current="";
    setCart(prev=>({...prev,[p.id]:Math.max(0,Math.min(p.stock,20,(prev[p.id]||0)+delta))}));
  }
  async function submit(){
    if(pending.current||order||!items.length||deliveryInvalid)return;
    pending.current=true;setBusy(true);setError(false);
    try{
      if(items.some(i=>i.quantity>(products.find(p=>p.id===i.id)?.stock??0)))throw new Error("stock");
      if(IS_DEMO){
        setReserved(items);
        setOrderList(snapshotCart(cart,products));
        setProducts(prev=>prev.map(p=>({...p,stock:p.stock-(cart[p.id]||0)})));
        if(mode==="delivery")changeSlotCapacity(slotID,-1);
        setOrder({id:"demo-"+crypto.randomUUID().slice(0,8),mode,zoneId:mode==="delivery"?zoneID:undefined,slotId:mode==="delivery"?slotID:undefined,status:"reserved",total:subtotal+fee,events:[{status:"reserved",at:new Date().toISOString()}]});
      }else{
        if(!key.current)key.current=crypto.randomUUID();
        const o=await getJSON<RetailOrder>("/api/retail/orders",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key.current},body:JSON.stringify({items,mode,replacement,zoneId:mode==="delivery"?zoneID:"",slotId:mode==="delivery"?slotID:""})});
        setOrder(o);
        setOrderList(o.lines?.map(l=>({id:l.id,quantity:l.quantity,previousPrice:l.unitPrice}))??[]);
        void refresh().catch(()=>setError(true));
      }
      setCart({});key.current="";
    }catch{setError(true);}finally{pending.current=false;setBusy(false);}
  }
  const next=order?({reserved:"picking",picking:"packed",packed:order.mode==="delivery"?"in_transit":"collected",in_transit:"delivered"} as Record<string,string>)[order.status]:undefined;
  const canCancel=order&&["reserved","picking","packed"].includes(order.status);
  async function advance(status:string){
    if(!order||pending.current)return;
    pending.current=true;setBusy(true);setError(false);
    try{
      if(IS_DEMO){
        if(status==="cancelled"){setProducts(prev=>prev.map(p=>({...p,stock:p.stock+(reserved.find(i=>i.id===p.id)?.quantity||0)})));if(order.slotId)changeSlotCapacity(order.slotId,1);}
        setOrder({...order,status,events:[...order.events,{status,at:new Date().toISOString()}]});
        if((status==="delivered"||status==="collected")&&orderList.length)saveClub("last",orderList);
      } else {
        const updated=await getJSON<RetailOrder>("/api/retail/order?id="+encodeURIComponent(order.id),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
        setOrder(updated);
        if(updated.status==="delivered"||updated.status==="collected"){
          const list=updated.lines?.map(l=>({id:l.id,quantity:l.quantity,previousPrice:l.unitPrice}))??orderList;
          if(list.length)saveClub("last",list);
        }
        void refresh().catch(()=>setError(true));
      }
    }catch{setError(true);}finally{pending.current=false;setBusy(false);}
  }
  return <main className="retail">
    <header><a href="#">← BiteOS</a><strong>ROZAL <small>MARKET</small></strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="tr">TR</option><option value="ru">RU</option><option value="en">EN</option></select></header>
    <section className="retail-hero"><p>GAZİPAŞA · CONCEPT</p><h1>{t.title}</h1><p>{t.demo}</p></section>
    {error&&<p role="alert">{t.error}</p>}
    {order?<section className="retail-cart"><h2>{t.order} · {order.id.slice(-8)}</h2><h3>{money(order.total)}</h3><ol>{order.events.map((ev,i)=><li key={i}>{track[ev.status]?.[lang]||ev.status}</li>)}</ol>{next&&<button disabled={busy} onClick={()=>void advance(next)}>{t.next}</button>}{canCancel&&<button disabled={busy} onClick={()=>void advance("cancelled")}>{t.cancel}</button>}{!next&&!canCancel&&<button onClick={()=>{setOrder(null);setReserved([]);}}>{t.repeat}</button>}</section>:<>
    <RetailClubPanel lang={lang} products={products} cart={cart} saved={savedList} last={lastList} busy={busy} storageError={storageError} onSave={list=>saveClub("saved",list)} onClear={clearClub} onApply={next=>{if(pending.current)return;key.current="";setCart(next)}}/>
    <input className="retail-search" aria-label={t.search} placeholder={t.search} value={query} onChange={e=>setQuery(e.target.value)}/>
    <nav aria-label="Categories">{(["all","fresh","dairy","pantry","international"] as const).map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{t[c]}</button>)}</nav>
    <div className="retail-products">{products.filter(p=>(category==="all"||p.category===category)&&Object.values(p.name).some(n=>n.toLocaleLowerCase(lang).includes(query.toLocaleLowerCase(lang)))).map(p=><article key={p.id}><div className="retail-art" aria-hidden="true">{icons[p.id]}</div><h3>{p.name[lang]}</h3><p>{p.unit} · {t.available}: {p.stock}</p><b>{money(p.price)}</b><div className="retail-qty"><button disabled={busy||!(cart[p.id]>0)} onClick={()=>change(p,-1)} aria-label={"− "+p.name[lang]}>−</button><span>{cart[p.id]||0}</span><button disabled={busy||(cart[p.id]||0)>=Math.min(p.stock,20)} onClick={()=>change(p,1)} aria-label={"+ "+p.name[lang]}>+</button></div></article>)}</div>
    <section className="retail-cart"><h2>{t.cart} · {items.reduce((s,i)=>s+i.quantity,0)}</h2><ul>{items.map(i=><li key={i.id}>{products.find(p=>p.id===i.id)?.name[lang]} × {i.quantity}</li>)}</ul><label>{t.pickup} / {t.delivery}<select value={mode} disabled={busy} onChange={e=>{key.current="";setMode(e.target.value as "pickup"|"delivery");}}><option value="pickup">{t.pickup}</option><option value="delivery">{t.delivery}</option></select></label><label><select aria-label={t.skip} value={replacement} disabled={busy} onChange={e=>{key.current="";setReplacement(e.target.value);}}><option value="skip">{t.skip}</option><option value="contact">{t.contact}</option></select></label>{mode==="delivery"&&<><label>{d.zone}<select disabled={busy} value={zoneID} onChange={e=>{const z=zones.find(z=>z.id===e.target.value);key.current="";setZoneID(e.target.value);setSlotID(z?.slots.find(s=>s.remaining>0)?.id??"");}}>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label><label>{d.slot}<select disabled={busy} value={slotID} onChange={e=>{key.current="";setSlotID(e.target.value);}}><option value="">—</option>{zone?.slots.map(s=><option key={s.id} value={s.id} disabled={s.remaining<=0}>{s.label} · {d.remaining}: {s.remaining}</option>)}</select></label>{zone&&<p>{d.minimum}: {money(zone.minimum)}</p>}{deliveryInvalid&&<p role="status">{d.unavailable}</p>}</>}<p>{t.fee}: {money(fee)}</p><h3>{t.total}: {money(subtotal+(items.length?fee:0))}</h3><button disabled={busy||!items.length||deliveryInvalid} onClick={()=>void submit()}>{t.submit}</button></section></>}
  </main>
}
