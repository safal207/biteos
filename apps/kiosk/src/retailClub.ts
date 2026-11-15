export type ClubLang="tr"|"ru"|"en";
export type ClubProduct={id:string;name:Record<ClubLang,string>;price:number;stock:number};
export type ClubLine={id:string;quantity:number;previousPrice:number};
export type ClubList=ClubLine[];
export const goals=[
 {id:"breakfast",name:{tr:"Aile kahvaltısı",ru:"Семейный завтрак",en:"Family breakfast"},items:[["eggs",1],["bread",1],["milk",1],["banana",1]]},
 {id:"school",name:{tr:"Okul için",ru:"В школу",en:"School essentials"},items:[["bread",1],["banana",2],["milk",1]]},
 {id:"dinner",name:{tr:"Akşam alışverişi",ru:"К ужину",en:"Dinner essentials"},items:[["dumplings",2],["buckwheat",1]]},
 {id:"week",name:{tr:"Haftalık temel ürünler",ru:"Запас на неделю",en:"Weekly essentials"},items:[["milk",2],["eggs",2],["bread",1],["banana",2],["buckwheat",1]]}
] as const;
export function parseClubList(raw:string|null):ClubList{
 if(!raw)return [];
 try{
  const parsed:unknown=JSON.parse(raw);
  if(!Array.isArray(parsed)||parsed.length>50)return [];
  const seen=new Set<string>();
  const result:ClubList=[];
  for(const x of parsed){
   if(!x||typeof x.id!=="string"||!/^[a-z0-9-]{1,64}$/.test(x.id)||seen.has(x.id)||!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>20||!Number.isSafeInteger(x.previousPrice)||x.previousPrice<1||x.previousPrice>100000000)return [];
   seen.add(x.id);result.push({id:x.id,quantity:x.quantity,previousPrice:x.previousPrice});
  }
  return result;
 }catch{return []}
}
export function snapshotCart(cart:Record<string,number>,products:ClubProduct[]):ClubList{
 return products.filter(p=>Number.isInteger(cart[p.id])&&cart[p.id]>0&&cart[p.id]<=20).map(p=>({id:p.id,quantity:cart[p.id],previousPrice:p.price}));
}
export function goalList(goalId:string,products:ClubProduct[]):ClubList{
 const g=goals.find(g=>g.id===goalId);
 return g?g.items.map(([id,quantity])=>({id,quantity,previousPrice:products.find(p=>p.id===id)?.price??0})):[];
}
export function reviewList(list:ClubList,products:ClubProduct[],budget:number|null){
 const lines=list.map(l=>{
  const p=products.find(p=>p.id===l.id);
  return {...l,product:p,available:Math.max(0,Math.min(20,p?.stock??0)),changed:p!==undefined&&l.previousPrice>0&&p.price!==l.previousPrice};
 });
 const subtotal=lines.reduce((s,l)=>s+(l.product?.price??0)*l.quantity,0);
 const invalid=lines.some(l=>!l.product||l.quantity<1||!Number.isInteger(l.quantity)||l.quantity>l.available);
 const overBudget=budget!==null&&(!Number.isSafeInteger(budget)||budget<0||subtotal>budget);
 return {lines,subtotal,overBudget,canApply:lines.length>0&&!invalid&&!overBudget};
}
export function reviewedCart(list:ClubList,products:ClubProduct[],budget:number|null):Record<string,number>|null{
 if(!reviewList(list,products,budget).canApply)return null;
 return Object.fromEntries(list.map(l=>[l.id,l.quantity]));
}

export type JourneyTime="any"|"morning"|"day"|"evening"|"week";
export type JourneyPlace="any"|"home"|"onway"|"store";
export type JourneyContext={time:JourneyTime;place:JourneyPlace;budget:number|null};
const timeGoals:Record<JourneyTime,readonly string[]>={any:[],morning:["breakfast","school"],day:["school","week"],evening:["dinner","breakfast"],week:["week","breakfast"]};
const placeGoals:Record<JourneyPlace,readonly string[]>={any:[],home:["week","dinner"],onway:["school","dinner"],store:["breakfast","week"]};
// Transparent rules, not predictions. Feasible goals always precede blocked
// goals; then explicit intent governs the order. Never silently omit a SKU.
export function rankJourney(context:JourneyContext,products:ClubProduct[]){
 return goals.map((goal,index)=>{
  const list=goalList(goal.id,products);
  const view=reviewList(list,products,context.budget);
  const timeIndex=timeGoals[context.time].indexOf(goal.id);
  const placeIndex=placeGoals[context.place].indexOf(goal.id);
  const timeMatch=timeIndex>=0;
  const placeMatch=placeIndex>=0;
  const score=(timeMatch?4-timeIndex:0)+(placeMatch?2-placeIndex:0);
  return {goal,list,view,timeMatch,placeMatch,score,index};
 }).sort((a,b)=>Number(b.view.canApply)-Number(a.view.canApply)||b.score-a.score||a.index-b.index);
}
// Explicit context alone suggests a method for consideration, never sets it.
export function journeyHint(place:JourneyPlace):"compare"|"pickup"|"in_store"{
 return place==="onway"?"pickup":place==="store"?"in_store":"compare";
}
