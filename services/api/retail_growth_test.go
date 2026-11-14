package main
import("encoding/json";"net/http";"testing")
func TestGrowthScenario(t *testing.T){
 p:=retailProduct{ID:"milk",Price:10000,Stock:100}
 in:=growthInput{DiscountBPS:1500,MinMarginBPS:2000,BaselineUnits:20,ExpectedUnits:40,CampaignCost:5000}
 r:=calculateGrowth(p,6500,in)
 if r.SalePrice!=8500||r.MinPrice!=8125||r.MaxDiscountBPS!=1875||r.ExpectedProfit!=75000||r.BaselineProfit!=70000||r.IncrementalProfit!=5000||r.BreakEvenUnits==nil||*r.BreakEvenUnits!=38||r.Decision!="SCENARIO_VIABLE"{t.Fatal(r)}
 in.DiscountBPS=2000
 if r=calculateGrowth(p,6500,in);r.Decision!="MARGIN_BLOCK"{t.Fatal(r)}
 in.DiscountBPS=1500;in.ExpectedUnits=101
 if r=calculateGrowth(p,6500,in);r.Decision!="STOCK_BLOCK"{t.Fatal(r)}
 in.ExpectedUnits=20
 if r=calculateGrowth(p,6500,in);r.Decision!="REVIEW_VOLUME"{t.Fatal(r)}
 p.Stock=30
 if r=calculateGrowth(p,6500,in);r.Decision!="BREAK_EVEN_UNREACHABLE"{t.Fatal(r)}
}


func TestGrowthConservativeCostAndPairs(t *testing.T){
 e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
 w:=retailCall(mux,"POST","/api/retail/inventory","growth-receipt",`{"productId":"milk","quantity":5,"unitCost":4700,"reference":"demo"}`)
 if w.Code!=201{t.Fatal(w.Code)}
 w=retailCall(mux,"POST","/api/retail/growth","",`{"productId":"milk","discountBps":1000,"minMarginBps":0,"baselineUnits":1,"expectedUnits":2,"campaignCost":0}`)
 var r growthPlan
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&r)!=nil||r.Cost!=4700||r.Decision!="MARGIN_BLOCK"{t.Fatal(w.Code,w.Body.String())}
 for _,key:=range []string{"growth-order-a","growth-order-b","growth-order-c"}{
  o:=financeOrder(t,mux,key,`{"items":[{"id":"milk","quantity":1},{"id":"bread","quantity":1}],"mode":"pickup","replacement":"skip"}`)
  if key!="growth-order-c"{financeStatus(t,mux,o.ID,"picking","packed","collected")}
 }
 w=retailCall(mux,"GET","/api/retail/growth","","")
 var g struct{Pairs []growthPair; Fulfilled int}
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&g)!=nil||g.Fulfilled!=2||len(g.Pairs)!=1||g.Pairs[0].Orders!=2||g.Pairs[0].First!="bread"||g.Pairs[0].Second!="milk"{t.Fatal(w.Code,w.Body.String())}
 if e.products[2].Stock!=22||len(e.orders)!=3{t.Fatal("planner mutated state")}
 w=retailCall(mux,"POST","/api/retail/growth","",`{"productId":"milk","discountBps":10000,"expectedUnits":1}`)
 if w.Code!=422{t.Fatal(w.Code)}
}
