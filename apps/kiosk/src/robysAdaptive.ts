export const moods=["standard","cozy","study","friends","family","fresh"] as const;
export type Mood=typeof moods[number];
export type Lang="tr"|"ru"|"en";
type Product={id:string;priceMinor:number;categoryId:string};
export const moodInfo={
 standard:{names:["Standart menü","Обычное меню","Standard menu"],titles:["Roby’s menü","Меню Roby’s","Roby’s menu"],theme:"standard",primary:null,extra:null},
 cozy:{names:["Sıcak mola","Уют","Cozy"],titles:["Bugün sıcak bir mola","Сегодня — тепло и уют","A cozy moment today"],theme:"cozy",primary:"brew-hot:hot-chocolate",extra:"desserts:brownie"},
 study:{names:["Ders molası","Учёба","Study"],titles:["Küçük çalışma molası","Пауза для учёбы","Your study break"],theme:"study",primary:"brew-hot:black-tea",extra:"food:sesame-simit"},
 friends:{names:["Arkadaşlar","Друзья","Friends"],titles:["Birlikte daha güzel","Вместе лучше","Better together"],theme:"friends",primary:"pairing-offers:iced-san-sebastian-pairing",extra:null},
 family:{names:["Aile","Семья","Family"],titles:["Ailece küçük bir mola","Семейная пауза","A little family moment"],theme:"family",primary:"brew-hot:milk",extra:"desserts:cookie"},
 fresh:{names:["Serin mola","Свежесть","Fresh"],titles:["Bugün ferah bir mola","Сегодня — свежесть","A fresh moment today"],theme:"fresh",primary:"refreshers:cool-lime",extra:"desserts:macaron"}
} as const;
export function readMood(value:string|null):Mood{return moods.includes(value as Mood)?value as Mood:"standard"}
export function sharedLook(href:string,mood:Mood){
 const u=new URL(href);if(!["https:","http:"].includes(u.protocol)||u.username||u.password||!moods.includes(mood))throw Error("Invalid share link");
 u.search="";u.hash="#retail-robys-experience";u.searchParams.set("robysMood",mood);return u.href;
}
export function experience(mood:Mood,catalog:readonly Product[],budgetMinor:number|null=null,unavailable:readonly string[]=[],blocked=false){
 if(!moods.includes(mood)||budgetMinor!==null&&(!Number.isSafeInteger(budgetMinor)||budgetMinor<0))throw Error("Invalid experience");
 const config=moodInfo[mood],eligible=catalog.filter(p=>!unavailable.includes(p.id)&&(budgetMinor===null||p.priceMinor<=budgetMinor)),primary=blocked?undefined:eligible.find(p=>p.id===config.primary);
 const extra=primary?eligible.find(p=>p.id===config.extra&&p.id!==primary.id&&(budgetMinor===null||primary.priceMinor+p.priceMinor<=budgetMinor)):undefined;
 return {mood,theme:blocked?"standard":config.theme,primary:primary??null,extra:extra??null,baseMinor:primary?.priceMinor??null,withExtraMinor:primary&&extra?primary.priceMinor+extra.priceMinor:null,externalEffectsAuthorized:false,stockVerified:false,pricesPersonalized:false};
}
export const discoveries=["story","menu","taste"] as const;
export type Discovery=typeof discoveries[number];
export function addDiscovery(current:readonly Discovery[],next:Discovery){if(!discoveries.includes(next))throw Error("Unknown discovery");return [...new Set([...current.filter(x=>discoveries.includes(x)),next])]}

export const seasonalLooks={
 winter:{names:["Kış ışıkları","Зимние огни","Winter lights"],colors:["#69502e","#f8e7b7","#bb9261"]},
 autumn:{names:["Sonbahar hikâyesi","Осенняя история","Autumn story"],colors:["#4b291b","#ffddad","#c7722f"]},
 together:{names:["Birlikte","Вместе","Together"],colors:["#69334b","#ffe6ef","#bc7899"]},
 family:{names:["Aile zamanı","Семейное время","Family time"],colors:["#6b4a25","#ffedbc","#c9a06e"]},
 coffee:{names:["Kahve kültürü","Культура кофе","Coffee culture"],colors:["#483225","#ffedda","#aa7352"]},
 chocolate:{names:["Çikolata molası","Шоколадная пауза","Chocolate break"],colors:["#452a25","#ffdec8","#a16e59"]},
 thanks:{names:["Teşekkür zamanı","Время благодарности","A moment of thanks"],colors:["#475b49","#edf5db","#b0bb85"]}
} as const;
export type SeasonalLook=keyof typeof seasonalLooks;
type OccasionSignal={kind:string;theme:string};
export function chooseSeason(mood:Mood,occasions:readonly OccasionSignal[],optional:boolean,blocked:boolean):SeasonalLook|null{
 if(mood==="standard"||blocked||occasions.some(o=>o.kind==="commemoration"))return null;
 for(const o of occasions){if(o.kind==="optional"&&!optional)continue;const theme=o.theme==="turkish-coffee"?"coffee":o.theme;if(Object.hasOwn(seasonalLooks,theme))return theme as SeasonalLook}
 return null;
}
export const moodColors:Record<Mood,readonly [string,string,string]>={standard:["#55453c","#fff4e5","#b49884"],cozy:["#493124","#fff4df","#b58966"],study:["#284936","#eef9e7","#8caf94"],friends:["#642d4b","#fff1f8","#c583a2"],family:["#65401e","#fff0c5","#d5ac6b"],fresh:["#174e4e","#e8fffa","#7bbfb3"]};
export function storyCard(mood:Mood,lang:Lang,season:SeasonalLook|null){
 if(!moods.includes(mood)||!["tr","ru","en"].includes(lang)||season!==null&&!Object.hasOwn(seasonalLooks,season))throw Error("Invalid story");
 const i=["tr","ru","en"].indexOf(lang),colors=season?seasonalLooks[season].colors:moodColors[mood];
 return {title:moodInfo[mood].titles[i],subtitle:season?seasonalLooks[season].names[i]:moodInfo[mood].names[i],colors,brand:"MY ROBY’S",footer:"ROBY’S COFFEE HOUSE • GAZİPAŞA",containsPersonalData:false};
}
