package main

import ("encoding/json";"net/http";"reflect";"testing")
func TestTwinTemporalCounterfactual(t *testing.T){
 p:=twinProduct{ID:"milk",Price:6500,Lots:[]twinLot{{Quantity:10,Cost:4000,UseBy:"2026-11-16"}}}
 in:=twinInput{ProductID:"milk",Days:3,BaselineDailyUnits:2,CampaignDailyUnits:5,DiscountBPS:1000,FulfillmentPerUnit:300,CampaignCost:1000}
 before:=append([]twinLot(nil),p.Lots...)
 r:=calculateTwin(p,in,"2026-11-14")
 if r.Baseline.Sold!=4||r.Baseline.Unmet!=2||r.Baseline.HeldValue!=24000||r.Baseline.Contribution!=8800{t.Fatal(r.Baseline)}
 if r.Campaign.Sold!=10||r.Campaign.Unmet!=5||r.Campaign.HeldValue!=0||r.Campaign.Contribution!=14500||r.IncrementalContribution!=5700||r.AvoidedHeldValue!=24000{t.Fatal(r.Campaign,r)}
 if r.Baseline.Daily[2].Sold!=0||!reflect.DeepEqual(before,p.Lots){t.Fatal("simulation changed source")}
 var n int64;for _,d:=range r.Campaign.Daily{n+=d.Contribution};if n!=r.Campaign.Contribution{t.Fatal("daily reconciliation")}
}
func TestTwinUnknownAndFIFOBarrier(t *testing.T){
 p:=twinProduct{ID:"milk",Price:4900,Lots:[]twinLot{{Quantity:2,Cost:3100},{Quantity:4,Cost:3200,UseBy:"2026-11-20"}}}
 i:=twinInput{ProductID:"milk",Days:1,CampaignDailyUnits:3}
 r:=calculateTwin(p,i,"2026-11-14")
 if r.Campaign.Sold!=0||r.Campaign.UnknownValue!=6200{t.Fatal(r)}
 i.IncludeUnknown=true
 r=calculateTwin(p,i,"2026-11-14")
 if r.Campaign.Sold!=3||r.Campaign.COGS!=9400{t.Fatal(r)}
 p.Lots[0].UseBy="2026-11-14"
 r=calculateTwin(p,i,"2026-11-14")
 if r.Campaign.Sold!=0||r.Campaign.HeldValue!=6200{t.Fatal(r)}
}
func TestTwinAPIReadOnly(t *testing.T){
 e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
 before,_:=json.Marshal(e.state())
 w:=retailCall(mux,"POST","/api/retail/twin","",`{"productId":"milk","days":7,"baselineDailyUnits":1,"campaignDailyUnits":2,"discountBps":1000,"fulfillmentPerUnit":0,"campaignCost":0,"includeUnknown":true}`)
 var r twinResult
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&r)!=nil||r.Baseline.Sold!=7||r.Campaign.Sold!=14{t.Fatal(w.Code,w.Body.String())}
 after,_:=json.Marshal(e.state());if string(before)!=string(after){t.Fatal("simulation mutated state")}
 w=retailCall(mux,"POST","/api/retail/twin","",`{"productId":"milk","days":31}`)
 if w.Code!=422{t.Fatal(w.Code)}
}
