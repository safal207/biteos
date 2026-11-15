// Read-only reviewed public snapshot; no live scraping, inferred market shares or personal data.
type L=readonly [string,string,string];
export type Interest="all"|"study"|"dessert"|"community"|"evening";
type Observation={id:string;name:string;address:string;note:L;source:string;kind:"directory"|"municipal";reviewed:string};
const reviewed="2026-11-14";
export const observations:readonly Observation[]=[
 {id:"robys",name:"Roby’s Coffee House",address:"Uğur Mumcu Cd. 95/1 AA",note:["Ders çalışma ve tatlılar yorumlarda öne çıkıyor.","В отдельных отзывах отмечены удобство для учёбы и десерты.","Selected reviews mention study-friendly space and desserts."],source:"https://www.menu-tr.com/antalya/gazipasa/kafe/robys-coffee-house",kind:"directory",reviewed},
 {id:"palm",name:"Palm Coffee Gazipaşa",address:"Uğur Mumcu Cd. 104B",note:["Kahvaltı ve sakin ortam; listelenen kapanış 01:00.","Завтраки и спокойная атмосфера; в каталоге закрытие в 01:00.","Breakfast and quiet atmosphere; listed closing time 01:00."],source:"https://restaurantguru.com/Palm-Coffee-Gazipasa-Gazipasa",kind:"directory",reviewed},
 {id:"gotto",name:"GOTTO COFFEE CO.",address:"Uğur Mumcu Cd. 74/A",note:["Aynı cadde üzerinde listelenen kahve dükkânı.","Кофейня на той же улице по данным каталога.","Coffee shop listed on the same street."],source:"https://servisadresbul.com.tr/antalya/kafe/index.html",kind:"directory",reviewed},
 {id:"mixx",name:"Mixx Point Coffee&Shop",address:"Uğur Mumcu Cd. 133/B",note:["Kahve, çay ve kurabiye; listelenen kapanış 01:00.","Кофе, чай и печенье; в каталоге закрытие в 01:00.","Coffee, tea and cookies; listed closing time 01:00."],source:"https://qrfix.com.tr/blog/antalya/gazipasa-en-iyi-kahve-mekanlari-en-iyi-10-mekan",kind:"directory",reviewed},
 {id:"pigro",name:"Pigro Coffee Shop",address:"Uğur Mumcu Cd. 90/B",note:["Bir yorumda masa oyunları belirtiliyor.","В одном из опубликованных отзывов упоминаются настольные игры.","One published review mentions table games."],source:"https://tecrubelerim.com/isletme/pigro-coffee-shop-gazipasa",kind:"directory",reviewed},
 {id:"kultur",name:"Kültür Kafe",address:"Ilıca Parkı, Pazarcı",note:["Belediye açılış duyurusunda kitap, tavla ve zeka oyunları.","В официальном сообщении об открытии — книги, нарды и развивающие игры.","Municipal opening notice describes books, backgammon and brain games."],source:"https://gazipasa.bel.tr/gazipasa-belediyesi-kultur-kafe-ilica-parkinda-hizmete-acildi",kind:"municipal",reviewed}
];
type Hypothesis={id:string;interest:Exclude<Interest,"all">;title:L;test:L;metric:L;basis:readonly string[];products:readonly string[]};
export const hypotheses:readonly Hypothesis[]=[
 {id:"study-break",interest:"study",title:["Ders molası","Учебная пауза","Study break"],test:["Sessiz çalışma tercihi ve kısa menü; indirim yok.","Предложить компактную подборку для учёбы без скидок.","Test a compact study menu without a discount."],metric:["Sepet ekleme oturumu","Доля сессий с корзиной","Cart-add session rate"],basis:["robys","palm"],products:["brew-hot:black-tea","food:sesame-simit"]},
 {id:"dessert-discovery",interest:"dessert",title:["Tatlı keşfi","Открытие десертов","Dessert discovery"],test:["Mevcut tatlı ve kahve eşleşmesini test et.","Проверить существующее сочетание кофе и десерта.","Test an existing coffee-dessert pairing."],metric:["POS katkısı ve sepet ilgisi ayrı","Вклад по POS и интерес к корзине отдельно","POS contribution and cart interest separately"],basis:["robys","mixx","gotto"],products:["pairing-offers:iced-san-sebastian-pairing"]},
 {id:"community-evening",interest:"community",title:["Topluluk buluşması","Встреча сообщества","Community meetup"],test:["Sahip onaylı küçük masa oyunu etkinliği taslağı.","Обсудить с хозяйкой добровольную встречу с настольными играми.","Draft an owner-reviewed voluntary board-game meetup."],metric:["Katılım ve maliyet","Участие и расходы","Attendance and costs"],basis:["pigro","kultur"],products:[]},
 {id:"evening-choice",interest:"evening",title:["Akşam seçimi","Вечерний выбор","Evening choice"],test:["Mevcut saatler içinde arkadaşlara menü seçkisi.","Подборка для встреч в пределах текущих часов кафе.","Friend-group menu within current opening hours."],metric:["Saat dilimine göre POS katkısı","Вклад по POS по часам","POS contribution by hour"],basis:["palm","mixx"],products:["pairing-offers:cool-lime-macaron-pairing"]}
];
const DAY=86400000;
function date(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error("Invalid date");return Date.parse(s)}
export function marketReview(asOf:string,interest:Interest,catalogIds:readonly string[]){
 if(!["all","study","dessert","community","evening"].includes(interest))throw Error("Invalid interest");
 const now=date(asOf),rows=observations.map(o=>({...o,fresh:now>=date(o.reviewed)&&now-date(o.reviewed)<=30*DAY})),available=new Set(rows.filter(o=>o.fresh).map(o=>o.id));
 const drafts=hypotheses.filter(h=>(interest==="all"||h.interest===interest)&&h.basis.every(id=>available.has(id))&&h.products.every(id=>catalogIds.includes(id)));
 return {rows,drafts,marketCoverageComplete:false,gapsVerified:false,priceComparisonAvailable:false,causalEffectEstablished:false,externalEffectsAuthorized:false};
}
