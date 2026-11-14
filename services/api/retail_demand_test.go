package main

import("encoding/json";"net/http";"path/filepath";"testing")

func TestDemandReopenAndReplay(t *testing.T){
 path:=filepath.Join(t.TempDir(),"retail.json")
 e,mux:=checkpointMux(t,path)
 body:=`{"candidateId":"kefir","quantity":3}`
 w:=retailCall(mux,"POST","/api/retail/demand","demand-signal-1",body)
 if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
 e,mux=checkpointMux(t,path)
 w=retailCall(mux,"POST","/api/retail/demand","demand-signal-1",body)
 if w.Code!=200||len(e.demandSignals)!=1||len(e.evidence)!=0||len(e.orders)!=0{t.Fatal("replay mutated state",w.Code)}
 w=retailCall(mux,"POST","/api/retail/demand","demand-signal-1",`{"candidateId":"kefir","quantity":4}`)
 if w.Code!=409{t.Fatal(w.Code)}
 w=retailCall(mux,"POST","/api/retail/demand","demand-signal-2",`{"candidateId":"unknown","quantity":1}`)
 if w.Code!=422{t.Fatal(w.Code)}
 w=retailCall(mux,"GET","/api/retail/demand","","")
 var r struct{Candidates []demandCandidate;UniqueCustomersKnown bool}
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&r)!=nil||r.UniqueCustomersKnown||r.Candidates[0].Requests!=1||r.Candidates[0].Units!=3{t.Fatal(w.Code,w.Body.String())}
}
func TestDemandBatchScenario(t *testing.T){
 i:=demandPlanInput{CandidateID:"kefir",BatchUnits:30,UnitCost:4000,SalePrice:6500,ExpectedSold:24,FixedCost:10000,MinMarginBPS:2000}
 p:=calculateDemand(i,8,18)
 if p.Investment!=130000||p.Revenue!=156000||p.Contribution!=26000||p.BreakEvenUnits!=20||p.UnsoldCost!=24000||p.Decision!="PILOT_REVIEW"{t.Fatal(p)}
 i.ExpectedSold=10
 if p=calculateDemand(i,8,18);p.Decision!="REVIEW_SELL_THROUGH"{t.Fatal(p)}
 i.ExpectedSold=24
 if p=calculateDemand(i,0,0);p.Decision!="NO_SIGNAL"{t.Fatal(p)}
 i.SalePrice=4100
 if p=calculateDemand(i,8,18);p.Decision!="MARGIN_BLOCK"{t.Fatal(p)}
 i.SalePrice=6500;i.FixedCost=100000
 if p=calculateDemand(i,8,18);p.Decision!="BATCH_UNVIABLE"{t.Fatal(p)}
}
func TestDemandPlanValidation(t *testing.T){
 e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
 w:=retailCall(mux,"POST","/api/retail/demand/plan","",`{"candidateId":"kefir","batchUnits":10,"unitCost":4000,"salePrice":6500,"expectedSold":11,"fixedCost":0,"minMarginBps":2000}`)
 if w.Code!=422{t.Fatal(w.Code)}
 w=retailCall(mux,"POST","/api/retail/demand/plan","",`{"candidateId":"kefir","batchUnits":10,"unitCost":4000,"salePrice":6500,"expectedSold":10,"fixedCost":0,"minMarginBps":2000}`)
 if w.Code!=200||len(e.orders)!=0||len(e.demandSignals)!=0||len(e.evidence)!=0{t.Fatal(w.Code)}
}
