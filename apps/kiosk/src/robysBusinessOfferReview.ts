// Private, operator-side review. No guest identity or memory is accepted.
import {businessReview} from "./robysBusinessBrain.ts";
import {reviewOfferCandidate} from "./robysLivingOffers.ts";
import {robysCatalog} from "./robysPublicCatalog.ts";
const catalog=robysCatalog.products,revision=robysCatalog.sourceRevision;
const invalid=()=>new Error("Invalid business offer input");
const exact=(x:unknown,k:string[]):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).length===k.length&&k.every(v=>Object.hasOwn(x,v));
const int=(x:unknown,max:number,min=0):x is number=>typeof x==="number"&&Number.isSafeInteger(x)&&x>=min&&x<=max;
export function businessOfferReview(raw:unknown,now:number){
 if(!int(now,8640000000000000-10800000)||!exact(raw,["schema","productId","business","minMarginPct","maxCampaignMinor"])||
 raw.schema!=="robys.business-offer-input.v1"||typeof raw.productId!=="string"||!catalog.some(p=>p.id===raw.productId)||
 !int(raw.minMarginPct,100,20)||!int(raw.maxCampaignMinor,100000000))throw invalid();
 const day=new Date(now+10800000).toISOString().slice(0,10);
 const brain=businessReview(raw.business,day,revision,catalog);
 const flags={sourceIndependentlyVerified:false,rolloutAuthorized:false,priceChangeAuthorized:false,externalEffectsAuthorized:false,marketingAuthorized:false,guestMemoryRead:false,actualRevenueVerified:false,netProfitAvailable:false,causalEffectEstablished:false};
 const summary={schema:"biteos.robys-business-offer-review.v1" as const,day,productId:raw.productId,coverage:brain.coverage,tasks:brain.tasks.map(t=>({code:t.code,severity:t.severity,source:t.source}))};
 // Existing business holds and missing evidence outrank promotional review.
 if(brain.state!=="review-only")return {...summary,state:brain.state,candidate:null,reason:"business-gate",...flags};
 const bundle=raw.business as Record<string,unknown>;
 // Recompute from the same raw bundle; never trust supplied dashboard totals.
 const offer=reviewOfferCandidate(raw.productId,day,now,bundle.plan,bundle.costs,{
  minMarginPct:raw.minMarginPct,maxCampaignMinor:raw.maxCampaignMinor,
  discountPct:bundle.discountPct,campaignMinor:bundle.campaignMinor});
 return {...summary,state:offer.status,candidate:offer.candidate,reason:offer.reason,...flags};
}
