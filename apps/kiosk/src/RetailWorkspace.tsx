import {useState} from "react";
import {workspaceGroups,workspaceSearch} from "./workspace";
import type {WorkspaceLang} from "./workspace";
import "./retail.css";
import "./retail-workspace.css";

const copy={
 tr:{title:"BiteOS çalışma alanı",note:"Yerel işletme prototipi · gerçek satış veya işlem yetkisi yok.",search:"Araç ara",empty:"Eşleşen araç yok",home:"Teslimat demosu",commerce:"Ticaret",operations:"Operasyonlar",analysis:"Analiz",studio:"Tasarım stüdyoları",demo:"Demo",local:"Demo / yerel anahtar",simulation:"Simülasyon"},
 ru:{title:"Рабочее пространство BiteOS",note:"Прототип для бизнеса. Без реальных продаж и полномочий на операции.",search:"Найти инструмент",empty:"Инструменты не найдены",home:"Демо доставки",commerce:"Торговля",operations:"Операции",analysis:"Аналитика",studio:"Студии",demo:"Демо",local:"Демо / локальный ключ",simulation:"Симуляция"},
 en:{title:"BiteOS workspace",note:"Local business prototype. No real sales or transaction authority.",search:"Find a tool",empty:"No matching tools",home:"Delivery demo",commerce:"Commerce",operations:"Operations",analysis:"Analytics",studio:"Studios",demo:"Demo",local:"Demo / local key",simulation:"Simulation"}
};
export function RetailWorkspace(){
 const [lang,setLang]=useState<WorkspaceLang>("tr"),[q,setQ]=useState("");
 const t=copy[lang],entries=workspaceSearch(lang,q);
 return <main className="retail biteos-workspace" lang={lang}><header><a href="#">{t.home}</a><strong>BiteOS</strong><select aria-label="Language" value={lang} onChange={e=>setLang(e.target.value as WorkspaceLang)}><option value="tr">TR</option><option value="ru">RU</option><option value="en">EN</option></select></header><section className="retail-hero"><p>BUSINESS OS · PREVIEW</p><h1>{t.title}</h1><p>{t.note}</p></section>
 <label className="workspace-search">{t.search}<input value={q} onChange={e=>setQ(e.target.value)} type="search"/></label>
 {!entries.length&&<p role="status">{t.empty}</p>}
 {workspaceGroups.map(group=>{const rows=entries.filter(e=>e.group===group);return rows.length?<section key={group}><h2>{t[group]}</h2><div className="workspace-grid">{rows.map(e=><a data-workspace-route={e.route} key={e.route} href={e.route} className="workspace-tile"><span className="workspace-mode">{t[e.mode]}</span><strong>{e.name[lang]}</strong><span>{e.description[lang]}</span></a>)}</div></section>:null})}
 </main>
}
