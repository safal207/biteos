package main

import (
 "net/http"
 "sort"
 "time"
)

// The Brain is a deterministic review queue, not an agent authorized to act.
type brainFact struct {
 Key string `json:"key"`
 Value int64 `json:"value"`
 Unit string `json:"unit"`
}
type brainDecision struct {
 ID string `json:"id"`
 Priority int `json:"priority"`
 Rule string `json:"rule"`
 Subject string `json:"subject"`
 Name map[string]string `json:"name,omitempty"`
 Facts []brainFact `json:"facts"`
 Next string `json:"next"`
}
type brainReport struct {
 Demo bool `json:"demo"`
 Mode string `json:"mode"`
 Currency string `json:"currency"`
 AsOf string `json:"asOf"`
 RuleVersion string `json:"ruleVersion"`
 EvidenceHead string `json:"evidenceHead,omitempty"`
 ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
 Fulfilled int `json:"fulfilled"`
 Contribution int64 `json:"contribution"`
 Decisions []brainDecision `json:"decisions"`
 Snapshot string `json:"snapshot,omitempty"`
 ReviewEnabled bool `json:"reviewEnabled"`
}
func(e *retailEngine) brainProjection(f financeReport,today string) brainReport{
 r:=brainReport{Demo:true,Mode:"review-only",Currency:"TRY",AsOf:today,RuleVersion:"brain-v1",Fulfilled:f.Fulfilled,Contribution:f.Contribution,Decisions:[]brainDecision{}}
 if len(e.evidence)>0{r.EvidenceHead=e.evidence[len(e.evidence)-1].Digest}
 add:=func(priority int,rule,subject string,name map[string]string,next string,facts ...brainFact){
  r.Decisions=append(r.Decisions,brainDecision{rule+":"+subject,priority,rule,subject,name,facts,next})
 }
 l:=e.lifetimeProjection(f,today)
 for _,row:=range l.Rows{
  facts:=[]brainFact{{"units",int64(row.Quantity),"units"},{"carryingCost",row.CostValue,"TRY-minor"}}
  switch row.Status{
  case "HOLD":add(0,"HOLD_LOT",row.LotID,row.Name,"lifetime",facts...)
  case "UNKNOWN":add(1,"VERIFY_DATE",row.LotID,row.Name,"lifetime",facts...)
  case "REVIEW_SOON":
   if row.ReviewEligible{facts=append(facts,brainFact{"reviewPrice",row.ReviewPrice,"TRY-minor"})}
   add(2,"REVIEW_EXPIRY",row.LotID,row.Name,"lifetime",facts...)
  }
 }
 for id,o:=range e.orders{
  if o.Status=="cancelled"||o.Status=="collected"||o.Status=="delivered"{continue}
  if d:=f.orderUseBy[id];d!=""&&lifetimeStatus(d,today)=="HOLD"{add(0,"HOLD_OPEN_ORDER",id,nil,"lifetime",brainFact{"orderCount",1,"count"})}
 }
 for _,p:=range f.Products{
  // Low stock is a review threshold, not a demand forecast.
  if p.AvailableStock<=2{add(2,"REVIEW_LOW_STOCK",p.ID,p.Name,"lifetime",brainFact{"availableUnits",int64(p.AvailableStock),"units"},brainFact{"historicalSold",int64(p.UnitsSold),"units"})}
 }
 for _,c:=range demandCandidates(){
  signals,units:=0,0
  for _,s:=range e.demandSignals{if s.CandidateID==c.ID{signals++;units+=s.Quantity}}
  if signals>0{add(3,"REVIEW_DEMAND",c.ID,c.Name,"demand-business",brainFact{"signals",int64(signals),"count"},brainFact{"requestedUnits",int64(units),"units"})}
 }
 if f.DeliveryFees<f.DeliveryCost{add(2,"REVIEW_DELIVERY_COST","delivery",nil,"spatial",brainFact{"fees",f.DeliveryFees,"TRY-minor"},brainFact{"sampleCost",f.DeliveryCost,"TRY-minor"})}
 if f.Fulfilled==0{add(3,"COLLECT_BASELINE","finance",nil,"finance",brainFact{"fulfilled",0,"count"})}
 sort.Slice(r.Decisions,func(i,j int)bool{a,b:=r.Decisions[i],r.Decisions[j];if a.Priority!=b.Priority{return a.Priority<b.Priority};return a.ID<b.ID})
 return r
}
func(e *retailEngine) brain(w http.ResponseWriter,r *http.Request){
 if !method(w,r,"GET"){return}
 w.Header().Set("Cache-Control","no-store")
 e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed{fail(w,503,"storage recovery required");return}
 f,err:=e.financeProjection();if err!=nil{fail(w,503,"finance reconciliation unavailable");return}
 report:=e.brainProjection(f,lifetimeToday(time.Now()))
 snapshot,err:=e.reviewSnapshot(report);if err!=nil{fail(w,503,"snapshot unavailable");return}
 report.Snapshot=snapshot;report.ReviewEnabled=reviewEnabled()
 respond(w,200,report)
}
