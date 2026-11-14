import { parseClubList } from "./retailClub";
import type { ClubList } from "./retailClub";

export type RhythmPlan={list:ClubList;intervalDays:number;nextDate:string};
export type Preferences={favorite:string|null;rhythm:RhythmPlan|null};
const dayMs=86400000;
const sku=/^[a-z0-9-]{1,64}$/;
export function validDay(day:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<"2000-01-01"||day>"2099-12-31")return false;
 const t=Date.parse(day+"T00:00:00Z");
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===day;
}
export function localDay(now:Date):string{
 return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");
}
export function addCalendarDays(day:string,n:number):string|null{
 if(!validDay(day)||!Number.isInteger(n)||n<1||n>90)return null;
 const next=new Date(Date.parse(day+"T00:00:00Z")+n*dayMs).toISOString().slice(0,10);
 return validDay(next)?next:null;
}
export function createRhythm(list:ClubList,intervalDays:number,nextDate:string):RhythmPlan|null{
 const clean=parseClubList(JSON.stringify(list));
 if(!clean.length||!Number.isInteger(intervalDays)||intervalDays<1||intervalDays>90||!validDay(nextDate))return null;
 return {list:clean,intervalDays,nextDate};
}
export function rhythmStatus(plan:RhythmPlan,today:string):"due"|"upcoming"|"unknown"{
 if(!validDay(today)||!validDay(plan.nextDate))return "unknown";
 return today>=plan.nextDate?"due":"upcoming";
}
// Advance only on explicit user action; keep one review, not a backlog of orders.
export function advanceRhythm(plan:RhythmPlan,today:string):RhythmPlan|null{
 if(rhythmStatus(plan,today)!=="due")return null;
 const next=addCalendarDays(today,plan.intervalDays);
 return next?createRhythm(plan.list,plan.intervalDays,next):null;
}
export function parsePreferences(raw:string|null):Preferences{
 const empty:Preferences={favorite:null,rhythm:null};
 if(!raw)return empty;
 try{
  const p=JSON.parse(raw);
  if(!p||p.version!==1)return empty;
  const favorite=typeof p.favorite==="string"&&sku.test(p.favorite)?p.favorite:null;
  const r=p.rhythm;
  const rhythm=r&&Array.isArray(r.list)?createRhythm(r.list,r.intervalDays,r.nextDate):null;
  return {favorite,rhythm};
 }catch{return empty}
}
