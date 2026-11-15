package main

import("testing";"time")
func observatoryFixture(t *testing.T)(tenantEntry,observationPlanInput,time.Time){
 t.Helper()
 c,err:=defaultUniversal("robys");if err!=nil{t.Fatal(err)}
 b,err:=loadRecipeBook(t.TempDir(),c);if err!=nil{t.Fatal(err)}
 entry:=tenantEntry{catalog:c,recipes:b}
 i:=economicFixture();r,err:=calculateEconomic(c,b,i);if err!=nil{t.Fatal(err)}
 return entry,observationPlanInput{"nov-pilot","2026-11-15",r.Digest,i,""},time.Date(2026,11,14,10,0,0,0,time.UTC)
}
func observedFixture(p observationPlan)observationInput{
 return observationInput{PlanID:p.ID,PlanDigest:p.Digest,Source:"manual-tally",CampaignCost:10000,Windows:[]observedWindow{
 {"morning",100,24,194400,76800,12000},
 {"delivery",50,18,145800,57600,21600},
 {"next-day",50,13,105300,41600,6500},
 }}
}
func TestObservatoryFrozenForecast(t *testing.T){
 entry,i,now:=observatoryFixture(t)
 p,err:=newObservationPlan(entry,i,now)
 if err!=nil||p.EndExclusive!="2026-11-17"||!validObservationPlan(p,"robys"){t.Fatal(p,err)}
 input:=observedFixture(p)
 if _,err=newObservation(p,input,now.AddDate(0,0,2));err==nil{t.Fatal("premature observation")}
 r,err:=newObservation(p,input,now.AddDate(0,0,3))
 if err!=nil||r.ActualVisits!=200||r.ActualSold!=55||r.ActualContribution!=219400||r.ContributionForecastError!=-20600||r.SoldForecastError!=-5||r.CausalEffectEstablished||r.ExternalEffectsAuthorized{t.Fatal(r,err)}
 if err=validateObservatory(map[string]observationPlan{p.ID:p},map[string]observationResult{p.ID:r},"robys");err!=nil{t.Fatal(err)}
 r.ActualContribution++;r.Digest=observationDigest(r)
 if validateObservatory(map[string]observationPlan{p.ID:p},map[string]observationResult{p.ID:r},"robys")==nil{t.Fatal("invalid arithmetic accepted")}
 p.Forecast.Campaign.Contribution++;p.Forecast.Digest=economicDigest(p.Forecast);p.Digest=planDigest(p)
 if validObservationPlan(p,"robys"){t.Fatal("altered forecast accepted")}
}
func TestObservatoryRejectsUnsupportedInputs(t *testing.T){
 entry,i,now:=observatoryFixture(t)
 for _,edit:=range []func(*observationPlanInput){
  func(i *observationPlanInput){i.StartDay="2026-11-14"},
  func(i *observationPlanInput){i.StartDay="2027-03-01"},
  func(i *observationPlanInput){i.ExpectedDigest=checkpointDigest([]byte("stale"))},
 }{v:=i;edit(&v);if _,err:=newObservationPlan(entry,v,now);err==nil{t.Fatal("bad plan",v)}}
 p,err:=newObservationPlan(entry,i,now);if err!=nil{t.Fatal(err)}
 for _,edit:=range []func(*observationInput){
  func(i *observationInput){i.PlanDigest="wrong"},
  func(i *observationInput){i.Source="verified"},
  func(i *observationInput){i.Windows=i.Windows[:2]},
  func(i *observationInput){i.Windows[0].ID="foreign"},
  func(i *observationInput){i.Windows[0].Sold=101},
  func(i *observationInput){i.Windows[0].Revenue=-1},
 }{v:=observedFixture(p);edit(&v);if _,err:=newObservation(p,v,now.AddDate(0,0,3));err==nil{t.Fatal("bad observation",v)}}
}
