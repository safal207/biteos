package main

import (
 "encoding/json"
 "errors"
 "net/http"
 "sort"
 "time"
)

type observationPlanInput struct{
 ID string `json:"id"`
 StartDay string `json:"startDay"`
 ExpectedDigest string `json:"expectedDigest"`
 Scenario economicInput `json:"scenario"`
 Reason string `json:"reason,omitempty"`
}
type observationPlan struct{
 Version int `json:"version"`
 ID string `json:"id"`
 TenantID string `json:"tenantId"`
 StartDay string `json:"startDay"`
 EndExclusive string `json:"endExclusive"`
 CreatedAt time.Time `json:"createdAt"`
 Forecast economicReport `json:"forecast"`
 Digest string `json:"digest"`
 Reason string `json:"reason,omitempty"`
 RecordedByRole string `json:"recordedByRole,omitempty"`
}
type observedWindow struct{
 ID string `json:"id"`
 Visits int64 `json:"visits"`
 Sold int64 `json:"sold"`
 Revenue int64 `json:"revenue"`
 IngredientCost int64 `json:"ingredientCost"`
 OtherCost int64 `json:"otherCost"`
}
type observationInput struct{
 PlanID string `json:"planId"`
 PlanDigest string `json:"planDigest"`
 Source string `json:"source"`
 Windows []observedWindow `json:"windows"`
 CampaignCost int64 `json:"campaignCost"`
}
type observationResult struct{
 Version int `json:"version"`
 TenantID string `json:"tenantId"`
 Input observationInput `json:"input"`
 RecordedAt time.Time `json:"recordedAt"`
 ActualVisits int64 `json:"actualVisits"`
 ActualSold int64 `json:"actualSold"`
 ActualContribution int64 `json:"actualContribution"`
 ContributionForecastError int64 `json:"contributionForecastError"`
 SoldForecastError int64 `json:"soldForecastError"`
 EvidenceStatus string `json:"evidenceStatus"`
 CausalEffectEstablished bool `json:"causalEffectEstablished"`
 ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
 Digest string `json:"digest"`
}
func obsBytes(v any)string{b,_:=json.Marshal(v);return string(b)}
func planDigest(p observationPlan)string{p.Digest="";return checkpointDigest([]byte(obsBytes(p)))}
func observationDigest(r observationResult)string{r.Digest="";return checkpointDigest([]byte(obsBytes(r)))}
func observationEnd(start string,days int)string{
 if !validLifetimeDay(start)||days<1||days>7{return ""}
 t,err:=time.Parse("2006-01-02",start);if err!=nil{return ""}
 end:=t.AddDate(0,0,days).Format("2006-01-02")
 if !validLifetimeDay(end){return ""}
 return end
}
func newObservationPlan(entry tenantEntry,i observationPlanInput,now time.Time)(observationPlan,error){
 p:=observationPlan{Version:1,ID:i.ID,TenantID:entry.catalog.TenantID,StartDay:i.StartDay,EndExclusive:observationEnd(i.StartDay,i.Scenario.Days),CreatedAt:now.UTC(),Reason:i.Reason,RecordedByRole:"owner"}
 today:=lifetimeToday(now)
 t,_:=time.Parse("2006-01-02",today)
 if !validDecisionReason(i.Reason)||!validTenantID(i.ID)||p.EndExclusive==""||i.StartDay<=today||i.StartDay>t.AddDate(0,0,90).Format("2006-01-02")||!reviewHex(i.ExpectedDigest){return p,errors.New("plan requires a future dated window")}
 r,err:=calculateEconomic(entry.catalog,entry.recipes,i.Scenario)
 if err!=nil{return p,err}
 if r.Digest!=i.ExpectedDigest{return p,errors.New("forecast changed")}
 p.Forecast=r;p.Digest=planDigest(p)
 return p,nil
}
func validObservationPlan(p observationPlan,tenant string)bool{
 if !validDecisionReason(p.Reason)||(p.RecordedByRole!=""&&p.RecordedByRole!="owner")||(p.Reason!=""&&p.RecordedByRole!="owner"){return false}
 if p.Version!=1||p.TenantID!=tenant||!validTenantID(p.ID)||p.CreatedAt.IsZero()||p.StartDay<=lifetimeToday(p.CreatedAt)||p.EndExclusive==""||p.EndExclusive!=observationEnd(p.StartDay,p.Forecast.Assumptions.Days)||p.Digest!=planDigest(p){return false}
 t,err:=time.Parse("2006-01-02",lifetimeToday(p.CreatedAt));if err!=nil||p.StartDay>t.AddDate(0,0,90).Format("2006-01-02"){return false}
 r,err:=economicFromSnapshot(p.Forecast.Recipe,p.Forecast.Assumptions,tenant)
 return err==nil&&obsBytes(r)==obsBytes(p.Forecast)
}
func newObservation(p observationPlan,i observationInput,now time.Time)(observationResult,error){
 r:=observationResult{Version:1,TenantID:p.TenantID,Input:i,RecordedAt:now.UTC(),EvidenceStatus:"operator-reported-unverified"}
 bad:=errors.New("invalid or premature aggregate observation")
 if i.PlanID!=p.ID||i.PlanDigest!=p.Digest||lifetimeToday(now)<p.EndExclusive||i.CampaignCost<0||i.CampaignCost>10000000000||len(i.Windows)!=len(p.Forecast.Assumptions.Windows){return r,bad}
 if i.Source!="manual-tally"&&i.Source!="pos-summary"{return r,bad}
 for idx,w:=range i.Windows{
  if w.ID!=p.Forecast.Assumptions.Windows[idx].ID||w.Visits<0||w.Visits>100000||w.Sold<0||w.Sold>w.Visits||w.Revenue<0||w.Revenue>10000000000000||w.IngredientCost<0||w.IngredientCost>10000000000000||w.OtherCost<0||w.OtherCost>10000000000000||w.Sold==0&&(w.Revenue!=0||w.IngredientCost!=0||w.OtherCost!=0){return r,bad}
  r.ActualVisits+=w.Visits;r.ActualSold+=w.Sold
  r.ActualContribution+=w.Revenue-w.IngredientCost-w.OtherCost
 }
 r.ActualContribution-=i.CampaignCost
 r.ContributionForecastError=r.ActualContribution-p.Forecast.Campaign.Contribution
 r.SoldForecastError=r.ActualSold-p.Forecast.Campaign.Sold
 r.Digest=observationDigest(r)
 return r,nil
}
func validateObservatory(plans map[string]observationPlan,results map[string]observationResult,tenant string)error{
 bad:=errors.New("invalid observatory history")
 if len(plans)>64||len(results)>len(plans)||len(plans)>0&&!validTenantID(tenant){return bad}
 for id,p:=range plans{if id!=p.ID||!validObservationPlan(p,tenant){return bad}}
 for id,r:=range results{
  p,ok:=plans[id];if !ok||r.RecordedAt.IsZero(){return bad}
  expected,err:=newObservation(p,r.Input,r.RecordedAt)
  if err!=nil||obsBytes(expected)!=obsBytes(r){return bad}
 }
 return nil
}
func serveObservatory(w http.ResponseWriter,r *http.Request,entry tenantEntry,op string){
 serveObservatoryAt(w,r,entry,op,time.Now())
}
func serveObservatoryAt(w http.ResponseWriter,r *http.Request,entry tenantEntry,op string,now time.Time){
 e:=entry.engine
 var plan observationPlanInput;var observed observationInput
 if op=="plan"&&!retailDecode(w,r,&plan){return}
 if op=="observation"&&!retailDecode(w,r,&observed){return}
 e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed||e.sqliteSave==nil||e.tenantID!=entry.catalog.TenantID{fail(w,503,"tenant storage unavailable");return}
 switch op{
 case "list":
  plans:=[]observationPlan{};results:=[]observationResult{}
  for _,p:=range e.observationPlans{plans=append(plans,p)}
  for _,v:=range e.observationResults{results=append(results,v)}
  sort.Slice(plans,func(i,j int)bool{return plans[i].ID<plans[j].ID})
  sort.Slice(results,func(i,j int)bool{return results[i].Input.PlanID<results[j].Input.PlanID})
  respond(w,200,map[string]any{"demo":true,"tenantId":e.tenantID,"plans":plans,"observations":results,"causalEffectEstablished":false,"externalEffectsAuthorized":false})
 case "plan":
  if old,ok:=e.observationPlans[plan.ID];ok{
   plan.Scenario.Selection=canonicalRecipeSelection(plan.Scenario.Selection)
   if old.StartDay!=plan.StartDay||old.Reason!=plan.Reason||old.Forecast.Digest!=plan.ExpectedDigest||obsBytes(old.Forecast.Assumptions)!=obsBytes(plan.Scenario){fail(w,409,"plan immutable");return}
   respond(w,200,old);return
  }
  p,err:=newObservationPlan(entry,plan,now);if err!=nil{fail(w,422,err.Error());return}
  if len(e.observationPlans)>=64{fail(w,503,"plan capacity reached");return}
  before,err:=e.beforeMutation();if err!=nil{fail(w,503,"checkpoint unavailable");return}
  if e.observationPlans==nil{e.observationPlans=map[string]observationPlan{}}
  e.observationPlans[p.ID]=p
  if err=e.commitMutation(before);err!=nil{fail(w,503,"checkpoint unavailable");return}
  respond(w,201,p)
 case "observation":
  p,ok:=e.observationPlans[observed.PlanID];if !ok{fail(w,404,"plan unavailable");return}
  if old,ok:=e.observationResults[p.ID];ok{
   if obsBytes(old.Input)!=obsBytes(observed){fail(w,409,"observation immutable");return}
   respond(w,200,old);return
  }
  result,err:=newObservation(p,observed,now);if err!=nil{fail(w,422,err.Error());return}
  before,err:=e.beforeMutation();if err!=nil{fail(w,503,"checkpoint unavailable");return}
  if e.observationResults==nil{e.observationResults=map[string]observationResult{}}
  e.observationResults[p.ID]=result
  if err=e.commitMutation(before);err!=nil{fail(w,503,"checkpoint unavailable");return}
  respond(w,201,result)
 default:fail(w,404,"observatory operation unavailable")
 }
}
