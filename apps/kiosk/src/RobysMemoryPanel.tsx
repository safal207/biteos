import {useEffect,useState} from "react";
import {robysCatalog} from "./robysPublicCatalog";
import {layoutNames} from "./robysSocialLook";
import type {Layout} from "./robysSocialLook";
import type {Lang} from "./robysAdaptive";
import {memoryKey,freshMemory,readMemory,addMemory,suggestMemory} from "./robysMemory";
import type {Memory,Topic,Event} from "./robysMemory";
const products=robysCatalog.products,ids=products.map(p=>p.id),index=new Map(products.map(p=>[p.id,p]));
const copy={
 tr:{title:"Roby’s hafızam",note:"İsteğe bağlı cihaz hafızası. Yalnızca açık tercih ve kararlar; 30 gün, en fazla 32 kayıt. Sunucuya gönderilmez.",enable:"Yerel hafızayı etkinleştir",erase:"Hafızayı sil ve kapat",off:"Hafıza kapalı.",like:"Bu düzeni hatırla",avoid:"Bu düzeni önerme",product:"Ürün tercihi",favorite:"Ürünü hatırla",not:"Bu ürünü önerme",suggest:"Hafızadan öneri",basis:"Son açık tercihin",apply:"Hafıza önerisini uygula",dismiss:"Öneriyi reddet",history:"Karar geçmişi",none:"Henüz öneri yok.",failed:"Hafıza kullanılamıyor; değişiklik kaydedilmedi.",actions:["Tercih","Önerme","Uygulandı","Reddedildi"],saved:"Hatırlanan ürün (satış önerisi değil)",clear:"Hafıza silindi."},
 ru:{title:"Моя память Roby’s",note:"Добровольная память устройства. Только явные предпочтения и решения; 30 дней, максимум 32 записи. Без отправки на сервер.",enable:"Включить локальную память",erase:"Очистить и отключить память",off:"Память отключена.",like:"Запомнить этот формат",avoid:"Не предлагать этот формат",product:"Предпочтение по блюду",favorite:"Запомнить блюдо",not:"Не предлагать это блюдо",suggest:"Рекомендация из памяти",basis:"Последнее явное предпочтение",apply:"Применить рекомендацию памяти",dismiss:"Отклонить рекомендацию",history:"История решений",none:"Пока нет рекомендаций.",failed:"Память недоступна; изменение не сохранено.",actions:["Предпочтение","Не предлагать","Применено","Отклонено"],saved:"Запомненное блюдо (не предложение покупки)",clear:"Память очищена."},
 en:{title:"My Roby’s memory",note:"Optional device memory. Explicit preferences and decisions only; 30 days, up to 32 records. No server transmission.",enable:"Enable local memory",erase:"Clear and disable memory",off:"Memory is off.",like:"Remember this layout",avoid:"Do not suggest this layout",product:"Product preference",favorite:"Remember product",not:"Do not suggest this product",suggest:"Memory suggestion",basis:"Latest explicit preference",apply:"Apply memory suggestion",dismiss:"Dismiss suggestion",history:"Decision history",none:"No suggestion yet.",failed:"Memory unavailable; change was not saved.",actions:["Preferred","Avoid","Applied","Dismissed"],saved:"Remembered product (not a sales offer)",clear:"Memory cleared."}
};
function read():Memory|null{try{return readMemory(localStorage.getItem(memoryKey),Date.now(),ids)}catch{return null}}
export function RobysMemoryPanel({lang,layout,onLayout,onMemory}:{lang:Lang;layout:Layout;onLayout:(l:Layout)=>void;onMemory:(m:Memory|null)=>void}){
 const [memory,setMemory]=useState<Memory|null>(read),[product,setProduct]=useState(ids[0]),[status,setStatus]=useState<"failed"|"clear"|null>(null);
 const t=copy[lang],i=["tr","ru","en"].indexOf(lang);
 useEffect(()=>{onMemory(memory)},[memory,onMemory]);
 useEffect(()=>{if(!memory)return;const timer=window.setTimeout(()=>setMemory(read()),Math.max(1,Math.min(2147483647,memory.expiresAt-Date.now()+1)));return()=>window.clearTimeout(timer)},[memory]);
 useEffect(()=>{function sync(e:StorageEvent){if(e.key===memoryKey||e.key===null)setMemory(read())}window.addEventListener("storage",sync);return()=>window.removeEventListener("storage",sync)},[]);
 function enable(){try{const current=read()??freshMemory(Date.now());localStorage.setItem(memoryKey,JSON.stringify(current));setMemory(current);setStatus(null)}catch{setStatus("failed")}}
 function erase(){try{localStorage.removeItem(memoryKey);setMemory(null);setStatus("clear")}catch{setStatus("failed")}}
 function record(topic:Topic,value:string,action:Event["action"],basis:number|null=null){try{
  const current=read();if(!current){setMemory(null);throw Error("Memory not enabled")}
  const next=addMemory(current,Date.now(),ids,topic,value,action,basis);localStorage.setItem(memoryKey,JSON.stringify(next));setMemory(next);setStatus(null);return true
 }catch{setStatus("failed");return false}}
 const suggested=memory?suggestMemory(memory,"layout"):null,remembered=memory?suggestMemory(memory,"product"):null;
 const name=(topic:Topic,value:string)=>topic==="layout"?layoutNames[value as Layout]?.[i]??value:index.get(value)?.name[lang]??value;
 const applied=suggested&&memory?.events.some(e=>e.basis===suggested.basis&&e.action==="apply");
 return <section className="retail-cart adaptive-memory"><h2>{t.title}</h2><p>{t.note}</p>
 {!memory?<><p>{t.off}</p><button onClick={enable}>{t.enable}</button></>:<>
 <button onClick={erase}>{t.erase}</button><div className="appearance-actions"><button onClick={()=>record("layout",layout,"prefer")}>{t.like}</button><button onClick={()=>record("layout",layout,"avoid")}>{t.avoid}</button></div>
 <label>{t.product}<select value={product} onChange={e=>setProduct(e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name[lang]}</option>)}</select></label><div className="appearance-actions"><button onClick={()=>record("product",product,"prefer")}>{t.favorite}</button><button onClick={()=>record("product",product,"avoid")}>{t.not}</button></div>
 <h3>{t.suggest}</h3>{suggested?<div data-memory-suggestion={suggested.value}><p>{name("layout",suggested.value)} · {t.basis} #{suggested.basis}</p><div className="appearance-actions">{!applied&&<button onClick={()=>{if(record("layout",suggested.value,"apply",suggested.basis))onLayout(suggested.value as Layout)}}>{t.apply}</button>}<button onClick={()=>record("layout",suggested.value,"dismiss",suggested.basis)}>{t.dismiss}</button></div></div>:<p>{t.none}</p>}
 {remembered&&<p data-memory-product={remembered.value}>{t.saved}: {name("product",remembered.value)} · #{remembered.basis}</p>}
 <h3>{t.history}</h3><div className="growth-list">{[...memory.events].reverse().map(e=><article key={e.seq} data-memory-event={e.seq}><strong>#{e.seq} · {t.actions[["prefer","avoid","apply","dismiss"].indexOf(e.action)]} · {name(e.topic,e.value)}</strong><p>{new Date(e.at).toISOString().slice(0,10)}{e.basis!==null?" · #"+e.basis:""}</p></article>)}</div></>}
 {status&&<p role={status==="failed"?"alert":"status"}>{t[status]}</p>}</section>
}
