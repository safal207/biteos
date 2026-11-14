// Pure advisory decision layer. Context ranking is supplied by the existing context engine.
type Product={id:string;priceMinor:number};
type MemoryEvent={seq:number;topic:string;value:string;action:string};
type Ranked={productId:string;priceMinor:number;score:number;reasons:readonly string[]};
export function productPreferences(events:readonly MemoryEvent[],ids:readonly string[]){
 const latest=new Map<string,MemoryEvent>();
 for(const e of events)if(e.topic==="product"&&ids.includes(e.value)&&(e.action==="prefer"||e.action==="avoid"))latest.set(e.value,e);
 return {favorites:[...latest.values()].filter(e=>e.action==="prefer").map(e=>e.value),avoided:[...latest.values()].filter(e=>e.action==="avoid").map(e=>e.value),basis:Object.fromEntries([...latest].filter(([,e])=>e.action==="prefer").map(([id,e])=>[id,e.seq])) as Record<string,number>};
}
export function brandDecision(input:{blocked:boolean;budgetMinor:number|null;ranked:readonly Ranked[];catalog:readonly Product[];avoided:readonly string[];unavailable:readonly string[];basis:Readonly<Record<string,number>>}){
 if(input.budgetMinor!==null&&(!Number.isSafeInteger(input.budgetMinor)||input.budgetMinor<0))throw Error("Invalid budget");
 const excluded=new Set([...input.avoided,...input.unavailable]),catalog=new Map(input.catalog.map(p=>[p.id,p]));
 const rows=input.blocked?[]:input.ranked.filter(r=>!excluded.has(r.productId)&&catalog.get(r.productId)?.priceMinor===r.priceMinor&&r.score>0&&(input.budgetMinor===null||r.priceMinor<=input.budgetMinor));
 const winner=rows[0]??null;
 return {schema:"biteos.robys-brand-decision.v1" as const,action:winner?"suggest" as const:"abstain" as const,reason:input.blocked?"context-blocked":winner?"ranked-context":"no-eligible-signal",offer:winner?{productId:winner.productId,priceMinor:winner.priceMinor,reasons:[...winner.reasons],memoryBasis:winner.reasons.includes("favorite")&&Object.hasOwn(input.basis,winner.productId)?input.basis[winner.productId]:null}:null,stockVerified:false,priceChanged:false,pushAuthorized:false,externalEffectsAuthorized:false,causalEffectEstablished:false};
}
