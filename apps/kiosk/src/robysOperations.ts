// Shared-ingredient planning for an explicit subset of the menu. No stock mutation.
type Unit="g"|"ml"|"piece";
type Ingredient={id:string;unit:Unit;reserve:number;packQuantity:number};
type Lot={id:string;ingredientId:string;quantity:number;useBy:string|null;released:boolean};
type Line={productId:string;plannedUnits:number;recipe:{ingredientId:string;quantity:number}[]};
export type Snapshot={schema:"biteos.robys-ingredient-plan.v1";tenantId:"robys";catalogRevision:string;day:string;source:"operator-declared-plan";ingredients:Ingredient[];lots:Lot[];lines:Line[]};
const DAY=86400000;
const exact=(v:unknown,k:string[]):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const int=(v:unknown,max:number,min=0):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const id=(v:unknown):v is string=>typeof v==="string"&&/^[a-z0-9-]{1,48}$/.test(v);
function date(v:unknown){if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error("Invalid date");return Date.parse(v)}
export function decodeOperations(v:unknown,day:string,revision:string,productIds:readonly string[]):Snapshot{
 date(day);
 if(!exact(v,["schema","tenantId","catalogRevision","day","source","ingredients","lots","lines"])||v.schema!=="biteos.robys-ingredient-plan.v1"||v.tenantId!=="robys"||v.catalogRevision!==revision||v.day!==day||v.source!=="operator-declared-plan"||!Array.isArray(v.ingredients)||v.ingredients.length<1||v.ingredients.length>200||!Array.isArray(v.lots)||v.lots.length>1000||!Array.isArray(v.lines)||v.lines.length<1||v.lines.length>100)throw Error("Invalid plan");
 const ingredients=new Set<string>(),lots=new Set<string>(),products=new Set<string>();
 for(const x of v.ingredients){if(!exact(x,["id","unit","reserve","packQuantity"])||!id(x.id)||ingredients.has(x.id)||!["g","ml","piece"].includes(String(x.unit))||!int(x.reserve,10000000)||!int(x.packQuantity,1000000,1))throw Error("Invalid ingredient");ingredients.add(x.id)}
 for(const x of v.lots){if(!exact(x,["id","ingredientId","quantity","useBy","released"])||!id(x.id)||lots.has(x.id)||typeof x.ingredientId!=="string"||!ingredients.has(x.ingredientId)||!int(x.quantity,10000000)||typeof x.released!=="boolean")throw Error("Invalid lot");if(x.useBy!==null)date(x.useBy);lots.add(x.id)}
 for(const x of v.lines){if(!exact(x,["productId","plannedUnits","recipe"])||typeof x.productId!=="string"||!productIds.includes(x.productId)||products.has(x.productId)||!int(x.plannedUnits,10000)||!Array.isArray(x.recipe)||x.recipe.length<1||x.recipe.length>50)throw Error("Invalid recipe");products.add(x.productId);const used=new Set<string>();for(const p of x.recipe){if(!exact(p,["ingredientId","quantity"])||typeof p.ingredientId!=="string"||!ingredients.has(p.ingredientId)||used.has(p.ingredientId)||!int(p.quantity,100000,1))throw Error("Invalid component");used.add(p.ingredientId)}}
 return v as Snapshot;
}
export function operationsPlan(raw:unknown,day:string,revision:string,ids:readonly string[]){
 const input=decodeOperations(raw,day,revision,ids),today=date(day);
 const rows=input.ingredients.map(i=>{
  const components=input.lines.flatMap(p=>p.recipe.filter(c=>c.ingredientId===i.id).map(c=>({productId:p.productId,plannedUnits:p.plannedUnits,required:p.plannedUnits*c.quantity})));
  const required=components.reduce((n,c)=>n+c.required,0);
  const all=input.lots.filter(l=>l.ingredientId===i.id);
  // A physical/use-by release is declared, not verified. Same-date use-by excluded conservatively.
  const usable=all.filter(l=>l.released&&l.useBy!==null&&date(l.useBy)>today).sort((a,b)=>a.useBy!.localeCompare(b.useBy!)||a.id.localeCompare(b.id));
  const available=usable.reduce((n,l)=>n+l.quantity,0),held=all.reduce((n,l)=>n+l.quantity,0)-available;
  let remaining=required;const allocation=usable.flatMap(l=>{const quantity=Math.min(remaining,l.quantity);remaining-=quantity;return quantity?[{lotId:l.id,quantity}]:[]});
  const gap=Math.max(0,required-available),reserveGap=Math.max(0,required+i.reserve-available);
  const nearDateRemaining=usable.filter(l=>date(l.useBy!)<=today+2*DAY).reduce((n,l)=>n+l.quantity-(allocation.find(a=>a.lotId===l.id)?.quantity??0),0);
  return {ingredientId:i.id,unit:i.unit,required,available,held,gap,reserve:i.reserve,reserveGap,packReview:Math.ceil(reserveGap/i.packQuantity),packQuantity:i.packQuantity,nearDateRemaining,components,allocation};
 });
 return {schema:"biteos.robys-ingredient-review.v1",day,rows,plannedProducts:input.lines.length,recipeVerified:false,physicalStockVerified:false,fullMenuCoverage:false,foodSafetyVerified:false,purchaseAuthorized:false,stockMutationAuthorized:false};
}
export function demoOperations(revision:string,latteUnits:number,scenario="normal"):Snapshot{
 return {schema:"biteos.robys-ingredient-plan.v1",tenantId:"robys",catalogRevision:revision,day:"2026-11-14",source:"operator-declared-plan",ingredients:[{id:"espresso",unit:"g",reserve:180,packQuantity:1000},{id:"milk",unit:"ml",reserve:1000,packQuantity:1000}],lots:[{id:"beans-1",ingredientId:"espresso",quantity:1800,useBy:"2026-12-01",released:true},{id:"milk-1",ingredientId:"milk",quantity:scenario==="short"?1000:5000,useBy:"2026-11-15",released:true},{id:"milk-2",ingredientId:"milk",quantity:5000,useBy:scenario==="hold"?"2026-11-14":"2026-11-19",released:true}],lines:[{productId:"hot-coffee:caffe-latte",plannedUnits:latteUnits,recipe:[{ingredientId:"espresso",quantity:18},{ingredientId:"milk",quantity:200}]},{productId:"hot-coffee:flat-white",plannedUnits:20,recipe:[{ingredientId:"espresso",quantity:18},{ingredientId:"milk",quantity:150}]}]};
}
