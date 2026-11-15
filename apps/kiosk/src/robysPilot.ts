// Aggregate owner-declared reconciliation, not an audit or attribution engine.
export type DayRow={day:string;orders:number;netSalesMinor:number;variableCostMinor:number;campaignCostMinor:number};
export type PosWindow={startDay:string;endExclusive:string;days:DayRow[]};
export type PilotInput={schema:"biteos.robys-pilot-pos.v1";tenantId:"robys";currency:"TRY";source:"operator-reconciled-pos";costCoverage:"net-sales-variable-cost-campaign-cost";before:PosWindow;after:PosWindow};
export type WebWindow={startDay:string;endExclusive:string;sessions:number;handoffSessions:number;catalogRevision:string};
export type CashWindow={startDay:string;endExclusive:string;paymentAcknowledgements:number;acknowledgedOrderValueMinor:number};
const DAY=86400000;
const obj=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>obj(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const integer=(v:unknown,max:number):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<=max;
function day(v:unknown):number{if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error("Invalid day");return Date.parse(v)}
const date=(t:number)=>new Date(t).toISOString().slice(0,10);
function window(v:unknown):PosWindow{
 if(!exact(v,["startDay","endExclusive","days"])||!Array.isArray(v.days)||v.days.length!==14)throw Error("Incomplete POS window");
 const start=day(v.startDay),end=day(v.endExclusive);if(end-start!==14*DAY)throw Error("Expected 14 days");
 const days:DayRow[]=v.days.map((x,i)=>{if(!exact(x,["day","orders","netSalesMinor","variableCostMinor","campaignCostMinor"])||x.day!==date(start+i*DAY)||!integer(x.orders,100000)||!integer(x.netSalesMinor,1000000000)||!integer(x.variableCostMinor,1000000000)||!integer(x.campaignCostMinor,1000000000)||x.orders===0&&x.netSalesMinor!==0)throw Error("Invalid daily reconciliation");return x as DayRow});
 return {startDay:v.startDay as string,endExclusive:v.endExclusive as string,days};
}
export function decodePilot(v:unknown,asOf:string):PilotInput{
 if(!exact(v,["schema","tenantId","currency","source","costCoverage","before","after"])||v.schema!=="biteos.robys-pilot-pos.v1"||v.tenantId!=="robys"||v.currency!=="TRY"||v.source!=="operator-reconciled-pos"||v.costCoverage!=="net-sales-variable-cost-campaign-cost")throw Error("Invalid pilot source");
 const before=window(v.before),after=window(v.after);if(before.endExclusive!==after.startDay||day(after.endExclusive)>day(asOf))throw Error("Incomplete or nonadjacent periods");
 return {schema:"biteos.robys-pilot-pos.v1",tenantId:"robys",currency:"TRY",source:"operator-reconciled-pos",costCoverage:"net-sales-variable-cost-campaign-cost",before,after};
}
function summarize(w:PosWindow,web:WebWindow|null,cash:CashWindow|null,revision:string){
 let orders=0,sales=0,variable=0,campaign=0;for(const d of w.days){orders+=d.orders;sales+=d.netSalesMinor;variable+=d.variableCostMinor;campaign+=d.campaignCostMinor}
 const validWeb=web&&web.startDay===w.startDay&&web.endExclusive===w.endExclusive&&web.catalogRevision===revision&&integer(web.sessions,100000)&&integer(web.handoffSessions,web.sessions)?web:null;
 const validCash=cash&&cash.startDay===w.startDay&&cash.endExclusive===w.endExclusive&&integer(cash.paymentAcknowledgements,100000000)&&integer(cash.acknowledgedOrderValueMinor,Number.MAX_SAFE_INTEGER)?cash:null;
 return {startDay:w.startDay,endExclusive:w.endExclusive,orders,netSalesMinor:sales,variableCostMinor:variable,campaignCostMinor:campaign,contributionMinor:sales-variable-campaign,meanCheckMinor:orders?Math.round(sales/orders):null,web:validWeb?{sessions:validWeb.sessions,handoffSessions:validWeb.handoffSessions}:null,counter:validCash?{paymentAcknowledgements:validCash.paymentAcknowledgements,acknowledgedOrderValueMinor:validCash.acknowledgedOrderValueMinor}:null};
}
export function pilotReport(raw:unknown,asOf:string,revision:string,web:readonly WebWindow[]=[],cash:readonly CashWindow[]=[]){
 const input=decodePilot(raw,asOf);
 const get=(w:PosWindow)=>{const ws=web.filter(x=>x.startDay===w.startDay&&x.endExclusive===w.endExclusive),cs=cash.filter(x=>x.startDay===w.startDay&&x.endExclusive===w.endExclusive);if(ws.length>1||cs.length>1)throw Error("Ambiguous aggregate windows");return summarize(w,ws[0]??null,cs[0]??null,revision)};
 const before=get(input.before),after=get(input.after);
 return {schema:"biteos.robys-pilot-summary.v1",tenantId:"robys",currency:"TRY",source:"operator-reconciled-pos" as const,before,after,deltaSalesMinor:after.netSalesMinor-before.netSalesMinor,deltaContributionMinor:after.contributionMinor-before.contributionMinor,deltaOrders:after.orders-before.orders,actualRevenueIndependentlyVerified:false,netProfitAvailable:false,webSalesAttributionAvailable:false,causalEffectEstablished:false,outcomeFeeAuthorized:false};
}
export function demoPilot():PilotInput{
 const make=(startDay:string,orders:number,sales:number,cost:number,campaign:number):PosWindow=>({startDay,endExclusive:date(day(startDay)+14*DAY),days:Array.from({length:14},(_,i)=>({day:date(day(startDay)+i*DAY),orders,netSalesMinor:sales,variableCostMinor:cost,campaignCostMinor:campaign}))});
 return {schema:"biteos.robys-pilot-pos.v1",tenantId:"robys",currency:"TRY",source:"operator-reconciled-pos",costCoverage:"net-sales-variable-cost-campaign-cost",before:make("2026-10-17",10,250000,100000,0),after:make("2026-10-31",12,312000,125000,10000)};
}
