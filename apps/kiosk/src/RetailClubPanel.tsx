import { useState } from "react";
import { goals,goalList,reviewList,reviewedCart,snapshotCart } from "./retailClub";
import type { ClubLang,ClubProduct,ClubList } from "./retailClub";
import "./retail-club.css";

const copy={
 tr:{title:"ROZAL LIFE",intro:"Günlük alışverişinizi kolaylaştırın",save:"Sepeti liste olarak kaydet",saved:"Kayıtlı listem",last:"Son tamamlanan sipariş",clear:"Listeleri sil",review:"Listeyi kontrol et",budget:"Ürün bütçesi (₺, isteğe bağlı)",quantity:"Adet",available:"Stok",changed:"Fiyat değişti",missing:"Ürün mevcut değil",over:"Bütçe aşıldı",apply:"Sepeti bu listeyle değiştir",close:"Kapat",empty:"Henüz liste yok",local:"Listeler yalnızca bu tarayıcıda saklanır. Üyelik veya ödül yok.",subtotal:"Ürün toplamı · teslimat hariç",remove:"Çıkar",invalid:"Miktarı düzeltin veya ürünü çıkarın.",storage:"Tarayıcı kaydı kullanılamıyor.",current:"Güncel örnek fiyatlar; sipariş sırasında tekrar kontrol edilir."},
 ru:{title:"ROZAL LIFE",intro:"Покупки под ваши повседневные задачи",save:"Сохранить корзину как список",saved:"Мой список",last:"Последний выполненный заказ",clear:"Удалить списки",review:"Проверить список",budget:"Бюджет на товары (₺, необязательно)",quantity:"Количество",available:"В наличии",changed:"Цена изменилась",missing:"Товар недоступен",over:"Бюджет превышен",apply:"Заменить корзину этим списком",close:"Закрыть",empty:"Списков пока нет",local:"Списки хранятся только в этом браузере. Без регистрации и бонусов.",subtotal:"Товары · без доставки",remove:"Убрать",invalid:"Измените количество или уберите позицию.",storage:"Хранилище браузера недоступно.",current:"Текущие демоцены; при заказе проверяются повторно."},
 en:{title:"ROZAL LIFE",intro:"Make everyday shopping easier",save:"Save cart as a list",saved:"My saved list",last:"Last fulfilled order",clear:"Delete lists",review:"Review list",budget:"Product budget (₺, optional)",quantity:"Quantity",available:"In stock",changed:"Price changed",missing:"Product unavailable",over:"Over budget",apply:"Replace cart with this list",close:"Close",empty:"No lists yet",local:"Lists stay in this browser. No membership or rewards.",subtotal:"Products · excluding delivery",remove:"Remove",invalid:"Adjust quantity or remove item.",storage:"Browser storage unavailable.",current:"Current sample prices; rechecked at checkout."}
};
type Props={lang:ClubLang;products:ClubProduct[];cart:Record<string,number>;saved:ClubList;last:ClubList;busy:boolean;storageError:boolean;onSave:(l:ClubList)=>void;onClear:()=>void;onApply:(cart:Record<string,number>)=>void};
export function RetailClubPanel({lang,products,cart,saved,last,busy,storageError,onSave,onClear,onApply}:Props){
 const t=copy[lang];
 const [draft,setDraft]=useState<ClubList|null>(null);
 const [budgetText,setBudget]=useState("");
 const amount=budgetText.trim()===""?null:Math.round(Number(budgetText)*100);
 const budget=amount===null?null:amount;
 const view=draft?reviewList(draft,products,budget):null;
 const money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 function open(l:ClubList){setDraft(l.map(x=>({...x})));setBudget("")}
 return <section className="club-panel" aria-label={t.title}>
 <div className="club-heading"><div><p>{t.title}</p><h2>{t.intro}</h2></div></div>
 <div className="club-goals">{goals.map((g,i)=><button type="button" key={g.id} disabled={busy||!products.length} onClick={()=>open(goalList(g.id,products))}><span aria-hidden="true">{["🍳","🎒","🥟","🛒"][i]}</span><b>{g.name[lang]}</b></button>)}</div>
 <div className="club-lists">
 <button disabled={busy||!snapshotCart(cart,products).length} onClick={()=>onSave(snapshotCart(cart,products))}>{t.save}</button>
 <button disabled={busy||!saved.length} onClick={()=>open(saved)}>{t.saved} ({saved.length})</button>
 <button disabled={busy||!last.length} onClick={()=>open(last)}>{t.last} ({last.length})</button>
 <button disabled={busy||(!saved.length&&!last.length)} onClick={()=>{onClear();setDraft(null)}}>{t.clear}</button>
 </div>
 <p className="club-note">{t.local}</p>{storageError&&<p role="alert">{t.storage}</p>}
 {draft&&view&&<section className="club-review" aria-label={t.review}>
 <h3>{t.review}</h3><p className="club-note">{t.current}</p>
 <label>{t.budget}<input disabled={busy} type="number" min="0" step="0.01" value={budgetText} onChange={e=>setBudget(e.target.value)}/></label>
 {view.lines.map(l=><div className="club-line" key={l.id}>
 <div><b>{l.product?.name[lang]??l.id}</b><small>{l.product?money(l.product.price):t.missing} · {t.available}: {l.available}</small>{l.changed&&<small className="club-warning">{t.changed}: {money(l.previousPrice)} → {money(l.product!.price)}</small>}</div>
 <label>{t.quantity}<input aria-label={t.quantity+" "+(l.product?.name[lang]??l.id)} disabled={busy} type="number" min={1} max={20} step={1} value={Number.isFinite(l.quantity)?l.quantity:""} onChange={e=>setDraft(prev=>prev?.map(x=>x.id===l.id?{...x,quantity:e.target.valueAsNumber}:x)??null)}/></label>
 <button disabled={busy} onClick={()=>setDraft(prev=>prev?.filter(x=>x.id!==l.id)??null)}>{t.remove}</button>
 </div>)}
 <p><b>{t.subtotal}: {Number.isFinite(view.subtotal)?money(view.subtotal):"—"}</b></p>
 {view.overBudget&&<p role="status" className="club-warning">{t.over}</p>}
 {!view.canApply&&!view.overBudget&&<p role="status" className="club-warning">{t.invalid}</p>}
 <div className="club-actions"><button disabled={busy||!view.canApply} onClick={()=>{const c=reviewedCart(draft,products,budget);if(c){onApply(c);setDraft(null)}}}>{t.apply}</button><button disabled={busy} onClick={()=>setDraft(null)}>{t.close}</button></div>
 </section>}
 </section>
}
