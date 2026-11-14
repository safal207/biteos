export const channelMedium={instagram:"social",whatsapp:"messaging",telegram:"messaging",google_maps:"maps",google:"search",table_qr:"qr",window_qr:"qr",partner:"referral",shared_product:"referral"} as const;
export type Channel=keyof typeof channelMedium;
export type CampaignInput={productId:string;channel:Channel;language:"tr"|"ru"|"en";startDay:string;duration:number;budgetMinor:number;targetHandoffs:number};
export type CampaignPlan=CampaignInput & {schema:"biteos.robys-campaign-draft.v1";tenantId:"robys";tag:"pilot";endExclusive:string;baselineStart:string;baselineEndExclusive:string;link:string;externalEffectsAuthorized:false};
type Row={source:string;campaign:string|null;sessions:number;handoffSessions:number;routeSessions:number};
type Report={startDay:string;endExclusive:string;channels:Row[]};
const DAY=86400000;
const validDay=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const date=(n:number)=>new Date(n).toISOString().slice(0,10);
export function draftCampaign(input:CampaignInput,ids:readonly string[]):CampaignPlan{
 if(!ids.includes(input.productId)||!Object.hasOwn(channelMedium,input.channel)||!["tr","ru","en"].includes(input.language)||!validDay(input.startDay)||!Number.isInteger(input.duration)||input.duration<1||input.duration>14||!Number.isSafeInteger(input.budgetMinor)||input.budgetMinor<0||input.budgetMinor>100000000||!Number.isInteger(input.targetHandoffs)||input.targetHandoffs<1||input.targetHandoffs>100000)throw Error("Invalid campaign draft");
 const start=Date.parse(input.startDay),url=new URL("https://safal207.github.io/robys-coffee-house-demo/menu-feed.html");
 url.searchParams.set("lang",input.language);url.searchParams.set("item",input.productId);
 url.searchParams.set("utm_source",input.channel);url.searchParams.set("utm_medium",channelMedium[input.channel]);url.searchParams.set("utm_campaign","pilot");
 return {...input,schema:"biteos.robys-campaign-draft.v1",tenantId:"robys",tag:"pilot",endExclusive:date(start+input.duration*DAY),baselineStart:date(start-input.duration*DAY),baselineEndExclusive:input.startDay,link:url.href,externalEffectsAuthorized:false};
}
export function evaluateCampaign(plan:CampaignPlan,baseline:Report,observed:Report,asOf:string){
 if(!validDay(asOf)||asOf<plan.endExclusive||baseline.startDay!==plan.baselineStart||baseline.endExclusive!==plan.baselineEndExclusive||observed.startDay!==plan.startDay||observed.endExclusive!==plan.endExclusive)throw Error("Mismatched or incomplete window");
 const row=(r:Report)=>r.channels.find(c=>c.source===plan.channel&&c.campaign===plan.tag)??{sessions:0,handoffSessions:0,routeSessions:0};
 const b=row(baseline),o=row(observed);
 // Tagged-channel totals are not SKU-specific or causal. Zero exposure has no defined rate.
 return {baselineSessions:b.sessions,observedSessions:o.sessions,baselineHandoffs:b.handoffSessions,observedHandoffs:o.handoffSessions,deltaHandoffs:o.handoffSessions-b.handoffSessions,observedRate:o.sessions?o.handoffSessions/o.sessions:null,baselineRate:b.sessions?b.handoffSessions/b.sessions:null,targetMet:o.handoffSessions>=plan.targetHandoffs,plannedCostPerHandoffMinor:o.handoffSessions?Math.round(plan.budgetMinor/o.handoffSessions):null,causalEffectEstablished:false,actualRevenueVerified:false,externalEffectsAuthorized:false};
}
