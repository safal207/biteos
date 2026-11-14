type Advisory="REVIEW_OVERLAPPING_WINDOWS"|"COLLECT_MORE_OBSERVATIONS"|"REVIEW_OVERFORECAST_ASSUMPTIONS"|"REVIEW_UNDERFORECAST_ASSUMPTIONS"|"REVIEW_FORECAST_VARIANCE";
type PilotRow={planId:string;startDay:string;endExclusive:string;reason?:string;status:string;forecastSold:number;forecastContribution:number;observation?:{actualSold:number;actualContribution:number}};
type PilotCohort={forecastDigest:string;itemId:string;sampleCount:number;soldWapeBps?:number;advisory:Advisory};
export type PilotStudio={tenantId:string;generatedAt:string;completed:number;pending:number;rows:PilotRow[];cohorts:PilotCohort[]};
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==="object"&&v!==null&&!Array.isArray(v);
const integer=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v);
const count=(v:unknown):v is number=>integer(v)&&v>=0;
const id=(v:unknown):v is string=>typeof v==="string"&&/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(v);
const day=(v:unknown):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v);
const digest=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const advisories:readonly string[]=["REVIEW_OVERLAPPING_WINDOWS","COLLECT_MORE_OBSERVATIONS","REVIEW_OVERFORECAST_ASSUMPTIONS","REVIEW_UNDERFORECAST_ASSUMPTIONS","REVIEW_FORECAST_VARIANCE"];
export function decodePilotStudio(raw:unknown,tenant:string):PilotStudio{
 const bad=()=>new Error("Invalid pilot response");
 if(!isObject(raw)||raw.version!==1||raw.tenantId!==tenant||raw.externalEffectsAuthorized!==false||typeof raw.generatedAt!=="string"||!Number.isFinite(Date.parse(raw.generatedAt))||!isObject(raw.memory)||!isObject(raw.learning))throw bad();
 const m=raw.memory,l=raw.learning;
 if(m.version!==1||l.version!==1||m.tenantId!==tenant||l.tenantId!==tenant||m.currency!=="TRY"||l.currency!=="TRY"||m.demo!==true||l.demo!==true||m.externalEffectsAuthorized!==false||l.externalEffectsAuthorized!==false||l.causalEffectEstablished!==false||!count(l.completed)||!count(l.pending)||!Array.isArray(m.rows)||m.rows.length>64||!Array.isArray(l.cohorts)||l.cohorts.length>64)throw bad();
 const rows:PilotRow[]=[],cohorts:PilotCohort[]=[];
 const seen=new Set<string>();
 for(const r of m.rows){
  if(!isObject(r)||!id(r.planId)||seen.has(r.planId)||!day(r.startDay)||!day(r.endExclusive)||r.endExclusive<=r.startDay||!count(r.forecastSold)||!integer(r.forecastContribution)||r.causalEffectEstablished!==false||typeof r.status!=="string"||!["scheduled","in-window","awaiting-observation","operator-reported-unverified"].includes(r.status)||r.reason!==undefined&&(typeof r.reason!=="string"||!["test-demand","improve-margin","reduce-waste","test-capacity","test-channel"].includes(r.reason)))throw bad();
  seen.add(r.planId);
  let observation:PilotRow["observation"];
  if(r.observation!==undefined){const o=r.observation;if(!isObject(o)||o.tenantId!==tenant||o.causalEffectEstablished!==false||o.externalEffectsAuthorized!==false||!count(o.actualSold)||!integer(o.actualContribution))throw bad();observation={actualSold:o.actualSold,actualContribution:o.actualContribution}}
  if((r.status==="operator-reported-unverified")!==!!observation)throw bad();
  rows.push({planId:r.planId,startDay:r.startDay,endExclusive:r.endExclusive,reason:r.reason as string|undefined,status:r.status,forecastSold:r.forecastSold,forecastContribution:r.forecastContribution,observation});
 }
 const digests=new Set<string>();
 for(const c of l.cohorts){
  if(!isObject(c)||!digest(c.forecastDigest)||digests.has(c.forecastDigest)||!id(c.itemId)||!count(c.sampleCount)||c.sampleCount<1||c.sampleCount>64||typeof c.advisory!=="string"||!advisories.includes(c.advisory)||c.soldWapeBps!==undefined&&!count(c.soldWapeBps)||c.advisory==="REVIEW_OVERLAPPING_WINDOWS"&&c.soldWapeBps!==undefined)throw bad();
  digests.add(c.forecastDigest);cohorts.push({forecastDigest:c.forecastDigest,itemId:c.itemId,sampleCount:c.sampleCount,soldWapeBps:c.soldWapeBps as number|undefined,advisory:c.advisory as Advisory});
 }
 if(rows.filter(r=>r.observation).length!==l.completed||rows.length-l.completed!==l.pending||cohorts.reduce((n,c)=>n+c.sampleCount,0)!==l.completed)throw bad();
 return {tenantId:tenant,generatedAt:raw.generatedAt,completed:l.completed,pending:l.pending,rows,cohorts};
}
