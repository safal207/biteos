// Staff-only, offline rehearsal tools. Never authorizes collection from real guests.
import {createHash} from "node:crypto";
import {readFileSync,lstatSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {engagementReport} from "./robys-event-collector.mjs";
import {businessReview} from "../apps/kiosk/src/robysBusinessBrain.ts";
import {robysCatalog} from "../apps/kiosk/src/robysPublicCatalog.ts";
export const reviewedRobys={revision:"ceba0f55fe270429fa3080020834312d30d76967",contractBlob:"9e3ad10d1c697a83434e53fbc0e21b455264ac61"};
const DAY=86400000,RETENTION=30*DAY;
const gitBlob=bytes=>createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
function readBounded(file,limit){
 const s=lstatSync(file);if(!s.isFile()||s.size>limit)throw Error("Not a bounded regular file");
 const b=readFileSync(file);if(b.length>limit)throw Error("File too large");return b;
}
const canonical=s=>s.replace(/\r\n/g,"\n").trim();
export function compareContract(robysFile,biteosFile=new URL("./robys-engagement.mjs",import.meta.url)){
 const bytes=readBounded(robysFile,128*1024);
 if(gitBlob(bytes)!==reviewedRobys.contractBlob)throw Error("Robys contract differs from reviewed blob");
 const local=readBounded(biteosFile,128*1024).toString("utf8"),start=local.indexOf("const sourceMap="),end=local.indexOf("const keys=");
 const browser=bytes.toString("utf8"),bs=browser.indexOf("const sourceMap=");
 if(start<0||end<=start||bs<0||canonical(local.slice(start,end))!==canonical(browser.slice(bs)))throw Error("Producer/collector contract mismatch");
 return {schema:"biteos.robys-pilot-contract-check.v1",producerRevision:reviewedRobys.revision,producerBlob:reviewedRobys.contractBlob,contractTextMatches:true,scope:"producer-function-source-parity-only",liveCollectionAuthorized:false};
}
function boundary(s){
 if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error("Invalid reporting date");
 return Date.parse(s)-10800000;
}
export function closedEngagementReport(file,start,end,now=Date.now()){
 const a=boundary(start),b=boundary(end);
 if(!Number.isSafeInteger(now)||now<=0||b<=a||b-a>RETENTION||a<now-RETENTION||b>now)throw Error("Report window must be fully closed and entirely inside retention");
 // Does not attest completeness or prior pruning, consent, actual site arrival or event coverage.
 const aggregate=engagementReport(file,start,end,now);
 return aggregate;
}
export function blankBusinessInput(day){
 boundary(day);
 return {schema:"biteos.robys-business-input.v1",tenantId:"robys",catalogRevision:robysCatalog.sourceRevision,day,history:null,weather:"unknown",occasion:false,plan:null,costs:null,discountPct:0,campaignMinor:0,experiment:null,pilot:null};
}
export function reviewFile(file,asOf){
 const raw=JSON.parse(readBounded(file,1024*1024).toString("utf8"));
 return businessReview(raw,asOf,robysCatalog.sourceRevision,robysCatalog.products);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [cmd,...args]=process.argv.slice(2);let result;
  if(cmd==="contract"&&args.length===1)result=compareContract(args[0]);
  else if(cmd==="report"&&args.length===3){result=closedEngagementReport(...args);console.error("Closed window only: client event coverage and completeness are NOT verified. Checkout, true arrival and sales remain unmeasured in current producer.")}
  else if(cmd==="template"&&args.length===1)result=blankBusinessInput(args[0]);
  else if(cmd==="review"&&args.length===1)result=reviewFile(args[0],new Date(Date.now()+10800000).toISOString().slice(0,10));
  else throw Error("Usage");
  console.log(JSON.stringify(result,null,2));
 }catch{console.error("Pilot handoff rejected. Check pinned producer, private files, dates and schema. No launch authorized.");process.exitCode=1}
}
