// Local opt-in measurement contract; no network, browser storage or automatic collection.
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
const sourceMap=Object.freeze({instagram:"social",whatsapp:"messaging",telegram:"messaging",google_maps:"maps",google:"search",table_qr:"qr",window_qr:"qr",partner:"referral",shared_product:"referral",unknown:"unknown",other_referral:"referral"});
const campaigns=new Set(["menu","profile","story","post","table","window","product_share","pilot"]);
const productActions=new Set(["product_view","product_like","product_unlike","share_intent","share_completed","cart_add"]);
const otherActions=new Set(["landing","last_activity","route_click","checkout_handoff","smart_choice_start","recommendation_selected","bump_shown","bump_accepted"]);
const areas=new Set(["hero","menu","product_card","favorite","cart","share","visit","smart_choice"]);
const langs=new Set(["tr","ru","en"]);
const validProduct=s=>typeof s==="string"&&s.length<=100&&/^[a-z0-9-]+:[a-z0-9-]+$/.test(s);
const validSession=s=>typeof s==="string"&&/^[a-f0-9]{32}$/.test(s);
const own=(o,k)=>Object.hasOwn(o,k);
const at=(source,campaign=null)=>({source,medium:sourceMap[source],campaign});
export function classifyEntry(href,referrer=""){
 const url=new URL(href),s=url.searchParams.get("utm_source"),m=url.searchParams.get("utm_medium"),c=url.searchParams.get("utm_campaign");
 if(own(sourceMap,s)&&!["unknown","other_referral"].includes(s)&&m===sourceMap[s]&&campaigns.has(c))return at(s,c);
 if(!referrer)return at("unknown");
 let ref;try{ref=new URL(referrer)}catch{return at("unknown")}
 if(!["https:","http:"].includes(ref.protocol)||ref.origin===url.origin)return at("unknown");
 const host=ref.hostname.toLowerCase(),is=d=>host===d||host.endsWith("."+d);
 if(is("instagram.com"))return at("instagram");
 if(is("whatsapp.com")||is("wa.me"))return at("whatsapp");
 if(is("telegram.org")||is("t.me"))return at("telegram");
 if(is("maps.google.com")||is("maps.app.goo.gl")||is("google.com")&&/^\/maps(?:\/|$)/.test(ref.pathname))return at("google_maps");
 if(is("google.com")||is("google.com.tr")||is("google.ru"))return at("google");
 return at("other_referral");
}
export function campaignLink({source,campaign,language="tr",productId=null}){
 if(!own(sourceMap,source)||["unknown","other_referral"].includes(source)||!campaigns.has(campaign)||!langs.has(language)||productId!==null&&!validProduct(productId))throw Error("Invalid campaign");
 // Direct product feed link: existing static OG share page drops incoming UTM on redirect.
 const url=new URL("https://safal207.github.io/robys-coffee-house-demo/menu-feed.html");
 url.searchParams.set("lang",language);if(productId)url.searchParams.set("item",productId);
 url.searchParams.set("utm_source",source);url.searchParams.set("utm_medium",sourceMap[source]);url.searchParams.set("utm_campaign",campaign);
 return url.href;
}
export function createSession({consent,sessionId,href,referrer="",language="tr",catalogIds,clock=()=>new Date().toISOString()}){
 if(consent!==true)return null;
 if(!validSession(sessionId)||!langs.has(language)||!Array.isArray(catalogIds)||!catalogIds.every(validProduct))throw Error("Invalid session");
 const catalog=new Set(catalogIds),entry=classifyEntry(href,referrer),events=[];let enabled=true;
 function record(action,productId=null,area=null){
  if(!enabled||events.length>=256||(!productActions.has(action)&&!otherActions.has(action)&&action!=="area_click")||productActions.has(action)!==(productId!==null)||productId!==null&&!catalog.has(productId)||(action==="area_click")!==(area!==null)||area!==null&&!areas.has(area))return false;
  if(action==="landing"&&events.length||action==="product_view"&&events.some(e=>e.action===action&&e.productId===productId))return false;
  events.push({schema:"robys.engagement.v1",sessionId,sequence:events.length+1,occurredAt:clock(),language,...entry,action,productId,area});return true;
 }
 record("landing");
 return {record,export:()=>events.map(e=>({...e})),withdraw:()=>{enabled=false;events.length=0}};
}
const keys="action|area|campaign|language|medium|occurredAt|productId|schema|sequence|sessionId|source";
function validate(e,catalog){
 if(!e||typeof e!=="object"||Object.keys(e).sort().join("|")!==keys||e.schema!=="robys.engagement.v1"||!validSession(e.sessionId)||!Number.isInteger(e.sequence)||e.sequence<1||e.sequence>256||!langs.has(e.language)||!own(sourceMap,e.source)||e.medium!==sourceMap[e.source]||e.campaign!==null&&!campaigns.has(e.campaign)||(!productActions.has(e.action)&&!otherActions.has(e.action)&&e.action!=="area_click")||productActions.has(e.action)!==(e.productId!==null)||e.productId!==null&&!catalog.has(e.productId)||(e.action==="area_click")!==(e.area!==null)||e.area!==null&&!areas.has(e.area)||typeof e.occurredAt!=="string"||!Number.isFinite(Date.parse(e.occurredAt))||new Date(e.occurredAt).toISOString()!==e.occurredAt)throw Error("Invalid event");
}
export function summarize(events,catalogIds){
 if(!Array.isArray(events)||events.length>100000||!Array.isArray(catalogIds)||!catalogIds.every(validProduct))throw Error("Invalid export");
 const catalog=new Set(catalogIds),sessions=new Map(),channels=new Map(),products=new Map(),areaClicks={},hours=Array.from({length:24},(_,hour)=>({hour,sessions:0}));let span=0;
 for(const e of events){validate(e,catalog);if(!sessions.has(e.sessionId))sessions.set(e.sessionId,new Map());const seq=sessions.get(e.sessionId),old=seq.get(e.sequence);if(old&&keys.split("|").some(k=>old[k]!==e[k]))throw Error("Conflicting retry");seq.set(e.sequence,e)}
 for(const seq of sessions.values()){
  const es=[...seq.values()].sort((a,b)=>a.sequence-b.sequence),first=es[0];
  if(first.action!=="landing"||es.some((e,i)=>e.sequence!==i+1||e.source!==first.source||e.campaign!==first.campaign||e.language!==first.language||i>0&&(e.action==="landing"||e.occurredAt<es[i-1].occurredAt)))throw Error("Invalid session sequence");
  const hour=new Date(Date.parse(first.occurredAt)+10800000).getUTCHours();hours[hour].sessions++;
  span+=Date.parse(es.at(-1).occurredAt)-Date.parse(first.occurredAt);
  const k=first.source+"|"+(first.campaign??""),c=channels.get(k)??{source:first.source,campaign:first.campaign,sessions:0,handoffSessions:0,routeSessions:0};
  c.sessions++;if(es.some(e=>e.action==="checkout_handoff"))c.handoffSessions++;if(es.some(e=>e.action==="route_click"))c.routeSessions++;channels.set(k,c);
  const seen=new Set();
  for(const e of es){
   if(e.area!==null)areaClicks[e.area]=(areaClicks[e.area]??0)+1;
   if(e.productId===null)continue;
   const p=products.get(e.productId)??{productId:e.productId,viewSessions:0,likeSessions:0,unlikeSessions:0,shareIntentSessions:0,shareCompletedSessions:0,cartAddSessions:0};
   const field={product_view:"viewSessions",product_like:"likeSessions",product_unlike:"unlikeSessions",share_intent:"shareIntentSessions",share_completed:"shareCompletedSessions",cart_add:"cartAddSessions"}[e.action],key=e.productId+"|"+field;
   if(!seen.has(key)){seen.add(key);p[field]++}products.set(e.productId,p);
  }
 }
 return {schema:"biteos.robys-engagement-aggregate.v1",tenantId:"robys",timeZone:"UTC+03:00",evidenceStatus:"opt-in-client-events-unverified",sessions:sessions.size,averageObservedSpanMs:sessions.size?Math.trunc(span/sessions.size):null,channels:[...channels.values()].sort((a,b)=>a.source.localeCompare(b.source)||String(a.campaign).localeCompare(String(b.campaign))),products:[...products.values()].sort((a,b)=>a.productId.localeCompare(b.productId)),hours,areaClicks,actualRevenueVerified:false,uniquePeopleVerified:false,causalEffectEstablished:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==4)throw Error("Usage");console.log(JSON.stringify(summarize(JSON.parse(readFileSync(process.argv[2],"utf8")),JSON.parse(readFileSync(process.argv[3],"utf8"))),null,2))}
 catch{console.error("Invalid local engagement export or catalog. No report generated.");process.exitCode=1}
}
