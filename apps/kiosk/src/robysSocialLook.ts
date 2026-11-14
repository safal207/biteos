export const layouts=["classic","reels","gallery","channels"] as const;
export type Layout=typeof layouts[number];
export const layoutNames:Record<Layout,readonly [string,string,string]>={classic:["Klasik","Классика","Classic"],reels:["Kısa akış","Короткая лента","Short feed"],gallery:["Fotoğraf duvarı","Фотостена","Photo wall"],channels:["Koleksiyonlar","Подборки","Collections"]};
export function readLayout(value:string|null):Layout{return layouts.includes(value as Layout)?value as Layout:"classic"}
export type Signal="select"|"browse"|"open"|"helpful"|"not_helpful";
const signals=["select","browse","open","helpful","not_helpful"] as const;
type Counts=Record<Signal,number>;
export type LookFeedback=Record<Layout,Counts>;
export function emptyFeedback():LookFeedback{return Object.fromEntries(layouts.map(l=>[l,{select:0,browse:0,open:0,helpful:0,not_helpful:0}])) as LookFeedback}
export function recordLook(previous:LookFeedback,consent:boolean,layout:Layout,signal:Signal):LookFeedback{
 if(!consent)return previous;if(!layouts.includes(layout)||!signals.includes(signal))throw Error("Invalid layout signal");
 const row=previous[layout];if(signal==="helpful"||signal==="not_helpful")return {...previous,[layout]:{...row,helpful:Number(signal==="helpful"),not_helpful:Number(signal==="not_helpful")}};
 return {...previous,[layout]:{...row,[signal]:Math.min(100,row[signal]+1)}};
}
export function preferredLayout(feedback:LookFeedback):Layout|null{
 // Explicit helpful vote only. No time spent, inferred age, gender or platform access.
 const voted=layouts.filter(l=>feedback[l].helpful===1&&feedback[l].not_helpful===0);
 return voted.length===1?voted[0]:null;
}
export function layoutLink(href:string,layout:Layout){
 const u=new URL(href);if(!layouts.includes(layout)||!["https:","http:"].includes(u.protocol)||u.username||u.password)throw Error("Invalid share");
 const mood=u.searchParams.get("robysMood");u.search="";if(mood&&["standard","cozy","study","friends","family","fresh"].includes(mood))u.searchParams.set("robysMood",mood);
 u.searchParams.set("robysLayout",layout);u.hash="#retail-robys-experience";return u.href;
}
