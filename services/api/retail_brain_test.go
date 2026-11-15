package main

import ("encoding/json";"net/http";"reflect";"testing")
func TestBrainOrderingAndEvidence(t *testing.T){
 e:=newRetailEngine()
 mux:=http.NewServeMux();e.register(mux)
 w:=retailCall(mux,"POST","/api/retail/demand","brain-demand-1",`{"candidateId":"kefir","quantity":3}`)
 if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
 o:=financeOrder(t,mux,"brain-stock-order",`{"items":[{"id":"avocado","quantity":17}],"mode":"pickup","replacement":"skip"}`)
 financeStatus(t,mux,o.ID,"picking","packed","collected")
 f,err:=e.financeProjection();if err!=nil{t.Fatal(err)}
 // Isolated projection fixture; change only the replayed lot, not engine state.
 f.availableLots["milk"][0].useBy="2026-11-14"
 f.availableLots["bread"][0].useBy="2026-11-15"
 r:=e.brainProjection(f,"2026-11-14")
 if r.ExternalEffectsAuthorized||r.Mode!="review-only"||r.EvidenceHead==""||len(r.Decisions)==0||r.Decisions[0].Rule!="HOLD_LOT"{t.Fatal(r)}
 seen:=map[string]brainDecision{}
 for idx,d:=range r.Decisions{
  if idx>0&&r.Decisions[idx-1].Priority>d.Priority{t.Fatal("priority order")}
  if _,ok:=seen[d.ID];ok{t.Fatal("duplicate decision")}
  seen[d.ID]=d
 }
 if seen["REVIEW_DEMAND:kefir"].Facts[1].Value!=3||seen["REVIEW_LOW_STOCK:avocado"].Facts[0].Value!=1||seen["REVIEW_EXPIRY:opening-bread"].Rule!="REVIEW_EXPIRY"{t.Fatal(seen)}
 if !reflect.DeepEqual(r,e.brainProjection(f,"2026-11-14")){t.Fatal("not repeatable")}
}
func TestBrainNoMutationAndFailure(t *testing.T){
 e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
 before,_:=json.Marshal(e.state())
 w:=retailCall(mux,"GET","/api/retail/brain","","")
 var r brainReport
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&r)!=nil||r.ExternalEffectsAuthorized||r.Fulfilled!=0||w.Header().Get("Cache-Control")!="no-store"{t.Fatal(w.Code,w.Body.String())}
 after,_:=json.Marshal(e.state());if string(before)!=string(after){t.Fatal("review mutated state")}
 w=retailCall(mux,"POST","/api/retail/brain","","{}");if w.Code!=405{t.Fatal(w.Code)}
 e.products[0].Stock++
 w=retailCall(mux,"GET","/api/retail/brain","","");if w.Code!=503{t.Fatal("inconsistent stock accepted",w.Code)}
}
func TestBrainDeliveryAndReservedSafety(t *testing.T){
 e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
 o:=financeOrder(t,mux,"brain-delivery",checkpointOrderBody)
 financeStatus(t,mux,o.ID,"picking","packed","in_transit","delivered")
 open:=financeOrder(t,mux,"brain-open-pickup",`{"items":[{"id":"milk","quantity":1}],"mode":"pickup","replacement":"skip"}`)
 f,err:=e.financeProjection();if err!=nil{t.Fatal(err)}
 f.orderUseBy[open.ID]="2026-11-14"
 r:=e.brainProjection(f,"2026-11-14")
 foundHold,foundCost:=false,false
 for _,d:=range r.Decisions{
  if d.Rule=="HOLD_OPEN_ORDER"&&d.Subject==open.ID{foundHold=d.Priority==0}
  if d.Rule=="REVIEW_DELIVERY_COST"{foundCost=d.Facts[0].Value==3500&&d.Facts[1].Value==4500}
 }
 if !foundHold||!foundCost{t.Fatal(r)}
}
