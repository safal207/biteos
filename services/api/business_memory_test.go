package main

import("testing";"time")

func TestBusinessMemoryTimeAndEvidence(t *testing.T){
 entry,i,now:=observatoryFixture(t)
 i.Reason="test-demand"
 p,err:=newObservationPlan(entry,i,now);if err!=nil||p.Reason!=i.Reason||p.RecordedByRole!="owner"{t.Fatal(p,err)}
 if !validObservationPlan(p,"robys"){t.Fatal("invalid new plan")}
 legacy:=p;legacy.Reason="";legacy.RecordedByRole="";legacy.Digest=planDigest(legacy)
 if !validObservationPlan(legacy,"robys"){t.Fatal("legacy plan invalid")}
 spoof:=p;spoof.RecordedByRole="cashier";spoof.Digest=planDigest(spoof)
 if validObservationPlan(spoof,"robys"){t.Fatal("spoofed role")}
 i.Reason="arbitrary";if _,err=newObservationPlan(entry,i,now);err==nil{t.Fatal("unknown reason accepted")}
 e:=newRetailEngine();e.tenantID="robys";e.observationPlans=map[string]observationPlan{p.ID:p}
 review:=recipeReviewRecord{Version:1,ID:recipeReviewID("robys",p.Forecast.Recipe.Digest),TenantID:"robys",Snapshot:p.Forecast.Recipe,Outcome:"reviewed",RecordedAt:now.Add(-time.Second)}
 review.Digest=recipeReviewDigest(review);e.recipeReviews=map[string]recipeReviewRecord{review.ID:review}
 for days,want:=range map[int]string{0:"scheduled",1:"in-window",3:"awaiting-observation"}{
  r:=projectBusinessMemory(e,now.AddDate(0,0,days));if len(r.Rows)!=1||r.Rows[0].Status!=want||r.Rows[0].RecipeReviewDigest!=review.Digest||r.Rows[0].CausalEffectEstablished||r.ExternalEffectsAuthorized{t.Fatal(r)}
 }
 review.RecordedAt=now.Add(time.Second);review.Digest=recipeReviewDigest(review);e.recipeReviews[review.ID]=review
 if r:=projectBusinessMemory(e,now);r.Rows[0].RecipeReviewDigest!=""{t.Fatal("future review linked")}
 v,err:=newObservation(p,observedFixture(p),now.AddDate(0,0,3));if err!=nil{t.Fatal(err)}
 e.observationResults=map[string]observationResult{p.ID:v}
 r:=projectBusinessMemory(e,now.AddDate(0,0,3))
 if row:=r.Rows[0];row.Observation==nil||row.Observation.Digest!=v.Digest||row.Status!="operator-reported-unverified"||row.CausalEffectEstablished{t.Fatal(r)}
}
