import {useState} from "react";
import presets from "../../../services/api/brand-presets.json";
import "./retail.css";
import "./retail-brand.css";

type Lang="tr"|"ru"|"en";
type Profile={version:number;tenantId:string;name:string;kind:string;accent:string;surface:string;ink:string;headline:Record<Lang,string>};
const languages:Lang[]=["tr","ru","en"];
const copy={
 tr:{title:"Marka stüdyosu",note:"Yerel tasarım önizlemesi. Resmî marka onayı veya yayın yok.",preset:"Örnek profil",name:"Marka adı",headline:"Başlık",accent:"Vurgu",surface:"Arka plan",ink:"Metin",preview:"Önizleme",menu:"Menüyü keşfet",products:"Örnek kategoriler",grocery:["Meyve ve sebze","Kahvaltı","Temel gıda"],coffee:["Kahve","Tatlılar","Kahvaltı"],reset:"Sıfırla",json:"Yapılandırma JSON (manuel kurulum)",valid:"Kontrast ve alanlar uygun",invalid:"Kontrast veya alanlar geçersiz",white:"Beyaz / vurgu",text:"Metin / arka plan",link:"Vurgu / arka plan",hint:"Geçerli JSON dosyasını işletme yöneticisi yerel sunucuya kurabilir. Önizleme sipariş almaz."},
 ru:{title:"Студия бренда",note:"Локальный концепт. Без официального согласования и публикации.",preset:"Пример профиля",name:"Название бренда",headline:"Заголовок",accent:"Акцент",surface:"Фон",ink:"Текст",preview:"Предпросмотр",menu:"Посмотреть ассортимент",products:"Пример категорий",grocery:["Овощи и фрукты","Завтрак","Бакалея"],coffee:["Кофе","Десерты","Завтраки"],reset:"Сбросить",json:"JSON-конфигурация для ручной установки",valid:"Поля и контраст допустимы",invalid:"Некорректные поля или контраст",white:"Белый / акцент",text:"Текст / фон",link:"Акцент / фон",hint:"Оператор может установить проверенный JSON на локальном сервере. Предпросмотр не принимает заказы."},
 en:{title:"Brand studio",note:"Local design preview. No official brand approval or publishing.",preset:"Sample profile",name:"Brand name",headline:"Headline",accent:"Accent",surface:"Background",ink:"Text",preview:"Preview",menu:"Explore assortment",products:"Sample categories",grocery:["Fruit and vegetables","Breakfast","Pantry"],coffee:["Coffee","Desserts","Breakfast"],reset:"Reset",json:"Configuration JSON for manual installation",valid:"Fields and contrast valid",invalid:"Invalid fields or contrast",white:"White / accent",text:"Text / background",link:"Accent / background",hint:"An operator can install valid JSON on the local server. Preview does not accept orders."}
};
function luminance(hex:string){
 const values=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 return .2126*values[0]+.7152*values[1]+.0722*values[2];
}
export function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
const textOK=(s:string,max:number)=>s.trim()===s&&s.length>0&&Array.from(s).length<=max&&!/[\p{Cc}\p{Cf}\p{Cs}]/u.test(s);
function profile(id:string):Profile{const p=presets.find(x=>x.tenantId===id)??presets[0];return {...p,headline:{...p.headline}}}
export function RetailBrand(){
 const [lang,setLang]=useState<Lang>("tr"),[draft,setDraft]=useState<Profile>(()=>profile("rozal"));
 const t=copy[lang],ratios=[contrast(draft.accent,"#FFFFFF"),contrast(draft.ink,draft.surface),contrast(draft.accent,draft.surface)];
 const valid=textOK(draft.name,48)&&languages.every(l=>textOK(draft.headline[l],120))&&ratios.every(x=>x>=4.5);
 const categories=draft.kind==="coffee"?t.coffee:t.grocery;
 return <main className="retail brand-studio"><header><a href="#retail-business">← BiteOS</a><strong>BRAND STUDIO</strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as Lang)}>{languages.map(l=><option key={l} value={l}>{l.toUpperCase()}</option>)}</select></header>
 <section className="retail-hero"><h1>{t.title}</h1><p>{t.note}</p></section>
 <p><a href="#retail-catalog-studio">{lang==="tr"?"Evrensel katalog":lang==="ru"?"Универсальный каталог":"Universal catalog"}</a></p>
 <div className="brand-layout"><section className="retail-cart"><label>{t.preset}<select value={draft.tenantId} onChange={e=>setDraft(profile(e.target.value))}>{presets.map(p=><option key={p.tenantId} value={p.tenantId}>{p.name}</option>)}</select></label><label>{t.name}<input value={draft.name} maxLength={96} onChange={e=>setDraft(p=>({...p,name:e.target.value}))}/></label>
 {languages.map(l=><label key={l}>{t.headline} · {l.toUpperCase()}<input value={draft.headline[l]} maxLength={240} onChange={e=>setDraft(p=>({...p,headline:{...p.headline,[l]:e.target.value}}))}/></label>)}
 <div className="brand-colors">{(["accent","surface","ink"] as const).map(k=><label key={k}>{t[k]}<input type="color" value={draft[k]} onChange={e=>setDraft(p=>({...p,[k]:e.target.value}))}/><small>{draft[k]}</small></label>)}</div>
 <button onClick={()=>setDraft(profile(draft.tenantId))}>{t.reset}</button>
 <p role="status">{valid?t.valid:t.invalid}</p>{[t.white,t.text,t.link].map((label,i)=><p key={label}>{label}: {ratios[i].toFixed(2)}:1 {ratios[i]>=4.5?"✓":"!"}</p>)}</section>
 <section className="brand-preview" aria-label={t.preview} style={{background:draft.surface,color:draft.ink}}><p>{t.preview} · DEMO</p><strong style={{color:draft.accent}}>{draft.name}</strong><div className="brand-preview-hero" style={{background:draft.accent,color:"#fff"}}><h2>{draft.headline[lang]}</h2><span>{t.menu}</span></div><h3>{t.products}</h3><div className="brand-preview-categories">{categories.map((name,i)=><article key={name}><span aria-hidden="true">{(draft.kind==="coffee"?["☕","🍰","🥐"]:["🍎","🥚","🍞"])[i]}</span><b>{name}</b></article>)}</div></section></div>
 <section className="retail-cart"><label>{t.json}<textarea readOnly rows={12} value={valid?JSON.stringify(draft,null,2):""}/></label><p>{t.hint}</p></section>
 </main>
}
