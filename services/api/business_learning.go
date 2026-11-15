package main

import (
 "net/http"
 "sort"
 "time"
)

// Descriptive forecast diagnostics, not a trained model or causal attribution.
// Errors are actual minus forecast. Money is TRY minor units.
type learningError struct {
 PlanID string `json:"planId"`
 ObservationDigest string `json:"observationDigest"`
 StartDay string `json:"startDay"`
 EndExclusive string `json:"endExclusive"`
 ForecastSold int64 `json:"forecastSold"`
 ActualSold int64 `json:"actualSold"`
 ForecastContribution int64 `json:"forecastContribution"`
 SoldError int64 `json:"soldError"`
 RevenueError int64 `json:"revenueError"`
 IngredientCostError int64 `json:"ingredientCostError"`
 OtherCostError int64 `json:"otherCostError"`
 CampaignCostError int64 `json:"campaignCostError"`
 ContributionError int64 `json:"contributionError"`
}
type learningCohort struct {
 ForecastDigest string `json:"forecastDigest"`
 RecipeDigest string `json:"recipeDigest"`
 ItemID string `json:"itemId"`
 SampleCount int `json:"sampleCount"`
 OverlappingWindows bool `json:"overlappingWindows"`
 UnderForecastCount int `json:"underForecastCount"`
 OverForecastCount int `json:"overForecastCount"`
 SoldErrorSum int64 `json:"soldErrorSum"`
 AbsoluteSoldErrorSum int64 `json:"absoluteSoldErrorSum"`
 ContributionErrorSum int64 `json:"contributionErrorSum"`
 AbsoluteContributionErrorSum int64 `json:"absoluteContributionErrorSum"`
 // Integer basis points, nil when actual denominator is zero or windows overlap.
 SoldWAPEBPS *int64 `json:"soldWapeBps,omitempty"`
 Advisory string `json:"advisory"`
 Errors []learningError `json:"errors"`
}
type businessLearningReport struct {
 Version int `json:"version"`
 TenantID string `json:"tenantId"`
 Currency string `json:"currency"`
 Demo bool `json:"demo"`
 AsOf string `json:"asOf"`
 Completed int `json:"completed"`
 Pending int `json:"pending"`
 EvidenceStatus string `json:"evidenceStatus"`
 Cohorts []learningCohort `json:"cohorts"`
 CausalEffectEstablished bool `json:"causalEffectEstablished"`
 ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
}
func learningAbs(v int64)int64{if v<0{return -v};return v}
func learningErrors(p observationPlan,o observationResult)learningError{
 f:=p.Forecast.Campaign
 v:=learningError{PlanID:p.ID,ObservationDigest:o.Digest,StartDay:p.StartDay,EndExclusive:p.EndExclusive,ForecastSold:f.Sold,ActualSold:o.ActualSold,ForecastContribution:f.Contribution,SoldError:o.SoldForecastError,CampaignCostError:o.Input.CampaignCost-f.CampaignCost,ContributionError:o.ContributionForecastError}
 v.RevenueError=-f.Revenue;v.IngredientCostError=-f.IngredientCost;v.OtherCostError=-f.OtherCost
 for _,w:=range o.Input.Windows{v.RevenueError+=w.Revenue;v.IngredientCostError+=w.IngredientCost;v.OtherCostError+=w.OtherCost}
 return v
}
func summarizeLearning(c *learningCohort){
 sort.Slice(c.Errors,func(i,j int)bool{a,b:=c.Errors[i],c.Errors[j];if a.StartDay!=b.StartDay{return a.StartDay<b.StartDay};return a.PlanID<b.PlanID})
 c.SampleCount=len(c.Errors)
 end:=""
 for _,v:=range c.Errors{if v.StartDay<end{c.OverlappingWindows=true};if v.EndExclusive>end{end=v.EndExclusive}}
 // Do not aggregate potentially duplicate observations.
 if c.OverlappingWindows{c.Advisory="REVIEW_OVERLAPPING_WINDOWS";return}
 var actual int64
 for _,v:=range c.Errors{
  actual+=v.ActualSold;c.SoldErrorSum+=v.SoldError;c.AbsoluteSoldErrorSum+=learningAbs(v.SoldError)
  c.ContributionErrorSum+=v.ContributionError;c.AbsoluteContributionErrorSum+=learningAbs(v.ContributionError)
  if v.SoldError>0{c.UnderForecastCount++};if v.SoldError<0{c.OverForecastCount++}
 }
 if actual>0{bps:=c.AbsoluteSoldErrorSum*10000/actual;c.SoldWAPEBPS=&bps}
 switch{
 case c.SampleCount<3:c.Advisory="COLLECT_MORE_OBSERVATIONS"
 case c.OverForecastCount==c.SampleCount:c.Advisory="REVIEW_OVERFORECAST_ASSUMPTIONS"
 case c.UnderForecastCount==c.SampleCount:c.Advisory="REVIEW_UNDERFORECAST_ASSUMPTIONS"
 default:c.Advisory="REVIEW_FORECAST_VARIANCE"
 }
}
func projectBusinessLearning(e *retailEngine,now time.Time)businessLearningReport{
 report:=businessLearningReport{Version:1,TenantID:e.tenantID,Currency:"TRY",Demo:true,AsOf:lifetimeToday(now),EvidenceStatus:"operator-reported-unverified",Cohorts:[]learningCohort{}}
 groups:=map[string]*learningCohort{}
 for id,p:=range e.observationPlans{
  if p.CreatedAt.After(now){continue}
  o,ok:=e.observationResults[id]
  if !ok||o.RecordedAt.After(now)||o.Input.PlanDigest!=p.Digest{report.Pending++;continue}
  report.Completed++
  // Exact full forecast digest: same cost snapshot, assumptions and forecast,
  // not a broad grouping across products, campaigns or businesses.
  key:=p.Forecast.Digest
  c:=groups[key]
  if c==nil{c=&learningCohort{ForecastDigest:key,RecipeDigest:p.Forecast.Recipe.Digest,ItemID:p.Forecast.Assumptions.Selection.ItemID,Errors:[]learningError{}};groups[key]=c}
  c.Errors=append(c.Errors,learningErrors(p,o))
 }
 for _,c:=range groups{summarizeLearning(c);report.Cohorts=append(report.Cohorts,*c)}
 sort.Slice(report.Cohorts,func(i,j int)bool{return report.Cohorts[i].ForecastDigest<report.Cohorts[j].ForecastDigest})
 return report
}
func serveBusinessLearning(w http.ResponseWriter,entry tenantEntry,now time.Time){
 e:=entry.engine;e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed||e.sqliteSave==nil||e.tenantID!=entry.catalog.TenantID{fail(w,503,"tenant storage unavailable");return}
 respond(w,200,projectBusinessLearning(e,now))
}
