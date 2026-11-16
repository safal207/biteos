// Owner-side offline rehearsal, not a guest runtime or a price authorization.
import {memorySoundsAdvice} from "./robysMemoryAdvice.ts";
import {decodeOperations,operationsPlan} from "./robysOperations.ts";
import {financialReview} from "./robysFinancial.ts";
import {robysCatalog} from "./robysPublicCatalog.ts";
const catalog=robysCatalog.products;
const ids=catalog.map(p=>p.id);
const invalid=()=>new Error("Invalid offer policy");
type Policy={minMarginPct:number;discountPct:number;campaignMinor:number;maxCampaignMinor:number};
function policyOf(raw:unknown):Policy{
 const keys=["minMarginPct","discountPct","campaignMinor","maxCampaignMinor"];
 if(typeof raw!=="object"||raw===null||Array.isArray(raw)||Object.keys(raw).length!==keys.length||!keys.every(k=>Object.hasOwn(raw,k)))throw invalid();
 const r=raw as Record<string,unknown>;
 const bounded=(n:unknown,max:number,min=0)=>typeof n==="number"&&Number.isSafeInteger(n)&&n>=min&&n<=max;
 if(!bounded(r.minMarginPct,100,1)||!bounded(r.discountPct,90)||!bounded(r.campaignMinor,100000000)||!bounded(r.maxCampaignMinor,100000000))throw invalid();
 return r as unknown as Policy;
}
export function livingOffer(request:unknown,readLocal:()=>string|null,now:number,rawPlan:unknown,rawCosts:unknown,rawPolicy:unknown){
 const policy=policyOf(rawPolicy);
 const recommendation=memorySoundsAdvice(request,readLocal,now);
 const flags={actualRevenueVerified:false,netProfitAvailable:false,stockVerified:false,taxVerified:false,ownerApprovalVerified:false,priceChangeAuthorized:false,externalEffectsAuthorized:false,marketingAuthorized:false,productionReady:false};
 const hold=(reason:string)=>({status:"hold" as const,reason,candidate:null,...flags});
 if(!recommendation.offer)return hold("no-eligible-recommendation");
 if(policy.campaignMinor>policy.maxCampaignMinor)return hold("campaign-budget-exceeded");
 if(rawPlan==null||rawCosts==null)return hold("missing-operator-inputs");
 // Derive the current Istanbul calendar day from trusted caller time, not request date.
 if(!Number.isSafeInteger(now)||now<0||now>8640000000000000-10800000)throw invalid();
 const day=new Date(now+10800000).toISOString().slice(0,10);
 if((request as Record<string,unknown>).day!==day)return hold("stale-scenario-day");
 const plan=decodeOperations(rawPlan,day,robysCatalog.sourceRevision,ids);
 const line=plan.lines.find(x=>x.productId===recommendation.offer!.productId);
 if(!line||line.plannedUnits<1)return hold("missing-candidate-recipe-or-plan");
 const operations=operationsPlan(plan,day,robysCatalog.sourceRevision,ids);
 // Preserve the full declared plan and reserves plus one incremental portion.
 // Stock data are declarations only, never a reservation or food-safety proof.
 if(operations.rows.some(row=>row.reserveGap>0))return hold("declared-plan-stock-gap");
 if(line.recipe.some(i=>{
  const row=operations.rows.find(r=>r.ingredientId===i.ingredientId);
  return !row||row.available-row.required-row.reserve<i.quantity;
 }))return hold("insufficient-declared-headroom");
 const finances=financialReview(plan,rawCosts,catalog,policy.discountPct,policy.campaignMinor,policy.minMarginPct);
 const row=finances.rows.find(r=>r.productId===line.productId);
 if(!row||row.marginHold)return hold("margin-floor");
 // Conservative portfolio guard: do not shift losses onto other planned items.
 if(finances.status==="margin-hold")return hold("portfolio-margin-floor");
 if(row.promo.contributionMinor<=0)return hold("nonpositive-contribution");
 const matchingUnits=Math.ceil((row.baseTotal+policy.campaignMinor)/row.promo.contributionMinor);
 // Campaign scenario covers all planned rows; this additional figure is a
 // selected-SKU contribution break-even assuming it bears the whole campaign.
 // It is not a forecast, a demand uplift, or verified inventory capacity.
 return {status:"review-only" as const,reason:"declared-inputs-pass",candidate:{
  productId:line.productId,catalogPriceMinor:row.normal.grossMinor,
  scenarioPriceMinor:row.promo.grossMinor,scenarioContributionMinor:row.promo.contributionMinor,
  minMarginPct:policy.minMarginPct,discountPct:policy.discountPct,
  campaignMinor:policy.campaignMinor,matchingUnits,plannedUnits:line.plannedUnits,
  portfolioScenarioDeltaMinor:finances.deltaMinor,
  source:"operator-declared-scenario" as const},...flags};
}
