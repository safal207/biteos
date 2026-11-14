import {useState} from "react";
import {robysCatalog} from "./robysPublicCatalog";
import {moods,moodInfo,readMood,sharedLook,experience,addDiscovery} from "./robysAdaptive";
import type {Mood,Lang,Discovery} from "./robysAdaptive";
import {projectContext} from "./robysContext";
import "./retail.css";
import "./retail-finance.css";
import "./robys-growth.css";
import "./robys-adaptive.css";
const catalog=robysCatalog.products,index=new Map(catalog.map(p=>[p.id,p]));
const menu="https://safal207.github.io/robys-coffee-house-demo/menu-feed.html";
const words={
 tr:{draft:"Etkileşimli örnek · sipariş, puan veya ödül oluşturmaz.",mood:"Bugün nasıl bir mola?",context:"Hava senaryosu",offer:"Birlikte iyi gider",add:"Yanına eklemeyi önizle",remove:"Ek ürünü kaldır",base:"Menü fiyatı",total:"Örnek toplam",all:"Tüm menüyü aç",progress:"Lezzet keşifleri",discover:"Keşfi önizle",share:"Bu görünümü paylaş",copy:"Bağlantıyı kopyala",noOffer:"Öneri yok; normal menü her zaman erişilebilir.",story:"Her mola küçük bir hikâye.",hint:"Görünüm bağlantısı yalnızca tema kodu taşır. Geçmiş, bütçe, ilerleme veya kimlik paylaşılmaz.",names:["Hikâye","Menü","Lezzet"]},
 ru:{draft:"Интерактивный пример · не создаёт заказов, баллов или наград.",mood:"Какой отдых сегодня?",context:"Сценарий погоды",offer:"Хорошо сочетается",add:"Посмотреть с дополнением",remove:"Убрать дополнение",base:"Цена меню",total:"Пример суммы",all:"Открыть всё меню",progress:"Открытия вкусов",discover:"Отметить пробное открытие",share:"Поделиться оформлением",copy:"Копировать ссылку",noOffer:"Нет предложения; обычное меню всегда доступно.",story:"Каждая пауза — маленькая история.",hint:"Ссылка передаёт только тему. История, бюджет, прогресс и личность не передаются.",names:["История","Меню","Вкус"]},
 en:{draft:"Interactive example · no orders, points or rewards created.",mood:"What kind of break today?",context:"Weather scenario",offer:"Pairs well with",add:"Preview with add-on",remove:"Remove add-on",base:"Menu price",total:"Example total",all:"Open full menu",progress:"Taste discoveries",discover:"Preview discovery",share:"Share this look",copy:"Copy link",noOffer:"No offer; the standard menu remains accessible.",story:"Every break is a little story.",hint:"Only the look code is shared. No history, budget, progress or identity.",names:["Story","Menu","Taste"]}
};
export function RobysAdaptiveExperience(){
 const [lang,setLang]=useState<Lang>("tr"),[mood,setMood]=useState<Mood>(()=>readMood(new URL(location.href).searchParams.get("robysMood"))),[weather,setWeather]=useState<"unknown"|"rain"|"hot"|"storm">("unknown"),[addon,setAddon]=useState(false),[progress,setProgress]=useState<Discovery[]>([]);
 const t=words[lang],i=["tr","ru","en"].indexOf(lang),money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 // The existing context engine is the safety/availability boundary for this simulation.
 const context=projectContext({day:"2026-11-14",hour:15,weather,intent:"any",budgetMinor:null,favoriteIds:[],unavailableIds:[]},catalog);
 const suggested=mood==="standard"?"standard":weather==="rain"&&mood==="fresh"?"cozy":weather==="hot"&&mood==="cozy"?"fresh":mood;
 const model=experience(suggested,catalog,null,[],context.blocked);
 const primary=model.primary,extra=model.extra,share=sharedLook(location.href,model.theme);
 const pic=(id:string)=>({"brew-hot:hot-chocolate":"brew-hot--hot-chocolate","brew-hot:black-tea":"brew-hot--black-tea","pairing-offers:iced-san-sebastian-pairing":"pairing-offers--iced-san-sebastian-pairing","brew-hot:milk":"brew-hot--milk","refreshers:cool-lime":"refreshers--cool-lime"} as Record<string,string>)[id];
 const existingPic=(id:string)=>id==="refreshers:cool-lime"||id==="brew-hot:coffee" ?pic(id):null;
 return <main className="retail finance robys-growth robys-experience" lang={lang}><header><a href="#workspace">← BiteOS</a><strong>ROBY’S</strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}>{["tr","ru","en"].map(l=><option key={l}>{l}</option>)}</select></header>
 <h1>My Roby’s</h1><p>{t.draft}</p><section className="retail-cart"><h2>{t.mood}</h2><div className="adaptive-moods">{moods.map(m=><button key={m} aria-pressed={mood===m} onClick={()=>{setMood(m);setAddon(false)}}>{moodInfo[m].names[i]}</button>)}</div><label>{t.context}<select value={weather} onChange={e=>{setWeather(e.target.value as typeof weather);setAddon(false)}}>{["unknown","rain","hot","storm"].map((w,j)=><option key={w} value={w}>{[["Bilinmiyor","Yağmur","Sıcak","Fırtına"],["Неизвестно","Дождь","Жара","Шторм"],["Unknown","Rain","Hot","Storm"]][i][j]}</option>)}</select></label></section>
 <section className="adaptive-screen" data-robys-mood={model.theme}><div className="adaptive-hero"><small>ROBY’S • MY MOMENT</small><h2>{moodInfo[model.theme].titles[i]}</h2><p>{t.story}</p><div className="adaptive-orbit" aria-hidden="true">R.</div></div>
 {primary?<section className="adaptive-offer">{existingPic(primary.id)&&<img alt="" src={import.meta.env.BASE_URL+"images/robys/menu-v1/"+existingPic(primary.id)+".webp"}/>}<h3>{index.get(primary.id)?.name[lang]}</h3><p>{t.base}: <b>{money(primary.priceMinor)}</b></p>{extra&&<div className="adaptive-extra"><strong>{t.offer}: {index.get(extra.id)?.name[lang]} · {money(extra.priceMinor)}</strong><button aria-pressed={addon} onClick={()=>setAddon(x=>!x)}>{addon?t.remove:t.add}</button></div>}<p>{t.total}: <b>{money(primary.priceMinor+(addon&&extra?extra.priceMinor:0))}</b></p></section>:<p>{t.noOffer}</p>}
 <a className="adaptive-full-menu" href={menu+"?lang="+lang}>{t.all}</a>
 {model.theme!=="standard"&&<section className="adaptive-progress"><h3>{t.progress}</h3><strong>{progress.length} / 3</strong><div className="growth-track"><i style={{width:progress.length/3*100+"%"}}/></div><div className="adaptive-discoveries">{t.names.map((n,j)=><span key={n}>{progress.includes((["story","menu","taste"] as const)[j])?"✓ ":""}{n}</span>)}</div><button disabled={progress.length===3} onClick={()=>{const next=(["story","menu","taste"] as const).find(x=>!progress.includes(x));if(next)setProgress(old=>addDiscovery(old,next))}}>{t.discover}</button></section>}</section>
 <section className="retail-cart"><label>{t.share}<textarea readOnly rows={3} value={share}/></label><button onClick={()=>{void navigator.clipboard?.writeText(share).catch(()=>{})}}>{t.copy}</button><p>{t.hint}</p></section></main>
}
