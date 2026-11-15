export type ProductMetric={productId:string;viewSessions:number;likeSessions:number;unlikeSessions:number;shareIntentSessions:number;shareCompletedSessions:number;cartAddSessions:number};
export type Rank="viewSessions"|"likeSessions"|"shareCompletedSessions"|"cartAddSessions";
export type Engagement={sessions:number;averageObservedSpanMs:number|null;channels:{source:string;campaign:string|null;sessions:number;handoffSessions:number;routeSessions:number}[];products:ProductMetric[];hours:{hour:number;sessions:number}[];areaClicks:Record<string,number>};
export type Counter={startDay:string;endExclusive:string;createdOrders:number;createdCohortAwaitingAtClose:number;paymentAcknowledgements:number;acknowledgedOrderValueMinor:number;issuedOrders:number;paidToReadySample:number;averagePaidToReadyMs:number|null};
const obj=(v:unknown):v is Record<string,unknown>=>typeof v==="object"&&v!==null&&!Array.isArray(v);
const count=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const bounded=(v:unknown,n:number):v is number=>count(v)&&v<=n;
const sources=["instagram","whatsapp","telegram","google_maps","google","table_qr","window_qr","partner","shared_product","unknown","other_referral"];
const campaigns=["menu","profile","story","post","table","window","product_share","pilot"];
const areas=["hero","menu","product_card","favorite","cart","share","visit","smart_choice"];
const fields=["viewSessions","likeSessions","unlikeSessions","shareIntentSessions","shareCompletedSessions","cartAddSessions"] as const;
const invalid=()=>new Error("Invalid growth report");
export function decodeEngagement(v:unknown):Engagement{
 if(!obj(v)||v.schema!=="biteos.robys-engagement-aggregate.v1"||v.tenantId!=="robys"||v.timeZone!=="UTC+03:00"||v.evidenceStatus!=="opt-in-client-events-unverified"||v.actualRevenueVerified!==false||v.uniquePeopleVerified!==false||v.causalEffectEstablished!==false||!bounded(v.sessions,100000)||v.averageObservedSpanMs!==null&&!count(v.averageObservedSpanMs)||!Array.isArray(v.channels)||v.channels.length>100||!Array.isArray(v.products)||v.products.length>500||!Array.isArray(v.hours)||v.hours.length!==24||!obj(v.areaClicks))throw invalid();
 const sessions=v.sessions;
 const channels:Engagement["channels"]=[],products:ProductMetric[]=[],hours:Engagement["hours"]=[],areaClicks:Record<string,number>={};
 const ck=new Set<string>(),pk=new Set<string>();
 for(const c of v.channels){
  if(!obj(c)||typeof c.source!=="string"||!sources.includes(c.source)||c.campaign!==null&&(typeof c.campaign!=="string"||!campaigns.includes(c.campaign))||!bounded(c.sessions,sessions)||c.sessions===0||!bounded(c.handoffSessions,c.sessions)||!bounded(c.routeSessions,c.sessions))throw invalid();
  const key=c.source+"|"+c.campaign;if(ck.has(key))throw invalid();ck.add(key);
  channels.push({source:c.source,campaign:c.campaign as string|null,sessions:c.sessions,handoffSessions:c.handoffSessions,routeSessions:c.routeSessions});
 }
 for(const p of v.products){
  if(!obj(p)||typeof p.productId!=="string"||p.productId.length>100||!/^[a-z0-9-]+:[a-z0-9-]+$/.test(p.productId)||pk.has(p.productId)||!fields.every(k=>bounded(p[k],sessions)))throw invalid();
  pk.add(p.productId);products.push({productId:p.productId,...Object.fromEntries(fields.map(k=>[k,p[k]]))} as ProductMetric);
 }
 for(const [i,h] of v.hours.entries()){if(!obj(h)||h.hour!==i||!bounded(h.sessions,sessions))throw invalid();hours.push({hour:i,sessions:h.sessions})}
 for(const [k,n] of Object.entries(v.areaClicks)){if(!areas.includes(k)||!bounded(n,100000))throw invalid();areaClicks[k]=n}
 if(channels.reduce((s,c)=>s+c.sessions,0)!==sessions||hours.reduce((s,h)=>s+h.sessions,0)!==sessions||sessions===0&&v.averageObservedSpanMs!==null||sessions>0&&v.averageObservedSpanMs===null)throw invalid();
 return {sessions,averageObservedSpanMs:v.averageObservedSpanMs as number|null,channels,products,hours,areaClicks};
}
const day=(s:unknown):s is string=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
export function decodeCounter(v:unknown):Counter{
 if(!obj(v)||v.schema!=="biteos.robys-counter-aggregate.v1"||v.tenantId!=="robys"||v.currency!=="TRY"||v.timeZone!=="UTC+03:00"||v.sourceRepository!=="safal207/robys-coffee-house-demo"||v.evidenceStatus!=="local-counter-staff-acknowledgement-not-pos-reconciled"||v.actualRevenueVerified!==false||v.profitAvailable!==false||v.causalEffectEstablished!==false||v.externalEffectsAuthorized!==false||!day(v.startDay)||!day(v.endExclusive)||v.endExclusive<=v.startDay||Date.parse(v.endExclusive)-Date.parse(v.startDay)>31*86400000||!count(v.createdOrders)||!bounded(v.createdCohortAwaitingAtClose,v.createdOrders)||!count(v.paymentAcknowledgements)||!count(v.acknowledgedOrderValueMinor)||!count(v.issuedOrders)||!bounded(v.paidToReadySample,v.paymentAcknowledgements)||v.averagePaidToReadyMs!==null&&!count(v.averagePaidToReadyMs)||v.paidToReadySample===0&&v.averagePaidToReadyMs!==null||v.paidToReadySample>0&&v.averagePaidToReadyMs===null)throw invalid();
 return {startDay:v.startDay,endExclusive:v.endExclusive,createdOrders:v.createdOrders,createdCohortAwaitingAtClose:v.createdCohortAwaitingAtClose,paymentAcknowledgements:v.paymentAcknowledgements,acknowledgedOrderValueMinor:v.acknowledgedOrderValueMinor,issuedOrders:v.issuedOrders,paidToReadySample:v.paidToReadySample,averagePaidToReadyMs:v.averagePaidToReadyMs as number|null};
}
export function rankProducts(rows:ProductMetric[],rank:Rank){return [...rows].sort((a,b)=>b[rank]-a[rank]||a.productId.localeCompare(b.productId))}
export const demoEngagement:Engagement={sessions:120,averageObservedSpanMs:96000,channels:[{source:"instagram",campaign:"story",sessions:60,handoffSessions:9,routeSessions:8},{source:"table_qr",campaign:"table",sessions:40,handoffSessions:12,routeSessions:0},{source:"unknown",campaign:null,sessions:20,handoffSessions:2,routeSessions:3}],products:[{productId:"hot-coffee:caffe-latte",viewSessions:65,likeSessions:20,unlikeSessions:1,shareIntentSessions:9,shareCompletedSessions:6,cartAddSessions:14},{productId:"desserts:san-sebastian-cheesecake",viewSessions:52,likeSessions:22,unlikeSessions:0,shareIntentSessions:10,shareCompletedSessions:8,cartAddSessions:19},{productId:"cold-coffee:iced-caffe-latte",viewSessions:45,likeSessions:12,unlikeSessions:1,shareIntentSessions:5,shareCompletedSessions:2,cartAddSessions:10}],hours:Array.from({length:24},(_,hour)=>({hour,sessions:({9:12,10:18,12:24,15:16,17:28,19:22} as Record<number,number>)[hour]??0})),areaClicks:{menu:64,product_card:92,favorite:38,cart:44,share:24,visit:11}};
export const demoCounter:Counter={startDay:"2026-11-01",endExclusive:"2026-11-08",createdOrders:80,createdCohortAwaitingAtClose:9,paymentAcknowledgements:71,acknowledgedOrderValueMinor:1242500,issuedOrders:68,paidToReadySample:65,averagePaidToReadyMs:210000};
