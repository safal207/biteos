// Bounded, local, explicit preference journal. No implicit behavior, identity or network.
export const memoryKey="biteos.robys.memory.v1";
const DAY=86400000,TTL=30*DAY,MAX=32;
const layouts=["classic","reels","gallery","channels"] as const;
export type Topic="layout"|"product";
export type Event={seq:number;at:number;topic:Topic;value:string;action:"prefer"|"avoid"|"apply"|"dismiss";basis:number|null};
export type Memory={schema:"biteos.robys-memory.v1";expiresAt:number;next:number;events:Event[]};
type Suggestion={topic:Topic;value:string;basis:number;reason:"latest-explicit-preference"};
const exact=(x:unknown,keys:string[]):x is Record<string,unknown>=>!!x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const int=(n:unknown):n is number=>typeof n==="number"&&Number.isSafeInteger(n)&&n>=0;
function validValue(topic:Topic,value:string,ids:readonly string[]){return topic==="layout"?(layouts as readonly string[]).includes(value):ids.includes(value)}
export function freshMemory(now:number):Memory{if(!int(now)||now>Number.MAX_SAFE_INTEGER-TTL)throw Error("Invalid clock");return {schema:"biteos.robys-memory.v1",expiresAt:now+TTL,next:1,events:[]}}
export function readMemory(raw:string|null,now:number,ids:readonly string[]):Memory|null{
 try{
  if(raw===null||raw.length>24000||!int(now))return null;const x:unknown=JSON.parse(raw);
  if(!exact(x,["schema","expiresAt","next","events"])||x.schema!=="biteos.robys-memory.v1"||!int(x.expiresAt)||x.expiresAt<=now||x.expiresAt>now+TTL||!int(x.next)||x.next<1||!Array.isArray(x.events)||x.events.length>MAX)return null;
  let prev=0,at=0;const events:Event[]=[];
  for(const e of x.events){
   if(!exact(e,["seq","at","topic","value","action","basis"])||!int(e.seq)||e.seq<=prev||e.seq>=x.next||!int(e.at)||e.at<at||e.at>now||!(e.topic==="layout"||e.topic==="product")||typeof e.value!=="string"||!validValue(e.topic,e.value,ids)||!(e.action==="prefer"||e.action==="avoid"||e.action==="apply"||e.action==="dismiss"))return null;
   if(e.action==="prefer"||e.action==="avoid"){if(e.basis!==null)return null}
   else if(!int(e.basis)||e.basis>=e.seq||e.topic!=="layout")return null;
   const ev=e as Event;
   // A surviving action must refer to a matching prior prefer record.
   if(ev.basis!==null&&!events.some(b=>b.seq===ev.basis&&b.topic===ev.topic&&b.value===ev.value&&b.action==="prefer"))return null;
   events.push(ev);prev=e.seq;at=e.at;
  }
  if(events.length&&x.next!==events[events.length-1].seq+1)return null;
  const kept=events.filter(e=>e.at>=now-TTL),bases=new Set(kept.map(e=>e.seq));
  return {schema:"biteos.robys-memory.v1",expiresAt:x.expiresAt,next:x.next,events:kept.filter(e=>e.basis===null||bases.has(e.basis))};
 }catch{return null}
}
export function suggestMemory(m:Memory,topic:Topic):Suggestion|null{
 const last=new Map<string,Event>();for(const e of m.events)if(e.topic===topic&&(e.action==="prefer"||e.action==="avoid"))last.set(e.value,e);
 const eligible=[...last.values()].filter(e=>e.action==="prefer"&&!m.events.some(d=>d.basis===e.seq&&d.action==="dismiss")).sort((a,b)=>b.seq-a.seq);
 const e=eligible[0];return e?{topic,value:e.value,basis:e.seq,reason:"latest-explicit-preference"}:null;
}
export function addMemory(m:Memory,now:number,ids:readonly string[],topic:Topic,value:string,action:Event["action"],basis:number|null=null):Memory{
 const validated=readMemory(JSON.stringify(m),now,ids);if(!validated||!validValue(topic,value,ids)||!["layout","product"].includes(topic)||!["prefer","avoid","apply","dismiss"].includes(action))throw Error("Invalid memory event");
 if(action==="prefer"||action==="avoid"){if(basis!==null)throw Error("Invalid basis")}
 else {const s=suggestMemory(validated,topic);if(topic!=="layout"||!s||s.value!==value||s.basis!==basis||validated.events.some(e=>e.basis===basis&&e.action===action))throw Error("Stale suggestion")}
 const event={seq:validated.next,at:now,topic,value,action,basis};
 const kept=[...validated.events,event].slice(-MAX);const seqs=new Set(kept.map(e=>e.seq));
 const result:Memory={schema:"biteos.robys-memory.v1",expiresAt:now+TTL,next:validated.next+1,events:kept.filter(e=>e.basis===null||seqs.has(e.basis))};
 if(!readMemory(JSON.stringify(result),now,ids))throw Error("Invalid next memory");
 return result;
}
