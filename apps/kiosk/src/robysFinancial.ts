import type {Snapshot} from "./robysOperations";
type Product={id:string;priceMinor:number;currency:string};
type IngredientCost={ingredientId:string;unit:"g"|"ml"|"piece";packQuantity:number;packCostMinor:number;yieldBps:number};
type ProductCost={productId:string;otherVariableMinor:number;taxBps:number;feeBps:number};
export type CostSheet={schema:"biteos.robys-unit-costs.v1";tenantId:"robys";catalogRevision:string;day:string;currency:"TRY";source:"operator-declared-costs";ingredients:IngredientCost[];products:ProductCost[]};
const exact=(v:unknown,k:string[]):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const int=(x:unknown,max:number,min=0):x is number=>typeof x==="number"&&Number.isSafeInteger(x)&&x>=min&&x<=max;
export function decodeCosts(raw:unknown,plan:Snapshot):CostSheet{
 if(!exact(raw,["schema","tenantId","catalogRevision","day","currency","source","ingredients","products"])||raw.schema!=="biteos.robys-unit-costs.v1"||raw.tenantId!=="robys"||raw.catalogRevision!==plan.catalogRevision||raw.day!==plan.day||raw.currency!=="TRY"||raw.source!=="operator-declared-costs"||!Array.isArray(raw.ingredients)||!Array.isArray(raw.products))throw Error("Invalid costs");
 const required=new Set(plan.lines.flatMap(p=>p.recipe.map(c=>c.ingredientId))),seen=new Set<string>(),products=new Set(plan.lines.map(p=>p.productId));
 if(raw.ingredients.length!==required.size||raw.products.length!==products.size)throw Error("Incomplete costs");
 for(const x of raw.ingredients){
  if(!exact(x,["ingredientId","unit","packQuantity","packCostMinor","yieldBps"])||typeof x.ingredientId!=="string"||!required.has(x.ingredientId)||seen.has(x.ingredientId)||x.unit!==plan.ingredients.find(i=>i.id===x.ingredientId)?.unit||!int(x.packQuantity,1000000,1)||!int(x.packCostMinor,100000000,1)||!int(x.yieldBps,10000,1000))throw Error("Invalid ingredient cost");
  seen.add(x.ingredientId);
 }
 for(const x of raw.products){
  if(!exact(x,["productId","otherVariableMinor","taxBps","feeBps"])||typeof x.productId!=="string"||!products.delete(x.productId)||!int(x.otherVariableMinor,10000000)||!int(x.taxBps,10000)||!int(x.feeBps,10000))throw Error("Invalid product costs");
 }
 return raw as CostSheet;
}
const safe=(x:number)=>{if(!Number.isSafeInteger(x))throw Error("Unsafe monetary result");return x};
function perIngredient(quantity:number,c:IngredientCost){
 // Exact integer rounding on rational quantities; conservative ceiling per component.
 const n=BigInt(quantity)*BigInt(c.packCostMinor)*10000n,d=BigInt(c.packQuantity)*BigInt(c.yieldBps);
 return safe(Number((n+d-1n)/d));
}
export function financialReview(plan:Snapshot,raw:unknown,catalog:readonly Product[],discountPct:number,campaignMinor:number,minMarginPct=20){
 if(!int(discountPct,90)||!int(campaignMinor,100000000)||!int(minMarginPct,100))throw Error("Invalid scenario");
 const costs=decodeCosts(raw,plan),items=new Map(catalog.map(p=>[p.id,p]));
 const rows=plan.lines.map(p=>{
  const item=items.get(p.productId),c=costs.products.find(x=>x.productId===p.productId)!;
  if(!item||item.currency!=="TRY"||!int(item.priceMinor,10000000,1))throw Error("Catalog price missing");
  const ingredientLines=p.recipe.map(k=>({ingredientId:k.ingredientId,costMinor:perIngredient(k.quantity,costs.ingredients.find(x=>x.ingredientId===k.ingredientId)!)}));
  const direct=safe(ingredientLines.reduce((s,x)=>s+x.costMinor,0));
  const quote=(d:number)=>{
   const gross=Math.floor(item.priceMinor*(100-d)/100);
   const net=Math.floor(gross*10000/(10000+c.taxBps)),fee=Math.ceil(gross*c.feeBps/10000);
   const variable=safe(direct+c.otherVariableMinor+fee),contribution=safe(net-variable);
   return {grossMinor:gross,netMinor:net,feeMinor:fee,variableMinor:variable,contributionMinor:contribution,margin:net>0?contribution/net:null};
  };
  const normal=quote(0),promo=quote(discountPct);
  const eligible=(q:ReturnType<typeof quote>)=>q.contributionMinor>0&&q.netMinor>0&&BigInt(q.contributionMinor)*100n>=BigInt(q.netMinor)*BigInt(minMarginPct);
  let maxDiscountPct:number|null=null;for(let d=0;d<=90;d++)if(eligible(quote(d)))maxDiscountPct=d;
  const baseTotal=safe(normal.contributionMinor*p.plannedUnits),promoTotal=safe(promo.contributionMinor*p.plannedUnits);
  const matchingUnits=promo.contributionMinor>0&&baseTotal>=0?Math.ceil(baseTotal/promo.contributionMinor):null;
  return {productId:p.productId,plannedUnits:p.plannedUnits,ingredientLines,ingredientCostMinor:direct,otherVariableMinor:c.otherVariableMinor,normal,promo,maxDiscountPct,matchingUnits,baseTotal,promoTotal,marginHold:!eligible(promo)};
 });
 const baselineContributionMinor=safe(rows.reduce((s,x)=>s+x.baseTotal,0)),scenarioContributionMinor=safe(rows.reduce((s,x)=>s+x.promoTotal,0)-campaignMinor);
 return {schema:"biteos.robys-financial-review.v1",day:plan.day,rows,baselineContributionMinor,scenarioContributionMinor,deltaMinor:safe(scenarioContributionMinor-baselineContributionMinor),status:rows.some(x=>x.marginHold)?"margin-hold":"review",minMarginPct,discountPct,campaignMinor,fullMenuCoverage:plan.lines.length===catalog.length,actualRevenueVerified:false,netProfitAvailable:false,taxVerified:false,stockFeasibilityVerified:false,priceChangeAuthorized:false,externalEffectsAuthorized:false};
}
export function demoCosts(plan:Snapshot):CostSheet{
 return {schema:"biteos.robys-unit-costs.v1",tenantId:"robys",catalogRevision:plan.catalogRevision,day:plan.day,currency:"TRY",source:"operator-declared-costs",ingredients:[{ingredientId:"espresso",unit:"g",packQuantity:1000,packCostMinor:100000,yieldBps:10000},{ingredientId:"milk",unit:"ml",packQuantity:1000,packCostMinor:7000,yieldBps:10000}],products:plan.lines.map(p=>({productId:p.productId,otherVariableMinor:500,taxBps:0,feeBps:200}))};
}
