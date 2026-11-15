// Exploratory next-day sold-unit forecast, not latent demand or procurement authority.
export const forecastWeather=["unknown","mild","hot","cold","rain","wind","storm"] as const;
export type Weather=typeof forecastWeather[number];
export type SaleDay={day:string;units:number;availableAllDay:boolean;weather:Weather;occasion:boolean};
export type History={schema:"biteos.robys-sales-history.v1";tenantId:"robys";source:"operator-reconciled-pos";catalogRevision:string;productId:string;weatherBasis:"declared-pre-day-scenario";days:SaleDay[]};
const DAY=86400000;
const date=(n:number)=>new Date(n).toISOString().slice(0,10);
function day(s:unknown){if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||date(Date.parse(s))!==s)throw Error("Invalid date");return Date.parse(s)}
const exact=(v:unknown,k:string[]):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
function weather(v:unknown):v is Weather{return typeof v==="string"&&(forecastWeather as readonly string[]).includes(v)}
export function decodeHistory(v:unknown,asOf:string,revision:string,ids:readonly string[]):History{
 if(!exact(v,["schema","tenantId","source","catalogRevision","productId","weatherBasis","days"])||v.schema!=="biteos.robys-sales-history.v1"||v.tenantId!=="robys"||v.source!=="operator-reconciled-pos"||v.catalogRevision!==revision||typeof v.productId!=="string"||!ids.includes(v.productId)||v.weatherBasis!=="declared-pre-day-scenario"||!Array.isArray(v.days)||v.days.length<56||v.days.length>112)throw Error("Invalid history");
 const first=v.days[0];if(!exact(first,["day","units","availableAllDay","weather","occasion"]))throw Error("Invalid day");
 const start=day(first.day);
 const days:SaleDay[]=v.days.map((d,i)=>{if(!exact(d,["day","units","availableAllDay","weather","occasion"])||d.day!==date(start+i*DAY)||typeof d.units!=="number"||!Number.isSafeInteger(d.units)||d.units<0||d.units>100000||typeof d.availableAllDay!=="boolean"||!weather(d.weather)||typeof d.occasion!=="boolean")throw Error("Invalid observation");return d as SaleDay});
 if(day(days[days.length-1].day)+DAY!==day(asOf))throw Error("History must end yesterday");
 return {...v,days} as History;
}
const mean=(a:SaleDay[])=>a.reduce((s,x)=>s+x.units,0)/a.length;
function estimate(history:readonly SaleDay[],target:Pick<SaleDay,"day"|"weather"|"occasion">){
 const dow=new Date(target.day).getUTCDay(),prior=history.filter(x=>x.availableAllDay&&x.weather!=="storm"&&day(x.day)<day(target.day)&&new Date(x.day).getUTCDay()===dow).slice(-12);
 const matched=prior.filter(x=>target.weather!=="unknown"&&x.weather===target.weather&&x.occasion===target.occasion);
 return {baseline:prior.length>=4?mean(prior):null,context:matched.length>=3?mean(matched):null,baselineN:prior.length,contextN:matched.length};
}
type ErrorRow={actual:number;predicted:number};
function errors(rows:ErrorRow[]){
 if(!rows.length)return {n:0,mae:null,wape:null,maxError:null};
 const e=rows.map(x=>Math.abs(x.actual-x.predicted)),sum=rows.reduce((s,x)=>s+x.actual,0),total=e.reduce((s,x)=>s+x,0);
 return {n:rows.length,mae:total/rows.length,wape:sum?total/sum:null,maxError:Math.max(...e)};
}
export function forecast(raw:unknown,asOf:string,revision:string,ids:readonly string[],targetWeather:Weather,occasion:boolean){
 const h=decodeHistory(raw,asOf,revision,ids);if(!weather(targetWeather)||typeof occasion!=="boolean")throw Error("Invalid scenario");
 const base:ErrorRow[]=[],matchedBase:ErrorRow[]=[],context:ErrorRow[]=[];
 for(let i=h.days.length-14;i<h.days.length;i++){
  const d=h.days[i];if(!d.availableAllDay||d.weather==="storm")continue;
  const p=estimate(h.days.slice(0,i),d);
  if(p.baseline!==null){base.push({actual:d.units,predicted:p.baseline});if(p.context!==null){matchedBase.push({actual:d.units,predicted:p.baseline});context.push({actual:d.units,predicted:p.context})}}
 }
 const baseline=errors(base),pairedBaseline=errors(matchedBase),contextual=errors(context),next=estimate(h.days,{day:asOf,weather:targetWeather,occasion});
 const eligible=baseline.n>=10&&baseline.wape!==null&&baseline.wape<=.35&&next.baseline!==null;
 const candidateEligible=contextual.n>=10&&contextual.wape!==null&&contextual.wape<=.35&&next.context!==null;
 const status=targetWeather==="storm"?"abstain":!eligible?"insufficient":"review";
 const range=(point:number,error:number):readonly [number,number]=>[Math.max(0,Math.floor(point-error)),Math.ceil(point+error)];
 return {schema:"biteos.robys-forecast.v1",status,productId:h.productId,day:asOf,historyDays:h.days.length,excludedDays:h.days.filter(d=>!d.availableAllDay||d.weather==="storm").length,baseline,pairedBaseline,contextual,baselineSample:next.baselineN,contextSample:next.contextN,baselinePoint:status==="review"?Math.round(next.baseline!):null,contextPoint:status==="review"&&candidateEligible?Math.round(next.context!):null,baselineRange:status==="review"?range(next.baseline!,baseline.maxError!):null,contextRange:status==="review"&&candidateEligible?range(next.context!,contextual.maxError!):null,uncertainty:"historical-max-error-not-probability",sourceIndependentlyVerified:false,demandIdentified:false,causalEffectEstablished:false,procurementAuthorized:false};
}
export function demoHistory(revision:string,productId:string,sparse=false):History{
 const start=Date.parse("2026-09-19");
 return {schema:"biteos.robys-sales-history.v1",tenantId:"robys",source:"operator-reconciled-pos",catalogRevision:revision,productId,weatherBasis:"declared-pre-day-scenario",days:Array.from({length:56},(_,i)=>{const rain=Math.floor(i/7)%2===0;return {day:date(start+i*DAY),units:(rain?24:16)+(i%7),availableAllDay:!sparse||i<42,weather:rain?"rain":"hot",occasion:false}})};
}
