import {useRef,useState} from "react";
import {IS_DEMO} from "./types";
import "./retail.css";
import "./retail-finance.css";
import "./retail-business.css";

type Lang="tr"|"ru"|"en";
type Role="owner"|"admin"|"seller"|"warehouse"|"courier";
type Metric={key:string;value:number;unit:string};
type QueueRow={id:string;status:string;mode:string;zone?:string;slot?:string;units:number;held:boolean;items?:{id:string;quantity:number}[]};
type Decision={id:string;priority:number;rule:string;subject:string;name?:Record<Lang,string>};
type Report={demo:boolean;role:Role;asOf:string;mode:string;externalEffectsAuthorized:boolean;metrics:Metric[];queue:QueueRow[];decisions?:Decision[]};
const roles:Role[]=["owner","admin","seller","warehouse","courier"];
const names:Record<Role,Record<Lang,string>>={owner:{tr:"İşletme sahibi",ru:"Владелец",en:"Owner"},admin:{tr:"Yönetici",ru:"Администратор",en:"Administrator"},seller:{tr:"Satış görevlisi",ru:"Продавец",en:"Seller"},warehouse:{tr:"Depo görevlisi",ru:"Кладовщик",en:"Warehouse"},courier:{tr:"Kurye",ru:"Курьер",en:"Courier"}};
const copy={
 tr:{title:"İşletme çalışma alanı",note:"Rol görünümü · yalnızca okuma",demo:"Sabit rol örnekleri; gerçek mağaza verisi değil.",local:"Yerel demo. Her görünüm ayrı anahtar ister.",key:"Rol anahtarı",load:"Görünümü aç / yenile",lock:"Kapat",failed:"Erişim veya rapor doğrulanamadı.",queue:"İş kuyruğu",units:"Adet",hold:"Güvenlik kontrolü",empty:"Kuyruk boş",decisions:"İnceleme sinyalleri",links:"Demo araçları",finance:"Finans",brain:"Karar merkezi",demand:"Talep",life:"Partiler",twin:"Dijital ikiz",growth:"Kampanya",spatial:"Rota",shop:"Vitrin",limit:"Rol anahtarı bireysel kimlik değildir. Diğer demo uçları korunmaz. Gerçek işlemler veya sevkiyat yetkisi yok."},
 ru:{title:"Рабочее пространство",note:"Рабочая роль · только чтение",demo:"Фиксированные примеры ролей, не данные магазина.",local:"Локальное демо. Для каждой роли нужен отдельный ключ.",key:"Ключ роли",load:"Открыть / обновить",lock:"Закрыть",failed:"Доступ или отчёт не подтверждён.",queue:"Очередь задач",units:"Единиц",hold:"Проверка безопасности",empty:"Очередь пуста",decisions:"Сигналы для проверки",links:"Демо-инструменты",finance:"Финансы",brain:"Центр решений",demand:"Спрос",life:"Партии",twin:"Цифровой двойник",growth:"Акции",spatial:"Маршруты",shop:"Витрина",limit:"Ключ роли не является персональной идентификацией. Другие демо-API не защищены. Прав на реальные операции или доставку нет."},
 en:{title:"Business workspace",note:"Role workspace · read-only",demo:"Fixed role examples, not real store data.",local:"Local demo. Each view needs a separate key.",key:"Role key",load:"Open / refresh",lock:"Close",failed:"Access or report not confirmed.",queue:"Work queue",units:"Units",hold:"Safety review",empty:"Queue empty",decisions:"Review signals",links:"Demo tools",finance:"Finance",brain:"Decision center",demand:"Demand",life:"Lots",twin:"Digital twin",growth:"Promotions",spatial:"Routes",shop:"Storefront",limit:"Role key is not individual identity. Other demo APIs are not protected. No real transaction or dispatch authority."}
};
const metrics:Record<string,Record<Lang,string>>={queue:{tr:"Kuyruk",ru:"В очереди",en:"Queue"},held:{tr:"Bekletilen",ru:"На проверке",en:"Held"},fulfilled:{tr:"Tamamlanan",ru:"Выполнено",en:"Fulfilled"},cancelled:{tr:"İptal",ru:"Отменено",en:"Cancelled"},revenue:{tr:"Örnek satış",ru:"Пример выручки",en:"Sample revenue"},contribution:{tr:"Örnek katkı",ru:"Условный вклад",en:"Sample contribution"}};
const statuses:Record<string,Record<Lang,string>>={reserved:{tr:"Ayrıldı",ru:"Зарезервирован",en:"Reserved"},picking:{tr:"Hazırlanıyor",ru:"Комплектуется",en:"Picking"},packed:{tr:"Hazır",ru:"Собран",en:"Packed"},in_transit:{tr:"Yolda",ru:"В пути",en:"In transit"}};
const modes:Record<string,Record<Lang,string>>={pickup:{tr:"Mağazadan al",ru:"Самовывоз",en:"Pickup"},delivery:{tr:"Teslimat",ru:"Доставка",en:"Delivery"}};
function sample(role:Role):Report{
 const all:QueueRow[]=[{id:"demo-001",status:"reserved",mode:"pickup",units:2,held:false,items:[{id:"milk",quantity:2}]},{id:"demo-002",status:"packed",mode:"pickup",units:3,held:false,items:[{id:"bread",quantity:3}]},{id:"demo-003",status:"packed",mode:"delivery",units:4,held:true,zone:"center",slot:"center-a",items:[{id:"eggs",quantity:4}]}];
 const queue=all.filter(o=>role==="owner"||role==="admin"||role==="seller"&&o.mode==="pickup"&&o.status==="packed"||role==="warehouse"&&o.status==="reserved"||role==="courier"&&o.mode==="delivery").map(o=>{const {items,...rest}=o;return role==="seller"||role==="warehouse"?{...rest,zone:undefined,slot:undefined,items}:rest}).sort((a,b)=>Number(b.held)-Number(a.held)||a.id.localeCompare(b.id));
 const result:Report={demo:true,role,asOf:"2026-11-14",mode:"read-only",externalEffectsAuthorized:false,metrics:[{key:"queue",value:queue.length,unit:"count"},{key:"held",value:queue.filter(o=>o.held).length,unit:"count"}],queue};
 if(role==="owner")result.metrics.push({key:"fulfilled",value:4,unit:"count"},{key:"revenue",value:18800,unit:"TRY-minor"},{key:"contribution",value:6000,unit:"TRY-minor"});
 if(role==="admin")result.metrics.push({key:"fulfilled",value:4,unit:"count"},{key:"cancelled",value:1,unit:"count"});
 if(role==="owner"||role==="admin")result.decisions=[{id:"hold-demo",priority:0,rule:"HOLD_OPEN_ORDER",subject:"demo-003"}];
 return result;
}
export function RetailBusiness(){
 const [lang,setLang]=useState<Lang>("tr"),[role,setRole]=useState<Role>("owner"),[key,setKey]=useState(""),[report,setReport]=useState<Report|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const sequence=useRef(0);
 const t=copy[lang],view=IS_DEMO?sample(role):report;
 const money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 function close(){sequence.current++;setKey("");setReport(null);setBusy(false);setError(false)}
 async function load(){
  if(IS_DEMO||key.length<32||busy)return;const request=++sequence.current;setBusy(true);setError(false);setReport(null);
  try{const r=await fetch("/api/retail/business?role="+role,{headers:{Authorization:"Bearer "+key},cache:"no-store"});if(!r.ok)throw Error();const d=await r.json() as Report;if(d.role!==role||d.mode!=="read-only"||d.externalEffectsAuthorized!==false)throw Error();if(request===sequence.current)setReport(d)}catch{if(request===sequence.current)setError(true)}finally{if(request===sequence.current)setBusy(false)}
 }
 return <main className="retail finance business"><header><a href="#retail-finance">← Finance</a><strong>BiteOS <small>BUSINESS</small></strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}><option value="tr">TR</option><option value="ru">RU</option><option value="en">EN</option></select></header><section className="retail-hero"><p>ROZAL · BUSINESS OS</p><h1>{t.title}</h1><p>{t.note}</p></section><p>{IS_DEMO?t.demo:t.local}</p>
 <div className="business-roles">{roles.map(r=><button key={r} aria-pressed={role===r} onClick={()=>{close();setRole(r)}}>{names[r][lang]}</button>)}</div>
 {!IS_DEMO&&<section className="retail-cart"><label>{t.key}<input type="password" autoComplete="off" value={key} disabled={busy} onChange={e=>{setReport(null);setError(false);setKey(e.target.value)}}/></label><button disabled={busy||key.length<32} onClick={()=>void load()}>{t.load}</button> <button onClick={close}>{t.lock}</button></section>}
 {error&&<p role="alert">{t.failed}</p>}
 {view&&<><p>{view.asOf} · TRT · {names[view.role][lang]}</p><div className="finance-kpis">{view.metrics.map(m=><article key={m.key}><p>{metrics[m.key]?.[lang]??m.key}</p><strong>{m.unit==="TRY-minor"?money(m.value):m.value}</strong></article>)}</div><section className="retail-cart"><h2>{t.queue}</h2>{!view.queue.length&&<p>{t.empty}</p>}{view.queue.map(o=><article className="business-order" key={o.id}><b>{o.id}</b><p>{statuses[o.status]?.[lang]??o.status} · {modes[o.mode]?.[lang]??o.mode} · {t.units}: {o.units}</p>{o.held&&<b className="finance-negative">{t.hold}</b>}{o.zone&&<p>{o.zone} · {o.slot}</p>}{o.items&&<ul>{o.items.map(i=><li key={i.id}>{i.id} × {i.quantity}</li>)}</ul>}</article>)}</section>{!!view.decisions?.length&&<section className="retail-cart"><h2>{t.decisions}</h2>{view.decisions.map(d=><p key={d.id}>P{d.priority} · {d.rule} · {d.name?.[lang]??d.subject}</p>)}</section>}</>}
 {role==="owner"&&<section className="retail-cart"><h2>{t.links}</h2><div className="business-links">{Object.entries({finance:"finance",brain:"brain",demand:"demand-business",life:"lifetime",twin:"twin",growth:"growth",spatial:"spatial"}).map(([label,route])=><a key={route} href={"#retail-"+route}>{t[label as keyof typeof t]}</a>)}</div></section>}
 {role==="owner"&&<p><a href="#retail-brand">{lang==="tr"?"Marka stüdyosu":lang==="ru"?"Студия бренда":"Brand studio"}</a></p>}
 <p className="finance-note">{t.limit}</p></main>
}
