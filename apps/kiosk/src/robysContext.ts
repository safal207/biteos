export type Weather="unknown"|"mild"|"hot"|"cold"|"rain"|"wind"|"storm";
export type Intent="any"|"family"|"study"|"friends"|"quick"|"quiet";
export type Context={day:string;hour:number;weather:Weather;intent:Intent;budgetMinor:number|null;favoriteIds:readonly string[];unavailableIds:readonly string[];optionalThemes?:boolean};
type Product={id:string;categoryId:string;priceMinor:number};
const DAY=86400000;
export const schoolBreaks=[["2026-11-16","2026-11-21"],["2027-01-25","2027-02-06"],["2027-03-08","2027-03-13"]] as const;
const fixedOccasions=[["new-year","01-01","public","winter"],["valentines","02-14","international","together"],["women-day","03-08","international","thanks"],["children-day","04-23","public","family"],["labor-day","05-01","public","neutral"],["youth-day","05-19","public","neutral"],["chocolate-day","07-07","theme","chocolate"],["democracy-day","07-15","public","neutral"],["victory-day","08-30","public","neutral"],["coffee-day","10-01","industry","coffee"],["republic-day","10-29","public","neutral"],["halloween","10-31","optional","autumn"],["memorial-day","11-10","commemoration","neutral"],["teachers-day","11-24","local","thanks"],["turkish-coffee-day","12-05","industry","turkish-coffee"],["christmas","12-25","optional","winter"],["new-year-eve","12-31","international","winter"]] as const;
type Occasion={id:string;kind:string;theme:string;day:string};
const movable2027=[{id:"ramadan-feast",start:"2027-03-09",end:"2027-03-12",kind:"public",theme:"neutral"},{id:"sacrifice-feast",start:"2027-05-16",end:"2027-05-20",kind:"public",theme:"neutral"}];
export function occasionsOn(day:string):Occasion[]{
 if(!validDay(day))throw Error("Date outside reviewed context range");
 const out:Occasion[]=fixedOccasions.filter(([,md])=>md===day.slice(5)).map(([id,,kind,theme])=>({id,kind,theme,day}));
 const d=new Date(day),month=d.getUTCMonth(),n=d.getUTCDate();
 if(d.getUTCDay()===0&&month===4&&n>=8&&n<=14)out.push({id:"mothers-day",kind:"international",theme:"family",day});
 if(d.getUTCDay()===0&&month===5&&n>=15&&n<=21)out.push({id:"fathers-day",kind:"international",theme:"family",day});
 for(const e of movable2027)if(day>=e.start&&day<e.end)out.push({id:e.id,kind:e.kind,theme:e.theme,day});
 return out;
}
export function upcomingOccasions(day:string,days=30){
 if(!validDay(day)||!Number.isInteger(days)||days<1||days>60)throw Error("Invalid horizon");
 return Array.from({length:days},(_,i)=>new Date(Date.parse(day)+i*DAY).toISOString().slice(0,10)).filter(validDay).flatMap(occasionsOn);
}
const validDay=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s&&s>="2026-09-14"&&s<="2027-12-31";
export function calendarContext(day:string){
 if(!validDay(day))throw Error("Date outside reviewed context range");
 const dow=new Date(day).getUTCDay(),weekend=dow===0||dow===6;
 const schoolBreak=schoolBreaks.some(([s,e])=>day>=s&&day<e);
 const schoolCalendarKnown=day>="2026-09-14"&&day<="2027-06-25";
 const occasions=occasionsOn(day),event=occasions[0]?.id??null;
 return {weekend,schoolBreak,schoolCalendarKnown,event,occasions,upcoming:upcomingOccasions(day),memorial:occasions.some(o=>o.kind==="commemoration")};
}
export function projectContext(input:Context,catalog:readonly Product[]){
 if(!Number.isInteger(input.hour)||input.hour<0||input.hour>23||!["unknown","mild","hot","cold","rain","wind","storm"].includes(input.weather)||!["any","family","study","friends","quick","quiet"].includes(input.intent)||input.budgetMinor!==null&&(!Number.isSafeInteger(input.budgetMinor)||input.budgetMinor<0)||!Array.isArray(input.favoriteIds)||!Array.isArray(input.unavailableIds))throw Error("Invalid context");
 const cal=calendarContext(input.day),closed=input.hour<9,evening=input.hour>=17;
 const blocked=closed||input.weather==="storm"||cal.memorial;
 const themes=new Set(cal.occasions.filter(o=>o.kind!=="optional"||input.optionalThemes===true).map(o=>o.theme));
 const unavailable=new Set(input.unavailableIds),favorites=new Set(input.favoriteIds);
 const items=blocked?[]:catalog.filter(p=>!unavailable.has(p.id)&&(input.budgetMinor===null||p.priceMinor<=input.budgetMinor)).map(p=>{
  const reasons:string[]=[];let score=0;
  const add=(condition:boolean,points:number,reason:string)=>{if(condition){score+=points;reasons.push(reason)}};
  const warm=p.categoryId==="hot-coffee"||p.categoryId==="brew-hot"||p.categoryId==="herbal-tea";
  const chill=p.categoryId==="cold-coffee"||p.categoryId==="refreshers"||p.id==="pairing-offers:iced-san-sebastian-pairing"||p.id==="pairing-offers:cool-lime-macaron-pairing";
  const snack=p.categoryId==="food"||p.categoryId==="desserts";
  add(input.weather==="hot"&&chill,6,"hot");
  add(["cold","rain","wind"].includes(input.weather)&&warm,6,"warm");
  add(input.hour<12&&(p.categoryId==="food"||p.id==="brew-hot:filter-coffee"),4,"morning");
  add(evening&&(p.categoryId==="pairing-offers"||p.categoryId==="desserts"),3,"evening");
  add((cal.weekend||cal.schoolBreak||cal.event==="children-day")&&(snack||p.id==="brew-hot:milk"),2,"calendar");
  add(input.intent==="family"&&(p.id==="brew-hot:milk"||p.categoryId==="food"||p.id==="desserts:cookie"),7,"family");
  add(input.intent==="study"&&(p.id==="brew-hot:filter-coffee"||p.id==="brew-hot:black-tea"||p.id==="food:sesame-simit"),7,"study");
  add(input.intent==="friends"&&p.categoryId==="pairing-offers",7,"friends");
  add(input.intent==="quick"&&(p.id==="food:sesame-simit"||p.id==="brew-hot:black-tea"||p.categoryId==="food"),6,"quick");
  add(input.intent==="quiet"&&p.categoryId==="herbal-tea",7,"quiet");
  add(themes.has("winter")&&(p.id==="brew-hot:salep"||p.id==="brew-hot:hot-chocolate"||p.id==="hot-coffee:cinnamon-latte"),4,"occasion");
  add(themes.has("autumn")&&(p.id==="hot-coffee:chocolate-cookie-latte"||p.id==="hot-coffee:caramel-latte"||p.id==="desserts:brownie"),4,"occasion");
  add(themes.has("together")&&(p.categoryId==="pairing-offers"||p.categoryId==="desserts"),4,"occasion");
  add(themes.has("family")&&(p.categoryId==="food"||p.id==="brew-hot:milk"||p.id==="desserts:cookie"),4,"occasion");
  add(themes.has("thanks")&&(p.id==="brew-hot:turkish-coffee"||p.categoryId==="desserts"),3,"occasion");
  add(themes.has("chocolate")&&(p.id==="brew-hot:hot-chocolate"||p.id==="desserts:brownie"||p.id==="desserts:chocolate-cake"),4,"occasion");
  add(themes.has("coffee")&&(p.categoryId==="hot-coffee"||p.categoryId==="cold-coffee"||p.id==="brew-hot:turkish-coffee"),3,"occasion");
  add(themes.has("turkish-coffee")&&p.id==="brew-hot:turkish-coffee",8,"occasion");
  add(favorites.has(p.id),8,"favorite");
  return {productId:p.id,priceMinor:p.priceMinor,score,reasons};
 }).sort((a,b)=>b.score-a.score||a.productId.localeCompare(b.productId)).slice(0,5);
 return {schema:"biteos.robys-context-draft.v1",calendar:cal,closedByCatalogHours:closed,weather:input.weather,weatherSource:"manual-scenario",items,blocked,stockVerified:false,personalizationSource:"explicit-choice-only",externalEffectsAuthorized:false,pushAuthorized:false,causalEffectEstablished:false};
}
