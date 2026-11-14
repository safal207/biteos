import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const SOURCE_REVISION = "59f127c69983eae57215868679d8fa46bab89931";
function boundary(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Use YYYY-MM-DD dates");
  const utc = Date.parse(day+"T00:00:00Z");
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0,10)!==day) throw new Error("Invalid date");
  return utc-3*60*60*1000; // Explicit Istanbul UTC+03:00 reporting convention.
}
export function reportCounter(file, startDay, endExclusive) {
  const start=boundary(startDay),end=boundary(endExclusive);
  if(end<=start||end-start>31*86400000) throw new Error("Window must be 1–31 days");
  if(!file||file===":memory:") throw new Error("Explicit authorized database snapshot required");
  const db=new DatabaseSync(file,{readOnly:true});
  try {
    db.exec("PRAGMA query_only=ON; BEGIN");
    if(db.prepare("PRAGMA user_version").get().user_version!==1) throw new Error("Unsupported Robys counter schema");
    const created=db.prepare(`SELECT COUNT(*) AS created,
      COALESCE(SUM(CASE WHEN paid_at IS NULL OR paid_at>=? THEN 1 ELSE 0 END),0) AS awaiting_at_close
      FROM orders WHERE created_at>=? AND created_at<?`).get(end,start,end);
    const paid=db.prepare(`SELECT COUNT(*) AS acknowledged,
      COALESCE(SUM(total_minor),0) AS acknowledged_minor
      FROM orders WHERE paid_at>=? AND paid_at<? AND created_at<=paid_at`).get(start,end);
    const issued=db.prepare(`SELECT COUNT(DISTINCT order_id) AS issued
      FROM audit WHERE action='issued' AND at>=? AND at<?`).get(start,end);
    const readiness=db.prepare(`WITH first_ready AS (
      SELECT order_id, MIN(at) AS ready_at FROM audit WHERE action='ready' AND at<? GROUP BY order_id
    ) SELECT COUNT(*) AS ready_sample,
      CAST(AVG(first_ready.ready_at-orders.paid_at) AS INTEGER) AS average_paid_to_ready_ms
      FROM orders JOIN first_ready ON first_ready.order_id=orders.id
      WHERE paid_at>=? AND paid_at<? AND created_at<=paid_at AND first_ready.ready_at>=paid_at`).get(end,start,end);
    db.exec("COMMIT");
    return {schema:"biteos.robys-counter-aggregate.v1",sourceRepository:"safal207/robys-coffee-house-demo",compatibleSourceRevision:SOURCE_REVISION,tenantId:"robys",currency:"TRY",timeZone:"UTC+03:00",startDay,endExclusive,
      evidenceStatus:"local-counter-staff-acknowledgement-not-pos-reconciled",
      createdOrders:created.created,createdCohortAwaitingAtClose:created.awaiting_at_close,
      paymentAcknowledgements:paid.acknowledged,acknowledgedOrderValueMinor:paid.acknowledged_minor,
      issuedOrders:issued.issued,paidToReadySample:readiness.ready_sample,averagePaidToReadyMs:readiness.average_paid_to_ready_ms,
      actualRevenueVerified:false,profitAvailable:false,causalEffectEstablished:false,externalEffectsAuthorized:false};
  } finally { db.close(); }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    if(process.argv.length!==5)throw new Error("Usage: node scripts/robys-counter-report.mjs <authorized snapshot.sqlite> <startDay> <endExclusive>");
    console.log(JSON.stringify(reportCounter(...process.argv.slice(2)),null,2));
  }catch{console.error("Robys report failed: verify the authorized snapshot, schema v1 and reporting dates.");process.exitCode=1}
}
