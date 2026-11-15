// Fixed-horizon exploratory review of declared aggregate evidence; never assigns traffic.
export type Plan={schema:"biteos.robys-experiment-plan.v1";tenantId:"robys";experimentId:string;catalogRevision:string;startDay:string;endExclusive:string;baselinePct:number;liftPP:number;errorLimitPP:number;metric:"cart-add-session";allocation:"50-50";unit:"consented-session"};
type Arm={assigned:number;cartAdds:number;errorSessions:number};
export type Results={schema:"biteos.robys-experiment-result.v1";plan:Plan;source:"operator-declared-session-aggregate";assignmentDeclared:"random-first-eligible-session";complete:true;a:Arm;b:Arm};
const DAY=86400000;
const exact=(v:unknown,ks:string[]):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
const int=(v:unknown,min:number,max:number):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const day=(x:unknown)=>{if(typeof x!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(x)||!Number.isFinite(Date.parse(x))||new Date(x).toISOString().slice(0,10)!==x)throw Error("Invalid day");return Date.parse(x)};
export function validatePlan(raw:unknown,revision:string):Plan{
 if(!exact(raw,["schema","tenantId","experimentId","catalogRevision","startDay","endExclusive","baselinePct","liftPP","errorLimitPP","metric","allocation","unit"])||raw.schema!=="biteos.robys-experiment-plan.v1"||raw.tenantId!=="robys"||typeof raw.experimentId!=="string"||!/^[a-z0-9-]{1,48}$/.test(raw.experimentId)||raw.catalogRevision!==revision||!int(raw.baselinePct,1,90)||!int(raw.liftPP,1,30)||raw.baselinePct+raw.liftPP>=100||!int(raw.errorLimitPP,1,10)||raw.metric!=="cart-add-session"||raw.allocation!=="50-50"||raw.unit!=="consented-session")throw Error("Invalid plan");
 const span=day(raw.endExclusive)-day(raw.startDay);if(span<7*DAY||span>28*DAY)throw Error("Window must be 7–28 days");
 return raw as Plan;
}
export function requiredPerArm(plan:Plan){
 const p=plan.baselinePct/100,q=p+plan.liftPP/100,m=(p+q)/2;
 return Math.max(100,Math.ceil(((1.96*Math.sqrt(2*m*(1-m))+.841621*Math.sqrt(p*(1-p)+q*(1-q)))**2)/((q-p)**2)));
}
function arm(raw:unknown):Arm{
 if(!exact(raw,["assigned","cartAdds","errorSessions"])||!int(raw.assigned,0,1000000)||!int(raw.cartAdds,0,raw.assigned)||!int(raw.errorSessions,0,raw.assigned))throw Error("Invalid arm");return raw as Arm;
}
function wilson(k:number,n:number){
 const p=k/n,z=1.96,d=1+z*z/n,c=(p+z*z/(2*n))/d,w=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
 return [Math.max(0,c-w),Math.min(1,c+w)] as const;
}
export function evaluateExperiment(raw:unknown,asOf:string,revision:string){
 if(!exact(raw,["schema","plan","source","assignmentDeclared","complete","a","b"])||raw.schema!=="biteos.robys-experiment-result.v1"||raw.source!=="operator-declared-session-aggregate"||raw.assignmentDeclared!=="random-first-eligible-session"||raw.complete!==true)throw Error("Invalid result");
 const plan=validatePlan(raw.plan,revision),a=arm(raw.a),b=arm(raw.b),target=requiredPerArm(plan),closed=day(asOf)>=day(plan.endExclusive);
 const rates=a.assigned>0&&b.assigned>0?{a:a.cartAdds/a.assigned,b:b.cartAdds/b.assigned,errorA:a.errorSessions/a.assigned,errorB:b.errorSessions/b.assigned}:null;
 const total=a.assigned+b.assigned,srm=total?(a.assigned-b.assigned)**2/total:null;
 const delta=rates?rates.b-rates.a:null;
 let interval:readonly [number,number]|null=null;
 type Status="not-closed"|"guardrail"|"allocation-mismatch"|"insufficient"|"inconclusive"|"review-positive"|"review-negative";
 let status:Status="insufficient";
 // Safety warning may be issued early; never a positive or negative efficacy review early.
 if(rates&&rates.errorB-rates.errorA>plan.errorLimitPP/100)status="guardrail";
 else if(!closed)status="not-closed";
 else if(srm!==null&&srm>10.8276)status="allocation-mismatch";
 else if(rates&&a.assigned>=target&&b.assigned>=target&&Math.min(a.cartAdds,a.assigned-a.cartAdds,b.cartAdds,b.assigned-b.cartAdds)>=10){
  const [al,au]=wilson(a.cartAdds,a.assigned),[bl,bu]=wilson(b.cartAdds,b.assigned),d=rates.b-rates.a;
  interval=[d-Math.sqrt((rates.b-bl)**2+(au-rates.a)**2),d+Math.sqrt((bu-rates.b)**2+(rates.a-al)**2)];
  status=interval[0]>0?"review-positive":interval[1]<0?"review-negative":"inconclusive";
 }
 return {status,plan,a,b,target,rates,delta,interval,srm,closed,sampleAdequate:a.assigned>=target&&b.assigned>=target,assignmentVerified:false,causalEffectEstablished:false,revenueVerified:false,rolloutAuthorized:false};
}
export function demoExperiment(revision:string,kind="positive"):Results{
 const plan:Plan={schema:"biteos.robys-experiment-plan.v1",tenantId:"robys",experimentId:"adaptive-menu-01",catalogRevision:revision,startDay:"2026-10-31",endExclusive:"2026-11-14",baselinePct:12,liftPP:5,errorLimitPP:2,metric:"cart-add-session",allocation:"50-50",unit:"consented-session"};
 const a={assigned:1000,cartAdds:120,errorSessions:10},b={assigned:1000,cartAdds:170,errorSessions:12};
 if(kind==="small"){Object.assign(a,{assigned:100,cartAdds:12,errorSessions:1});Object.assign(b,{assigned:100,cartAdds:17,errorSessions:1})}
 if(kind==="harm")b.errorSessions=80;
 if(kind==="skew")Object.assign(b,{assigned:1600,cartAdds:272,errorSessions:19});
 if(kind==="flat")b.cartAdds=122;
 return {schema:"biteos.robys-experiment-result.v1",plan,source:"operator-declared-session-aggregate",assignmentDeclared:"random-first-eligible-session",complete:true,a,b};
}
