import {DatabaseSync} from "node:sqlite";
import {openSync,closeSync,readFileSync,lstatSync,unlinkSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {summarize} from "./robys-engagement.mjs";
import {robysCatalog} from "../apps/kiosk/src/robysPublicCatalog.ts";

const ids=robysCatalog.products.map(p=>p.id),DAY=86400000,RETENTION=30*DAY,APP_ID=1112822597,MAX_EVENTS=100000;
const canonical=e=>JSON.stringify(Object.fromEntries(Object.keys(e).sort().map(k=>[k,e[k]])));
const fail=()=>new Error("Invalid collector input or database");
function open(file,readOnly=false){
 if(!file||typeof file!=="string"||!lstatSync(file).isFile())throw fail();
 const db=new DatabaseSync(file,{readOnly});
 try{
  if(db.prepare("PRAGMA application_id").get().application_id!==APP_ID||db.prepare("PRAGMA user_version").get().user_version!==1)throw fail();
  db.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
  if(readOnly)db.exec("PRAGMA query_only=ON");
  else db.exec("PRAGMA secure_delete=ON");
  return db;
 }catch(e){db.close();throw e}
}
export function initCollector(file){
 if(!file||typeof file!=="string")throw fail();
 const fd=openSync(file,"wx",0o600);closeSync(fd);
 let db;
 try{
  db=new DatabaseSync(file);
  db.exec(`PRAGMA application_id=${APP_ID}; PRAGMA user_version=1;
    PRAGMA journal_mode=DELETE; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;
    CREATE TABLE sessions(id TEXT PRIMARY KEY, landed_ms INTEGER NOT NULL);
    CREATE TABLE events(session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL CHECK(sequence BETWEEN 1 AND 256), occurred_ms INTEGER NOT NULL,
      body TEXT NOT NULL, PRIMARY KEY(session_id,sequence)) WITHOUT ROWID;
    CREATE INDEX sessions_landed ON sessions(landed_ms);
    CREATE INDEX events_occurred ON events(occurred_ms);`);
 }catch(e){db?.close();unlinkSync(file);throw e}
 db.close();
}
function instant(now){if(!Number.isSafeInteger(now)||now<=0)throw fail();return now}
function transaction(db,action){db.exec("BEGIN IMMEDIATE");try{const value=action();db.exec("COMMIT");return value}catch(e){db.exec("ROLLBACK");throw e}}
export function ingestEvents(file,events,now=Date.now()){
 instant(now);
 if(!Array.isArray(events)||events.length===0||events.length>10000)throw fail();
 // Shared contract verifies strict fields, catalog membership, and complete prefixes.
 summarize(events,ids);
 if(events.some(e=>Date.parse(e.occurredAt)<now-RETENTION||Date.parse(e.occurredAt)>now+5*60000))throw fail();
 const groups=new Map();
 for(const e of events){if(!groups.has(e.sessionId))groups.set(e.sessionId,new Map());groups.get(e.sessionId).set(e.sequence,e)}
 const db=open(file);
 try{return transaction(db,()=>{
  const session=db.prepare("SELECT landed_ms FROM sessions WHERE id=?");
  const insertSession=db.prepare("INSERT INTO sessions(id,landed_ms) VALUES(?,?)");
  const existing=db.prepare("SELECT sequence,body FROM events WHERE session_id=? ORDER BY sequence");
  const insert=db.prepare("INSERT INTO events(session_id,sequence,occurred_ms,body) VALUES(?,?,?,?)");
  let inserted=0,replayed=0,total=db.prepare("SELECT COUNT(*) AS n FROM events").get().n;
  for(const [id,group] of groups){
   const rows=[...group.values()].sort((a,b)=>a.sequence-b.sequence),start=Date.parse(rows[0].occurredAt);
   const known=session.get(id),old=existing.all(id);
   if(known&&known.landed_ms!==start||known&&!old.length)throw fail();
   if(!known)insertSession.run(id,start);
   for(const e of rows){
    const body=canonical(e),prior=old[e.sequence-1];
    if(prior){if(prior.sequence!==e.sequence||prior.body!==body)throw Error("Conflicting replay");replayed++;continue}
    if(++total>MAX_EVENTS)throw Error("Collector capacity exceeded; prune or use a new approved database");
    insert.run(id,e.sequence,Date.parse(e.occurredAt),body);inserted++;
   }
  }
  return {schema:"biteos.robys-collector-import.v1",inserted,replayed,sessionSnapshots:groups.size,actualRevenueVerified:false};
 })}finally{db.close()}
}
function boundary(day){
 if(typeof day!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(day))throw fail();
 const t=Date.parse(day+"T00:00:00Z");if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==day)throw fail();
 return t-10800000;
}
export function engagementReport(file,startDay,endExclusive,now=Date.now()){
 instant(now);const start=boundary(startDay),end=boundary(endExclusive);
 if(end<=start||end-start>31*DAY)throw fail();
 const db=open(file,true);
 try{
  const events=db.prepare(`SELECT e.body FROM sessions s JOIN events e ON s.id=e.session_id
    WHERE s.landed_ms>=? AND s.landed_ms<? AND e.occurred_ms<? AND e.occurred_ms<=?
    ORDER BY s.id,e.sequence`).all(Math.max(start,now-RETENTION),end,end,now).map(r=>JSON.parse(r.body));
  return {...summarize(events,ids),startDay,endExclusive,windowRule:"session-start-cohort-events-before-close",retentionDays:30,sourceCatalogRevision:robysCatalog.sourceRevision};
 }finally{db.close()}
}
export function pruneCollector(file,now=Date.now()){
 instant(now);const db=open(file);
 try{return transaction(db,()=>({deletedSessions:db.prepare("DELETE FROM sessions WHERE landed_ms<?").run(now-RETENTION).changes}))}finally{db.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [cmd,file,arg,end,...rest]=process.argv.slice(2);if(!file||rest.length)throw fail();let result;
  if(cmd==="init"&&!arg&&!end){initCollector(file);result={initialized:true}}
  else if(cmd==="import"&&arg&&!end){if(lstatSync(arg).size>5*1024*1024)throw fail();result=ingestEvents(file,JSON.parse(readFileSync(arg,"utf8")))}
  else if(cmd==="report"&&arg&&end)result=engagementReport(file,arg,end);
  else if(cmd==="prune"&&!arg&&!end)result=pruneCollector(file);
  else throw fail();
  console.log(JSON.stringify(result,null,2));
 }catch{console.error("Collector failed. Check command, private SQLite file, authorized event export, catalog and time window.");process.exitCode=1}
}
