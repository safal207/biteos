import {useState} from "react";
import {robysCatalog} from "./robysPublicCatalog";
import {communityPlan} from "./robysCommunity";
import type {CommunityInput,Lang} from "./robysCommunity";
import "./retail.css";
import "./retail-finance.css";
import "./robys-growth.css";
const copy={
 tr:{title:"Roby’s topluluk stüdyosu",draft:"Yalnızca taslak — yayınlanmadı.",first:"İlk lezzet",second:"İkinci lezzet",start:"Başlangıç günü",duration:"Etkinlik günleri",limit:"Ödül sınırı",cost:"Bir ödül maliyeti (TRY)",budget:"Ödül bütçesi (TRY)",total:"Azami ödül maliyeti",over:"Ödül bütçesi aşıldı.",bad:"Geçersiz taslak.",timeline:"İletişim takvimi",metric:"Ölçüm",note:"Onay bekleniyor. Ödül için yorum veya satın alma gerekmez. Bilinmeyen sonuçları, fotoğrafları ve koşulları yayınlama.",download:"Taslak JSON indir"},
 ru:{title:"Roby’s студия сообщества",draft:"Только черновик — ничего не опубликовано.",first:"Первый вкус",second:"Второй вкус",start:"Дата начала",duration:"Дней акции",limit:"Лимит наград",cost:"Себестоимость награды (TRY)",budget:"Бюджет наград (TRY)",total:"Максимальные затраты на награды",over:"Бюджет наград превышен.",bad:"Некорректный черновик.",timeline:"Календарь коммуникаций",metric:"Метрика",note:"Необходимо согласование. Награда не зависит от отзыва или покупки. Не публиковать непроверенные результаты, фото без разрешения и несогласованные условия.",download:"Скачать черновик JSON"},
 en:{title:"Roby’s community studio",draft:"Draft only — nothing published.",first:"First flavor",second:"Second flavor",start:"Start day",duration:"Event days",limit:"Reward limit",cost:"Unit reward cost (TRY)",budget:"Reward budget (TRY)",total:"Maximum reward cost",over:"Reward budget exceeded.",bad:"Invalid draft.",timeline:"Community calendar",metric:"Measure",note:"Approval required. No review or purchase is required for a reward. Do not publish unverified results, unapproved photos or terms.",download:"Download draft JSON"}
};
const products=robysCatalog.products.filter(p=>p.categoryId!=="pairing-offers"&&p.variants.length===0);
export function RobysCommunityStudio(){
 const [lang,setLang]=useState<Lang>("tr"),[input,setInput]=useState<CommunityInput>({firstId:"hot-coffee:caramel-latte",secondId:"hot-coffee:hazelnut-latte",startDay:new Date(Date.now()+8*86400000+10800000).toISOString().slice(0,10),duration:7,rewardLimit:10,unitCostMinor:6000,budgetMinor:100000});
 const t=copy[lang],money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 function change<K extends keyof CommunityInput>(k:K,v:CommunityInput[K]){setInput(x=>({...x,[k]:v}))}
 let plan:ReturnType<typeof communityPlan>|null=null;try{plan=communityPlan(input,products,lang)}catch{}
 function download(){if(!plan||!plan.withinBudget)return;const url=URL.createObjectURL(new Blob([JSON.stringify(plan,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="robys-community-draft.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <main className="retail finance robys-growth robys-campaign" lang={lang}><header><a href="#workspace">← BiteOS</a><strong>ROBY’S</strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}>{["tr","ru","en"].map(l=><option key={l}>{l}</option>)}</select></header>
 <section className="retail-hero"><h1>{t.title}</h1><p>{t.draft}</p></section>
 <section className="retail-cart"><div className="campaign-fields">
 <label>{t.first}<select value={input.firstId} onChange={e=>change("firstId",e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name[lang]}</option>)}</select></label>
 <label>{t.second}<select value={input.secondId} onChange={e=>change("secondId",e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name[lang]}</option>)}</select></label>
 <label>{t.start}<input type="date" value={input.startDay} onChange={e=>change("startDay",e.target.value)}/></label>
 <label>{t.duration}<input type="number" min={3} max={14} value={Number.isNaN(input.duration)?"":input.duration} onChange={e=>change("duration",e.target.valueAsNumber)}/></label>
 <label>{t.limit}<input type="number" min={1} max={200} value={Number.isNaN(input.rewardLimit)?"":input.rewardLimit} onChange={e=>change("rewardLimit",e.target.valueAsNumber)}/></label>
 <label>{t.cost}<input type="number" min={0.01} step={0.01} value={Number.isNaN(input.unitCostMinor)?"":input.unitCostMinor/100} onChange={e=>change("unitCostMinor",Math.round(e.target.valueAsNumber*100))}/></label>
 <label>{t.budget}<input type="number" min={0} step={1} value={Number.isNaN(input.budgetMinor)?"":input.budgetMinor/100} onChange={e=>change("budgetMinor",Math.round(e.target.valueAsNumber*100))}/></label>
 </div>{plan?<><p>{t.total}: <strong>{money(plan.rewardCostMinor)}</strong></p>{!plan.withinBudget&&<p role="alert">{t.over}</p>}<button disabled={!plan.withinBudget} onClick={download}>{t.download}</button></>:<p role="alert">{t.bad}</p>}<p>{t.note}</p></section>
 {plan&&<section className="retail-cart"><h2>{t.timeline}</h2><div className="growth-list">{plan.stages.map((s,i)=><article data-community-stage={s.id} key={s.id}><strong>{i+1}. {s.title} · {s.day}</strong><p>{s.draft}</p><p>{t.metric}: {s.measure}</p></article>)}</div></section>}</main>
}
