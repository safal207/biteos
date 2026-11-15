package main

import (
 "net/http"
 "sort"
 "time"
)

// Explicit operator reason codes keep the initial pilot free of personal/free-text data.
func validDecisionReason(s string)bool{
 switch s{case "","test-demand","improve-margin","reduce-waste","test-capacity","test-channel":return true}
 return false
}

type businessMemoryRow struct{
 PlanID string `json:"planId"`
 PlanDigest string `json:"planDigest"`
 ForecastDigest string `json:"forecastDigest"`
 RecipeDigest string `json:"recipeDigest"`
 RecipeReviewDigest string `json:"recipeReviewDigest,omitempty"`
 RecipeReviewOutcome string `json:"recipeReviewOutcome,omitempty"`
 Reason string `json:"reason,omitempty"`
 RecordedByRole string `json:"recordedByRole,omitempty"`
 CreatedAt time.Time `json:"createdAt"`
 StartDay string `json:"startDay"`
 EndExclusive string `json:"endExclusive"`
 ForecastDecision string `json:"forecastDecision"`
 ForecastContribution int64 `json:"forecastContribution"`
 ForecastSold int64 `json:"forecastSold"`
 Status string `json:"status"`
 Observation *observationResult `json:"observation,omitempty"`
 CausalEffectEstablished bool `json:"causalEffectEstablished"`
}
type businessMemoryReport struct{
 Version int `json:"version"`
 TenantID string `json:"tenantId"`
 Currency string `json:"currency"`
 Demo bool `json:"demo"`
 AsOf string `json:"asOf"`
 Rows []businessMemoryRow `json:"rows"`
 ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
}
func projectBusinessMemory(e *retailEngine,now time.Time)businessMemoryReport{
 report:=businessMemoryReport{Version:1,TenantID:e.tenantID,Currency:"TRY",Demo:true,AsOf:lifetimeToday(now),Rows:[]businessMemoryRow{}}
 for _,p:=range e.observationPlans{
  row:=businessMemoryRow{PlanID:p.ID,PlanDigest:p.Digest,ForecastDigest:p.Forecast.Digest,RecipeDigest:p.Forecast.Recipe.Digest,Reason:p.Reason,RecordedByRole:p.RecordedByRole,CreatedAt:p.CreatedAt,StartDay:p.StartDay,EndExclusive:p.EndExclusive,ForecastDecision:p.Forecast.Decision,ForecastContribution:p.Forecast.Campaign.Contribution,ForecastSold:p.Forecast.Campaign.Sold,Status:"scheduled"}
  // Exact same tenant/snapshot and chronologically prior review only.
  // This establishes a reference, not that the review caused the forecast.
  if v,ok:=e.recipeReviews[recipeReviewID(e.tenantID,row.RecipeDigest)];ok&&v.TenantID==e.tenantID&&v.Snapshot.Digest==row.RecipeDigest&&!v.RecordedAt.After(p.CreatedAt){
   row.RecipeReviewDigest=v.Digest;row.RecipeReviewOutcome=v.Outcome
  }
  if report.AsOf>=p.EndExclusive{row.Status="awaiting-observation"}else if report.AsOf>=p.StartDay{row.Status="in-window"}
  if v,ok:=e.observationResults[p.ID];ok&&v.Input.PlanDigest==p.Digest{
   row.Status="operator-reported-unverified";row.Observation=&v
  }
  report.Rows=append(report.Rows,row)
 }
 sort.Slice(report.Rows,func(i,j int)bool{
  a,b:=report.Rows[i],report.Rows[j]
  if !a.CreatedAt.Equal(b.CreatedAt){return a.CreatedAt.After(b.CreatedAt)}
  return a.PlanID<b.PlanID
 })
 return report
}
func serveBusinessMemory(w http.ResponseWriter,entry tenantEntry,now time.Time){
 e:=entry.engine;e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed||e.sqliteSave==nil||e.tenantID!=entry.catalog.TenantID{fail(w,503,"tenant storage unavailable");return}
 respond(w,200,projectBusinessMemory(e,now))
}
