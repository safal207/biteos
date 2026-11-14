// Owner-supplied consented, POS-reconciled settled-order snapshots only.
// Local projection. No names, contact data, or cross-link to site sessions.
type Member={memberKey:string;consentFrom:string;activeConsent:true};
type Line={productId:string;quantity:number;netMinor:number};
type Order={orderKey:string;memberKey:string;settledAt:string;netMinor:number;lines:Line[]};
export type LoyaltyInput={schema:"robys.loyalty-input.v1";tenantId:"robys";currency:"TRY";source:"operator-reconciled-pos";completeForConsentingMembers:true;startDay:string;endExclusive:string;members:Member[];orders:Order[]};
export type LoyaltyReport={startDay:string;endExclusive:string;priorMembers:number;activeMembers:number;returningMembers:number;firstSeenInWindow:number;repeatMembers:number;orders:number;netMinor:number;meanCheckMinor:number|null;retention:number|null;repeatRate:number|null;products:{productId:string;buyers:number;repeatBuyers:number;threeDayBuyers:number;units:number}[];hours:{hour:number;orders:number}[];suppressedProducts:number;actualRevenueVerified:false;causalEffectEstablished:false};
const DAY=86400000,OFFSET=10800000,MIN_COHORT=5;
const obj=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const exact=(v:unknown,keys:string[])=>obj(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const count=(v:unknown,max:number):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<=max;
const key=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{32}$/.test(v);
const stamp=(v:unknown):v is string=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const boundary=(v:unknown)=>{if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error("Invalid day");return Date.parse(v)-OFFSET};
const fail=()=>new Error("Invalid loyalty snapshot");
function decode(raw:unknown,ids:readonly string[]):LoyaltyInput{
 if(!exact(raw,["schema","tenantId","currency","source","completeForConsentingMembers","startDay","endExclusive","members","orders"])||!obj(raw)||raw.schema!=="robys.loyalty-input.v1"||raw.tenantId!=="robys"||raw.currency!=="TRY"||raw.source!=="operator-reconciled-pos"||raw.completeForConsentingMembers!==true||!Array.isArray(raw.members)||raw.members.length>10000||!Array.isArray(raw.orders)||raw.orders.length>20000)throw fail();
 const start=boundary(raw.startDay),end=boundary(raw.endExclusive);if(end-start!==14*DAY)throw fail();
 const members=new Map<string,Member>(),orders=new Set<string>(),catalog=new Set(ids);
 for(const m of raw.members){if(!exact(m,["memberKey","consentFrom","activeConsent"])||!obj(m)||!key(m.memberKey)||!stamp(m.consentFrom)||m.activeConsent!==true||members.has(m.memberKey))throw fail();members.set(m.memberKey,m as Member)}
 for(const o of raw.orders){if(!exact(o,["orderKey","memberKey","settledAt","netMinor","lines"])||!obj(o)||!key(o.orderKey)||orders.has(o.orderKey)||!key(o.memberKey)||!stamp(o.settledAt)||!count(o.netMinor,10000000)||o.netMinor===0||!Array.isArray(o.lines)||o.lines.length<1||o.lines.length>100)throw fail();
  const m=members.get(o.memberKey),at=Date.parse(o.settledAt);if(!m||at<Date.parse(m.consentFrom)||at<start-14*DAY||at>=end)throw fail();
  orders.add(o.orderKey);let total=0;const products=new Set<string>();
  for(const l of o.lines){if(!exact(l,["productId","quantity","netMinor"])||!obj(l)||typeof l.productId!=="string"||!catalog.has(l.productId)||products.has(l.productId)||!count(l.quantity,100)||l.quantity===0||!count(l.netMinor,10000000))throw fail();products.add(l.productId);total+=l.netMinor}
  if(total!==o.netMinor)throw fail();
 }
 return raw as unknown as LoyaltyInput;
}
export function projectLoyalty(raw:unknown,ids:readonly string[],asOf:string):LoyaltyReport{
 const x=decode(raw,ids),start=boundary(x.startDay),end=boundary(x.endExclusive);if(boundary(asOf)<end)throw fail();
 const prior=new Set<string>(),active=new Map<string,number>(),products=new Map<string,{buyers:Map<string,{orders:number;days:Set<string>}>;units:number}>(),hours=Array.from({length:24},(_,hour)=>({hour,orders:0}));
 let orders=0,net=0;
 for(const o of x.orders){
  const at=Date.parse(o.settledAt);if(at<start){prior.add(o.memberKey);continue}
  active.set(o.memberKey,(active.get(o.memberKey)??0)+1);orders++;net+=o.netMinor;
  const local=new Date(at+OFFSET),day=local.toISOString().slice(0,10);hours[local.getUTCHours()].orders++;
  for(const l of o.lines){
   const p=products.get(l.productId)??{buyers:new Map(),units:0},b=p.buyers.get(o.memberKey)??{orders:0,days:new Set()};
   b.orders++;b.days.add(day);p.buyers.set(o.memberKey,b);p.units+=l.quantity;products.set(l.productId,p);
  }
 }
 // Small overall cohorts not displayed. Product-level small cohorts suppressed.
 if(active.size<MIN_COHORT||prior.size<MIN_COHORT)throw Error("Insufficient cohort");
 const returning=[...active.keys()].filter(k=>prior.has(k)).length,repeat=[...active.values()].filter(n=>n>=2).length;
 const rows=[...products].filter(([,p])=>p.buyers.size>=MIN_COHORT).map(([productId,p])=>({productId,buyers:p.buyers.size,repeatBuyers:[...p.buyers.values()].filter(b=>b.orders>=2).length,threeDayBuyers:[...p.buyers.values()].filter(b=>b.days.size>=3).length,units:p.units})).sort((a,b)=>b.repeatBuyers-a.repeatBuyers||b.buyers-a.buyers||a.productId.localeCompare(b.productId));
 return {startDay:x.startDay,endExclusive:x.endExclusive,priorMembers:prior.size,activeMembers:active.size,returningMembers:returning,firstSeenInWindow:active.size-returning,repeatMembers:repeat,orders,netMinor:net,meanCheckMinor:orders?Math.round(net/orders):null,retention:returning/prior.size,repeatRate:repeat/active.size,products:rows,hours,suppressedProducts:products.size-rows.length,actualRevenueVerified:false,causalEffectEstablished:false};
}
// Synthetic order values, not observed revenue. Current menu IDs.
export function demoLoyalty():LoyaltyInput{
 const members=Array.from({length:10},(_,i)=>({memberKey:(i+1).toString(16).padStart(32,"0"),consentFrom:"2026-10-01T00:00:00.000Z",activeConsent:true as const}));
 const orders:Order[]=[];let seq=0;
 const add=(i:number,day:string,productId:string,netMinor:number)=>{
  orders.push({orderKey:(++seq).toString(16).padStart(32,"0"),memberKey:members[i].memberKey,settledAt:day+"T09:00:00.000Z",netMinor,lines:[{productId,quantity:1,netMinor}]});
 };
 for(let i=0;i<8;i++)add(i,"2026-10-22","hot-coffee:caffe-latte",18000);
 for(let i=2;i<10;i++){add(i,"2026-11-02","hot-coffee:caffe-latte",18000);if(i<8)add(i,"2026-11-05","hot-coffee:caffe-latte",18000);if(i<6)add(i,"2026-11-09","hot-coffee:caffe-latte",18000);if(i<7)add(i,"2026-11-10","desserts:san-sebastian-cheesecake",19000)}
 return {schema:"robys.loyalty-input.v1",tenantId:"robys",currency:"TRY",source:"operator-reconciled-pos",completeForConsentingMembers:true,startDay:"2026-11-01",endExclusive:"2026-11-15",members,orders};
}
