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
