package main

import("testing";"time")

func TestLearningForecastDiagnostics(t *testing.T){
 entry,in,now:=observatoryFixture(t)
 e:=newRetailEngine();e.tenantID="robys";e.observationPlans=map[string]observationPlan{};e.observationResults=map[string]observationResult{}
 for idx,id:=range []string{"learning-a","learning-b","learning-c"}{
  v:=in;v.ID=id;v.StartDay=now.AddDate(0,0,1+idx*3).Format("2006-01-02")
  p,err:=newObservationPlan(entry,v,now);if err!=nil{t.Fatal(err)}
  o,err:=newObservation(p,observedFixture(p),now.AddDate(0,0,3+idx*3));if err!=nil{t.Fatal(err)}
  e.observationPlans[id]=p;e.observationResults[id]=o
 }
 before:=obsBytes(e.state())
 r:=projectBusinessLearning(e,now.AddDate(0,0,9))
 if r.Completed!=3||r.Pending!=0||len(r.Cohorts)!=1||r.CausalEffectEstablished||r.ExternalEffectsAuthorized{t.Fatal(r)}
 c:=r.Cohorts[0]
 if c.SampleCount!=3||c.OverlappingWindows||c.OverForecastCount!=3||c.SoldErrorSum!=-15||c.AbsoluteSoldErrorSum!=15||c.ContributionErrorSum!=-61800||c.AbsoluteContributionErrorSum!=61800||c.SoldWAPEBPS==nil||*c.SoldWAPEBPS!=909||c.Advisory!="REVIEW_OVERFORECAST_ASSUMPTIONS"{t.Fatal(c)}
 for _,v:=range c.Errors{if v.RevenueError-v.IngredientCostError-v.OtherCostError-v.CampaignCostError!=v.ContributionError{t.Fatal("decomposition",v)}}
 if obsBytes(e.state())!=before{t.Fatal("learning mutated history")}
 early:=projectBusinessLearning(e,now.AddDate(0,0,4))
 if early.Completed!=1||early.Pending!=2||early.Cohorts[0].Advisory!="COLLECT_MORE_OBSERVATIONS"{t.Fatal(early)}
 // A different plan with the same date/forecast may count the same sales.
 p:=e.observationPlans["learning-a"];p.ID="learning-overlap";p.Digest=planDigest(p)
 o,err:=newObservation(p,observedFixture(p),now.AddDate(0,0,3));if err!=nil{t.Fatal(err)}
 e.observationPlans[p.ID]=p;e.observationResults[p.ID]=o
 r=projectBusinessLearning(e,now.AddDate(0,0,9));c=r.Cohorts[0]
 if !c.OverlappingWindows||c.Advisory!="REVIEW_OVERLAPPING_WINDOWS"||c.SoldWAPEBPS!=nil||c.SoldErrorSum!=0{t.Fatal(c)}
}
func TestLearningZeroActualAndExactScenario(t *testing.T){
 c:=learningCohort{Errors:[]learningError{{PlanID:"one",StartDay:"2026-11-15",EndExclusive:"2026-11-17",SoldError:-2}}}
 summarizeLearning(&c);if c.SoldWAPEBPS!=nil||c.Advisory!="COLLECT_MORE_OBSERVATIONS"{t.Fatal(c)}
 entry,in,now:=observatoryFixture(t)
 p,err:=newObservationPlan(entry,in,now);if err!=nil{t.Fatal(err)}
 v:=in;v.ID="another";v.Scenario.DiscountBPS=0
 forecast,err:=calculateEconomic(entry.catalog,entry.recipes,v.Scenario);if err!=nil{t.Fatal(err)}
 v.ExpectedDigest=forecast.Digest
 q,err:=newObservationPlan(entry,v,now);if err!=nil{t.Fatal(err)}
 e:=newRetailEngine();e.tenantID="robys";e.observationPlans=map[string]observationPlan{p.ID:p,q.ID:q};e.observationResults=map[string]observationResult{}
 for _,plan:=range []observationPlan{p,q}{o,err:=newObservation(plan,observedFixture(plan),now.Add(72*time.Hour));if err!=nil{t.Fatal(err)};e.observationResults[plan.ID]=o}
 r:=projectBusinessLearning(e,now.Add(72*time.Hour));if len(r.Cohorts)!=2{t.Fatal("different forecasts mixed",r)}
}
