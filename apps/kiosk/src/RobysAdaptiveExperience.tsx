import {useState} from "react";
import {robysCatalog} from "./robysPublicCatalog";
import {moods,moodInfo,readMood,sharedLook,experience,addDiscovery,chooseSeason,storyCard,seasonalLooks} from "./robysAdaptive";
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
 const [lang,setLang]=useState<Lang>("tr"),[mood,setMood]=useState<Mood>(()=>readMood(new URL(location.href).searchParams.get("robysMood"))),[weather,setWeather]=useState<"unknown"|"rain"|"hot"|"storm">("unknown"),[addon,setAddon]=useState(false),[progress,setProgress]=useState<Discovery[]>([]),[day,setDay]=useState("2026-11-14"),[hour,setHour]=useState(15),[seasonal,setSeasonal]=useState(false),[saved,setSaved]=useState(false);
 const t=words[lang],i=["tr","ru","en"].indexOf(lang),money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 // The existing context engine is the safety/availability boundary for this simulation.

 let context:ReturnType<typeof projectContext>|null=null;
 try{context=projectContext({day,hour,weather,intent:mood==="study"||mood==="family"||mood==="friends"?mood:"any",budgetMinor:null,favoriteIds:[],unavailableIds:[],optionalThemes:seasonal},catalog)}catch{}
 // A guest's explicit look remains theirs. Context does not silently replace it.
 const model=experience(mood,catalog,null,[],!context||context.blocked);
 const season=chooseSeason(model.theme,context?.calendar.occasions??[],seasonal,!context||context.blocked);
 const card=storyCard(model.theme,lang,season);
 const primary=model.primary,extra=model.extra,share=sharedLook(location.href,model.theme);
 const existingPic=(id:string)=>id==="refreshers:cool-lime"?"refreshers--cool-lime":null;
 const photo=(id:string)=>existingPic(id)?import.meta.env.BASE_URL+"images/robys/menu-v1/"+existingPic(id)+".webp":null;
 function downloadStory(){
  const c=document.createElement("canvas");c.width=1080;c.height=1920;const ctx=c.getContext("2d");if(!ctx)return;
  const [background,foreground,accent]=card.colors;ctx.fillStyle=background;ctx.fillRect(0,0,1080,1920);
  ctx.strokeStyle=accent;ctx.lineWidth=4;ctx.strokeRect(60,60,960,1800);
  ctx.globalAlpha=.28;ctx.strokeStyle=accent;ctx.lineWidth=7;for(const radius of [230,300,370]){ctx.beginPath();ctx.arc(540,850,radius,0,Math.PI*2);ctx.stroke()}
  ctx.globalAlpha=1;ctx.textAlign="center";ctx.fillStyle=foreground;ctx.font="46px system-ui";ctx.fillText(card.brand,540,240,900);
  ctx.font="bold 260px Georgia";ctx.fillText("R.",540,930,850);
  ctx.font="bold 62px system-ui";ctx.fillText(card.title,540,1360,920);ctx.font="44px system-ui";ctx.fillText(card.subtitle,540,1440,900);
  ctx.font="27px system-ui";ctx.fillText(card.footer,540,1710,920);
  c.toBlob(blob=>{if(!blob)return;const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download="my-robys-"+model.theme+".png";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);setSaved(true)},"image/png");
 }

 return <main className="retail finance robys-growth robys-experience" lang={lang}><header><a href="#workspace">← BiteOS</a><strong>ROBY’S</strong><select aria-label="Language" value={lang} onChange={e=>{setLang(e.target.value as Lang);setSaved(false)}}>{["tr","ru","en"].map(l=><option key={l}>{l}</option>)}</select></header>
 <h1>My Roby’s</h1><p>{t.draft}</p><section className="retail-cart"><h2>{t.mood}</h2><div className="adaptive-moods">{moods.map(m=><button key={m} aria-pressed={mood===m} onClick={()=>{setMood(m);setAddon(false);setSaved(false)}}>{moodInfo[m].names[i]}</button>)}</div><label>{t.context}<select value={weather} onChange={e=>{setWeather(e.target.value as typeof weather);setAddon(false);setSaved(false)}}>{["unknown","rain","hot","storm"].map((w,j)=><option key={w} value={w}>{[["Bilinmiyor","Yağmur","Sıcak","Fırtına"],["Неизвестно","Дождь","Жара","Шторм"],["Unknown","Rain","Hot","Storm"]][i][j]}</option>)}</select></label><div className="adaptive-context-fields"><label>{["Tarih","Дата","Scenario date"][i]}<input type="date" value={day} onChange={e=>{setDay(e.target.value);setAddon(false);setSaved(false)}}/></label><label>{["Saat","Час","Scenario hour"][i]}<input type="number" min={0} max={23} value={Number.isNaN(hour)?"":hour} onChange={e=>{setHour(e.target.valueAsNumber);setAddon(false);setSaved(false)}}/></label></div><label><input type="checkbox" checked={seasonal} onChange={e=>{setSeasonal(e.target.checked);setSaved(false)}}/>{["İsteğe bağlı bayram temaları","Необязательные праздничные темы","Optional holiday themes"][i]}</label></section>
 <section className="adaptive-screen" data-robys-mood={model.theme} data-robys-season={season??"none"}><div className="adaptive-hero"><small>ROBY’S • MY MOMENT</small><h2>{moodInfo[model.theme].titles[i]}</h2><p>{t.story}</p>{season&&<p className="adaptive-season-label">{seasonalLooks[season].names[i]}</p>}<div className="adaptive-orbit" aria-hidden="true">R.</div></div>
 {primary?<section className="adaptive-offer">{photo(primary.id)&&<img alt="" src={photo(primary.id)??undefined}/>}<h3>{index.get(primary.id)?.name[lang]}</h3><p>{t.base}: <b>{money(primary.priceMinor)}</b></p>{extra&&<div className="adaptive-extra"><strong>{t.offer}: {index.get(extra.id)?.name[lang]} · {money(extra.priceMinor)}</strong><button aria-pressed={addon} onClick={()=>setAddon(x=>!x)}>{addon?t.remove:t.add}</button></div>}<p>{t.total}: <b>{money(primary.priceMinor+(addon&&extra?extra.priceMinor:0))}</b></p></section>:<p>{t.noOffer}</p>}
 <a className="adaptive-full-menu" href={menu+"?lang="+lang}>{t.all}</a>
 {model.theme!=="standard"&&<section className="adaptive-progress"><h3>{t.progress}</h3><strong>{progress.length} / 3</strong><div className="growth-track"><i style={{width:progress.length/3*100+"%"}}/></div><div className="adaptive-discoveries">{t.names.map((n,j)=><span key={n}>{progress.includes((["story","menu","taste"] as const)[j])?"✓ ":""}{n}</span>)}</div><button disabled={progress.length===3} onClick={()=>{const next=(["story","menu","taste"] as const).find(x=>!progress.includes(x));if(next)setProgress(old=>addDiscovery(old,next))}}>{t.discover}</button></section>}</section>
 <section className="retail-cart"><label>{t.share}<textarea readOnly rows={3} value={share}/></label><button onClick={()=>{void navigator.clipboard?.writeText(share).catch(()=>{})}}>{t.copy}</button><p>{t.hint}</p><div className="adaptive-story-card" style={{background:card.colors[0],color:card.colors[1],borderColor:card.colors[2]}}><small>{card.brand}</small><span aria-hidden="true">R.</span><strong>{card.title}</strong><p>{card.subtitle}</p></div><button onClick={downloadStory}>{["Hikâye PNG indir","Скачать историю PNG","Download story PNG"][i]}</button>{saved&&<p role="status">{["PNG hazır","PNG создан","PNG created"][i]}</p>}</section></main>
}
