import { useState } from "react";
import { rankJourney,journeyHint,reviewList,reviewedCart,snapshotCart } from "./retailClub";
import type { ClubLang,ClubProduct,ClubList,JourneyTime,JourneyPlace } from "./retailClub";
import "./retail-club.css";
import { RetailRhythmPanel } from "./RetailRhythmPanel";

const copy={
 tr:{title:"ROZAL LIFE",intro:"Günlük alışverişinizi kolaylaştırın",save:"Sepeti liste olarak kaydet",saved:"Kayıtlı listem",last:"Son tamamlanan sipariş",clear:"Listeleri sil",review:"Listeyi kontrol et",budget:"Ürün bütçesi (₺, isteğe bağlı)",quantity:"Adet",available:"Stok",changed:"Fiyat değişti",missing:"Ürün mevcut değil",over:"Bütçe aşıldı",apply:"Sepeti bu listeyle değiştir",close:"Kapat",empty:"Henüz liste yok",local:"Listeler yalnızca bu tarayıcıda saklanır. Üyelik veya ödül yok.",subtotal:"Ürün toplamı · teslimat hariç",remove:"Çıkar",invalid:"Miktarı düzeltin veya ürünü çıkarın.",storage:"Tarayıcı kaydı kullanılamıyor.",current:"Güncel örnek fiyatlar; sipariş sırasında tekrar kontrol edilir."},
 ru:{title:"ROZAL LIFE",intro:"Покупки под ваши повседневные задачи",save:"Сохранить корзину как список",saved:"Мой список",last:"Последний выполненный заказ",clear:"Удалить списки",review:"Проверить список",budget:"Бюджет на товары (₺, необязательно)",quantity:"Количество",available:"В наличии",changed:"Цена изменилась",missing:"Товар недоступен",over:"Бюджет превышен",apply:"Заменить корзину этим списком",close:"Закрыть",empty:"Списков пока нет",local:"Списки хранятся только в этом браузере. Без регистрации и бонусов.",subtotal:"Товары · без доставки",remove:"Убрать",invalid:"Измените количество или уберите позицию.",storage:"Хранилище браузера недоступно.",current:"Текущие демоцены; при заказе проверяются повторно."},
 en:{title:"ROZAL LIFE",intro:"Make everyday shopping easier",save:"Save cart as a list",saved:"My saved list",last:"Last fulfilled order",clear:"Delete lists",review:"Review list",budget:"Product budget (₺, optional)",quantity:"Quantity",available:"In stock",changed:"Price changed",missing:"Product unavailable",over:"Over budget",apply:"Replace cart with this list",close:"Close",empty:"No lists yet",local:"Lists stay in this browser. No membership or rewards.",subtotal:"Products · excluding delivery",remove:"Remove",invalid:"Adjust quantity or remove item.",storage:"Browser storage unavailable.",current:"Current sample prices; rechecked at checkout."}
};
const journeyCopy={
 tr:{time:"Ne zaman alışveriş?",place:"Neredesiniz?",times:{any:"Fark etmez",morning:"Sabah",day:"Gündüz",evening:"Akşam",week:"Haftalık plan"},places:{any:"Fark etmez",home:"Evde",onway:"Yolda",store:"Mağazada"},hints:{compare:"Mağazadan alma ve demo teslimat seçeneklerini karşılaştırın.",pickup:"Yol üzerindeyseniz mağazadan almayı değerlendirin; hazır olma süresi doğrulanmamıştır.",in_store:"Ürün listesini kontrol edin; koridor ve raf konumu bilinmiyor."},timeMatch:"Zamanınıza uygun",placeMatch:"Durumunuza uygun",ready:"İncelemeye hazır",blocked:"Önce kontrol edin",privacy:"Seçimler geçicidir. GPS, konum izleme veya otomatik sipariş yok."},
 ru:{time:"Когда планируете покупки?",place:"Где вы сейчас?",times:{any:"Неважно",morning:"Утром",day:"Днём",evening:"Вечером",week:"На неделю"},places:{any:"Неважно",home:"Дома",onway:"По дороге",store:"В магазине"},hints:{compare:"Сравните самовывоз и демонстрационные варианты доставки.",pickup:"По дороге можно рассмотреть самовывоз; время готовности не подтверждено.",in_store:"Проверьте список товаров; расположение полок неизвестно."},timeMatch:"Подходит по времени",placeMatch:"Подходит по ситуации",ready:"Можно проверить",blocked:"Требуется проверка",privacy:"Выбор временный. Без GPS, отслеживания или автозаказов."},
 en:{time:"When are you shopping?",place:"Where are you?",times:{any:"Any time",morning:"Morning",day:"Daytime",evening:"Evening",week:"Weekly plan"},places:{any:"Anywhere",home:"At home",onway:"On the way",store:"In store"},hints:{compare:"Compare pickup and sample delivery options.",pickup:"Consider pickup on your way; readiness time is not verified.",in_store:"Check your list; aisle and shelf locations are unknown."},timeMatch:"Matches your time",placeMatch:"Matches your situation",ready:"Ready to review",blocked:"Needs review",privacy:"Temporary selections. No GPS, tracking or automatic orders."}
};
type Props={lang:ClubLang;products:ClubProduct[];cart:Record<string,number>;saved:ClubList;last:ClubList;busy:boolean;storageError:boolean;onSave:(l:ClubList)=>void;onClear:()=>void;onApply:(cart:Record<string,number>)=>void};
export function RetailClubPanel({lang,products,cart,saved,last,busy,storageError,onSave,onClear,onApply}:Props){
 const t=copy[lang];
 const j=journeyCopy[lang];
 const [journeyTime,setJourneyTime]=useState<JourneyTime>("any");
 const [journeyPlace,setJourneyPlace]=useState<JourneyPlace>("any");
 const [draft,setDraft]=useState<ClubList|null>(null);
 const [budgetText,setBudget]=useState("");
 const amount=budgetText.trim()===""?null:Math.round(Number(budgetText)*100);
 const budget=amount===null?null:amount;
 const view=draft?reviewList(draft,products,budget):null;
 const ranked=rankJourney({time:journeyTime,place:journeyPlace,budget},products);
 const money=(n:number)=>new Intl.NumberFormat(lang,{style:"currency",currency:"TRY"}).format(n/100);
 function open(l:ClubList){setDraft(l.map(x=>({...x})))}
 return <section className="club-panel" aria-label={t.title}>
 <div className="club-heading"><div><p>{t.title}</p><h2>{t.intro}</h2></div></div>
 <div className="club-context">
 <label>{j.time}<select disabled={busy} value={journeyTime} onChange={e=>setJourneyTime(e.target.value as JourneyTime)}>{Object.entries(j.times).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label>{j.place}<select disabled={busy} value={journeyPlace} onChange={e=>setJourneyPlace(e.target.value as JourneyPlace)}>{Object.entries(j.places).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label>{t.budget}<input disabled={busy} type="number" min="0" step="0.01" value={budgetText} onChange={e=>setBudget(e.target.value)}/></label>
 </div><p className="club-note" role="status">{j.hints[journeyHint(journeyPlace)]}</p><p className="club-note">{j.privacy}</p>
 <div className="club-goals">{ranked.map(({goal,list,view,timeMatch,placeMatch,index})=><button type="button" key={goal.id} disabled={busy||!products.length} onClick={()=>open(list)}><span aria-hidden="true">{["🍳","🎒","🥟","🛒"][index]}</span><b>{goal.name[lang]}</b><small className={view.canApply?"club-ready":"club-warning"}>{view.canApply?money(view.subtotal):j.blocked}</small><small>{[timeMatch?j.timeMatch:"",placeMatch?j.placeMatch:""].filter(Boolean).join(" · ")|| (view.canApply?j.ready:j.blocked)}</small></button>)}</div>
 <div className="club-lists">
 <button disabled={busy||!snapshotCart(cart,products).length} onClick={()=>onSave(snapshotCart(cart,products))}>{t.save}</button>
 <button disabled={busy||!saved.length} onClick={()=>open(saved)}>{t.saved} ({saved.length})</button>
 <button disabled={busy||!last.length} onClick={()=>open(last)}>{t.last} ({last.length})</button>
 <button disabled={busy||(!saved.length&&!last.length)} onClick={()=>{onClear();setDraft(null)}}>{t.clear}</button>
 </div>
 <p className="club-note">{t.local}</p>{storageError&&<p role="alert">{t.storage}</p>}
 <RetailRhythmPanel lang={lang} products={products} saved={saved} last={last} busy={busy} onReview={open}/>
 {draft&&view&&<section className="club-review" aria-label={t.review}>
 <h3>{t.review}</h3><p className="club-note">{t.current}</p>
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
