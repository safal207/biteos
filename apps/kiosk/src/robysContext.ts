export type Weather="unknown"|"mild"|"hot"|"cold"|"rain"|"wind"|"storm";
export type Intent="any"|"family"|"study"|"friends"|"quick"|"quiet";
export type Context={day:string;hour:number;weather:Weather;intent:Intent;budgetMinor:number|null;favoriteIds:readonly string[];unavailableIds:readonly string[]};
type Product={id:string;categoryId:string;priceMinor:number};
const DAY=86400000;
export const schoolBreaks=[["2026-11-16","2026-11-21"],["2027-01-25","2027-02-06"],["2027-03-08","2027-03-13"]] as const;
const specialDays:Record<string,string>={"01-01":"new-year","04-23":"children-day","05-19":"youth-day","10-29":"republic-day","11-24":"teachers-day"};
const validDay=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s&&s>="2026-09-14"&&s<="2027-12-31";
export function calendarContext(day:string){
 if(!validDay(day))throw Error("Date outside reviewed context range");
 const dow=new Date(day).getUTCDay(),weekend=dow===0||dow===6;
 const schoolBreak=schoolBreaks.some(([s,e])=>day>=s&&day<e);
 const schoolCalendarKnown=day>="2026-09-14"&&day<="2027-06-25";
 const event=specialDays[day.slice(5)]??null;
 return {weekend,schoolBreak,schoolCalendarKnown,event};
}
export function projectContext(input:Context,catalog:readonly Product[]){
 if(!Number.isInteger(input.hour)||input.hour<0||input.hour>23||!["unknown","mild","hot","cold","rain","wind","storm"].includes(input.weather)||!["any","family","study","friends","quick","quiet"].includes(input.intent)||input.budgetMinor!==null&&(!Number.isSafeInteger(input.budgetMinor)||input.budgetMinor<0)||!Array.isArray(input.favoriteIds)||!Array.isArray(input.unavailableIds))throw Error("Invalid context");
 const cal=calendarContext(input.day),closed=input.hour<9,evening=input.hour>=17;
 const blocked=closed||input.weather==="storm";
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
  add(favorites.has(p.id),8,"favorite");
  return {productId:p.id,priceMinor:p.priceMinor,score,reasons};
 }).sort((a,b)=>b.score-a.score||a.productId.localeCompare(b.productId)).slice(0,5);
 return {schema:"biteos.robys-context-draft.v1",calendar:cal,closedByCatalogHours:closed,weather:input.weather,weatherSource:"manual-scenario",items,blocked,stockVerified:false,personalizationSource:"explicit-choice-only",externalEffectsAuthorized:false,pushAuthorized:false,causalEffectEstablished:false};
}
