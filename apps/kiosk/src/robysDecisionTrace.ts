// Offline owner-side decision explanation; no persistence or authority.
import {businessOfferReview} from "./robysBusinessOfferReview.ts";
import {robysCatalog} from "./robysPublicCatalog.ts";

const sources = ["experiment", "operations", "financial", "forecast", "pilot"] as const;
type Node = {id:string; stage:"evidence"|"decision"; surface:"owner"; status:string};
type Edge = {from:string; to:string; relation:"review-input"|"gate-order"|"disposition"};

// Recompute through the existing strict validator; never accept a caller's
// derived decision, graph, guest history or authorization flags.
export function decisionTrace(raw:unknown, now:number) {
  const review = businessOfferReview(raw, now);
  const gateReached = review.reason !== "business-gate";
  const nodes:Node[] = sources.map(source => ({
    id:source, stage:"evidence", surface:"owner", status:review.coverage[source]
  }));
  nodes.push({id:"business-brain",stage:"decision",surface:"owner",
    status:gateReached ? "review-only" : review.state});
  const edges:Edge[] = sources.map(source => ({
    from:source,to:"business-brain",relation:"review-input"
  }));
  if(gateReached) {
    nodes.push({id:"offer-gate",stage:"decision",surface:"owner",status:review.state});
    edges.push({from:"business-brain",to:"offer-gate",relation:"gate-order"});
  }
  nodes.push({id:"disposition",stage:"decision",surface:"owner",status:review.state});
  edges.push({from:gateReached ? "offer-gate" : "business-brain",
    to:"disposition",relation:"disposition"});
  return {
    schema:"biteos.robys-decision-trace.v1" as const,
    tenantId:"robys" as const,
    surface:"owner-review" as const,
    catalogRevision:robysCatalog.sourceRevision,
    decisionTimeUtc:new Date(now).toISOString(),
    scenarioDay:review.day,
    productId:review.productId,
    state:review.state,
    reason:review.reason,
    tasks:review.tasks,
    coverage:review.coverage,
    graph:{nodes,edges},
    candidate:review.candidate,
    claim:"declared-inputs-computation-only" as const,
    sourceIndependentlyVerified:false,
    causalEffectEstablished:false,
    actualRevenueVerified:false,
    netProfitAvailable:false,
    guestMemoryRead:false,
    rolloutAuthorized:false,
    priceChangeAuthorized:false,
    marketingAuthorized:false,
    externalEffectsAuthorized:false,
    persisted:false,
  };
}
