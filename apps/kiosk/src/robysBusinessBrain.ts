import {forecast,demoHistory} from "./robysForecast.ts";
import {operationsPlan,decodeOperations,demoOperations} from "./robysOperations.ts";
import {financialReview,demoCosts} from "./robysFinancial.ts";
import {evaluateExperiment,demoExperiment} from "./robysExperiment.ts";
import {pilotReport,demoPilot} from "./robysPilot.ts";
type Product={id:string;priceMinor:number;currency:string};
type Source="forecast"|"operations"|"financial"|"experiment"|"pilot";
type Task={code:string;severity:"hold"|"collect"|"review";source:Source;detail:string};
const sourceOrder:Source[]=["experiment","operations","financial","forecast","pilot"];
const exact=(v:unknown,k:string[]):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const day=(v:unknown)=>{if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error("Invalid day");return Date.parse(v)};
export function businessReview(raw:unknown,asOf:string,revision:string,catalog:readonly Product[]){
 day(asOf);
 if(!exact(raw,["schema","tenantId","catalogRevision","day","history","weather","occasion","plan","costs","discountPct","campaignMinor","experiment","pilot"])||raw.schema!=="biteos.robys-business-input.v1"||raw.tenantId!=="robys"||raw.catalogRevision!==revision||raw.day!==asOf||!["unknown","mild","hot","cold","rain","wind","storm"].includes(String(raw.weather))||typeof raw.weather!=="string"||typeof raw.occasion!=="boolean"||typeof raw.discountPct!=="number"||!Number.isSafeInteger(raw.discountPct)||raw.discountPct<0||raw.discountPct>90||typeof raw.campaignMinor!=="number"||!Number.isSafeInteger(raw.campaignMinor)||raw.campaignMinor<0||raw.campaignMinor>100000000)throw Error("Invalid business bundle");
 const ids=catalog.map(p=>p.id),tasks:Task[]=[],coverage:Record<Source,"missing"|"invalid"|"declared">={forecast:"missing",operations:"missing",financial:"missing",experiment:"missing",pilot:"missing"};
 const add=(code:string,severity:Task["severity"],source:Source,detail="")=>tasks.push({code,severity,source,detail});
 const run=<T,>(source:Source,present:boolean,fn:()=>T):T|null=>{
  if(!present){add("missing-"+source,"collect",source);return null}
  try{const result=fn();coverage[source]="declared";return result}catch{coverage[source]="invalid";add("invalid-"+source,"collect",source);return null}
 };
 const fc=run("forecast",raw.history!==null,()=>forecast(raw.history,asOf,revision,ids,raw.weather as Parameters<typeof forecast>[4],raw.occasion as boolean));
 const ops=run("operations",raw.plan!==null,()=>operationsPlan(raw.plan,asOf,revision,ids));
 const fin=run("financial",raw.costs!==null,()=>{if(!ops)throw Error("Operations basis missing");return financialReview(decodeOperations(raw.plan,asOf,revision,ids),raw.costs,catalog,raw.discountPct as number,raw.campaignMinor as number)});
 const exp=run("experiment",raw.experiment!==null,()=>evaluateExperiment(raw.experiment,asOf,revision));
 const pilot=run("pilot",raw.pilot!==null,()=>{const p=pilotReport(raw.pilot,asOf,revision);if(day(asOf)-day(p.after.endExclusive)>30*86400000)throw Error("Stale pilot");return p});
 if(exp){if(exp.status==="guardrail")add("experiment-guardrail","hold","experiment");else if(exp.status==="allocation-mismatch")add("experiment-allocation","hold","experiment");else if(exp.status!=="review-positive"&&exp.status!=="review-negative")add("experiment-inconclusive","collect","experiment",exp.status);else add("experiment-review","review","experiment",exp.status)}
 if(ops){const shortages=ops.rows.filter(x=>x.gap>0),held=ops.rows.filter(x=>x.held>0),reserves=ops.rows.filter(x=>x.reserveGap>0&&x.gap===0),near=ops.rows.filter(x=>x.nearDateRemaining>0);
  if(shortages.length)add("stock-shortage","hold","operations",shortages.map(x=>x.ingredientId+":"+x.gap+" "+x.unit).join(" · "));
  if(held.length)add("stock-hold","hold","operations",held.map(x=>x.ingredientId+":"+x.held+" "+x.unit).join(" · "));
  if(reserves.length)add("stock-reserve","review","operations",reserves.map(x=>x.ingredientId).join(" · "));
  if(near.length)add("stock-near-date","review","operations",near.map(x=>x.ingredientId).join(" · "));
 }
 if(fin){if(fin.status==="margin-hold")add("margin-hold","hold","financial",fin.rows.filter(x=>x.marginHold).map(x=>x.productId).join(" · "));if(fin.deltaMinor<0)add("scenario-loss","review","financial",String(fin.deltaMinor));}
 if(fc){if(fc.status==="abstain")add("forecast-abstain","hold","forecast");else if(fc.status!=="review")add("forecast-weak","collect","forecast");else if(ops){const plan=decodeOperations(raw.plan,asOf,revision,ids),line=plan.lines.find(x=>x.productId===fc.productId);if(!line||line.plannedUnits!==fc.baselinePoint)add("forecast-plan-mismatch","review","forecast",fc.productId);}}
 if(pilot&&pilot.deltaContributionMinor<0)add("pilot-decline","review","pilot",String(pilot.deltaContributionMinor));
 // Explicit, deterministic priorities. Missing/invalid source blocks review-ready state.
 const rank={hold:0,collect:1,review:2};
 tasks.sort((a,b)=>rank[a.severity]-rank[b.severity]||sourceOrder.indexOf(a.source)-sourceOrder.indexOf(b.source)||a.code.localeCompare(b.code));
 const state=tasks.some(t=>t.severity==="hold")?"hold":tasks.some(t=>t.severity==="collect")?"collect-evidence":"review-only";
 return {schema:"biteos.robys-business-review.v1",day:asOf,state,coverage,tasks,forecast:fc?{productId:fc.productId,units:fc.baselinePoint,wape:fc.baseline.wape}:null,operations:ops?{plannedProducts:ops.plannedProducts,shortages:ops.rows.filter(x=>x.gap>0).length}:null,financial:fin?{contributionMinor:fin.scenarioContributionMinor,deltaMinor:fin.deltaMinor}:null,experiment:exp?{status:exp.status,delta:exp.delta}:null,pilot:pilot?{deltaContributionMinor:pilot.deltaContributionMinor}:null,sourceIndependentlyVerified:false,causalEffectEstablished:false,netProfitAvailable:false,externalEffectsAuthorized:false,rolloutAuthorized:false};
}
export function demoBusiness(revision:string,scenario="normal"){
 const product="hot-coffee:caffe-latte",asOf="2026-11-14",compound=scenario==="compound",missing=scenario==="missing",plan=demoOperations(revision,20,compound?"hold":"normal");
 return {schema:"biteos.robys-business-input.v1",tenantId:"robys",catalogRevision:revision,day:asOf,history:missing?null:demoHistory(revision,product),weather:"rain",occasion:false,plan:missing?null:plan,costs:missing?null:demoCosts(plan),discountPct:compound?90:0,campaignMinor:0,experiment:missing?null:demoExperiment(revision,compound?"harm":"positive"),pilot:missing?null:demoPilot()};
}
