//go:build sqlite && cgo

package main

import (
 "encoding/json"
 "testing"
 "time"
)

func TestOwnerJourneyThroughTenantGateway(t *testing.T){
 root:=t.TempDir();config:=tenantFixture()
 g,err:=openTenantGateway(root,config);if err!=nil{t.Fatal(err)}
 base:="/api/tenants/robys/retail/";token:=config[1].Token
 call:=func(method,path string,body any,want int)[]byte{
  t.Helper();raw:="";if body!=nil{raw=obsBytes(body)}
  w:=tenantCall(g,method,base+path,token,"",raw)
  if w.Code!=want{t.Fatalf("%s %s: %d != %d: %s",method,path,w.Code,want,w.Body.String())}
  return w.Body.Bytes()
 }
 var catalog universalCatalog
 if err=json.Unmarshal(call("GET","universal-catalog",nil,200),&catalog);err!=nil||catalog.TenantID!="robys"{t.Fatal(catalog,err)}
 selection:=universalQuoteInput{"latte","regular",1,nil}
 var snapshot recipeSnapshot
 if err=json.Unmarshal(call("POST","recipe-cost/snapshot",selection,200),&snapshot);err!=nil||!validRecipeSnapshot(snapshot,"robys"){t.Fatal(snapshot,err)}
 before:=g.entries["robys"].engine.state()
 review:=recipeReviewInput{selection,snapshot.Digest,"reviewed"}
 original:=call("POST","recipe-cost/review",review,201)
 replay:=call("POST","recipe-cost/review",review,200)
 if string(original)!=string(replay){t.Fatal("review replay changed receipt")}
 i:=economicFixture()
 var forecast economicReport
 if err=json.Unmarshal(call("POST","economic-intelligence",i,200),&forecast);err!=nil||forecast.Recipe.Digest!=snapshot.Digest||forecast.ExternalEffectsAuthorized{t.Fatal(forecast,err)}
 day,err:=time.Parse("2006-01-02",lifetimeToday(time.Now()));if err!=nil{t.Fatal(err)}
 plan:=observationPlanInput{"owner-journey",day.AddDate(0,0,1).Format("2006-01-02"),forecast.Digest,i,"test-demand"}
 var p observationPlan
 if err=json.Unmarshal(call("POST","observatory/plan",plan,201),&p);err!=nil||p.Forecast.Digest!=forecast.Digest{t.Fatal(p,err)}
 if raw:=call("POST","observatory/plan",plan,200);string(raw)!=obsBytes(p)+"\n"&&string(raw)!=obsBytes(p){t.Fatal("plan replay changed receipt")}
 call("POST","observatory/observation",observedFixture(p),422)
 after:=g.entries["robys"].engine.state()
 after.RecipeReviews=nil;after.ObservationPlans=nil;after.ObservationResults=nil
 if obsBytes(before)!=obsBytes(after){t.Fatal("owner journey mutated commerce")}
 g,err=openTenantGateway(root,config);if err!=nil{t.Fatal(err)}
 var history struct{Plans []observationPlan;Observations []observationResult;CausalEffectEstablished bool;ExternalEffectsAuthorized bool}
 if err=json.Unmarshal(call("GET","observatory",nil,200),&history);err!=nil||len(history.Plans)!=1||history.Plans[0].Digest!=p.Digest||len(history.Observations)!=0||history.CausalEffectEstablished||history.ExternalEffectsAuthorized{t.Fatal(history,err)}
 var memory businessMemoryReport
 if err=json.Unmarshal(call("GET","business-memory",nil,200),&memory);err!=nil||len(memory.Rows)!=1||memory.Rows[0].ForecastDigest!=forecast.Digest||memory.Rows[0].RecipeReviewDigest==""||memory.Rows[0].Reason!="test-demand"||memory.Rows[0].RecordedByRole!="owner"||memory.Rows[0].CausalEffectEstablished||memory.ExternalEffectsAuthorized{t.Fatal(memory,err)}
 if w:=tenantCall(g,"GET",base+"business-memory",config[0].Token,"","");w.Code!=401{t.Fatal("foreign memory access",w.Code)}
 if len(g.entries["robys"].engine.recipeReviews)!=1||len(g.entries["rozal"].engine.recipeReviews)!=0||len(g.entries["rozal"].engine.observationPlans)!=0{t.Fatal("review or tenant isolation")}
}
