package main

import("encoding/json";"net/http";"path/filepath";"testing";"time")
func TestLifetimeCalendar(t *testing.T){
 if validLifetimeDay("2026-02-29")||!validLifetimeDay("2028-02-29"){t.Fatal("invalid civil dates")}
 if lifetimeToday(time.Date(2026,11,14,21,0,0,0,time.UTC))!="2026-11-15"{t.Fatal("TRT day")}
 for day,want:=range map[string]string{"":"UNKNOWN","2026-11-13":"HOLD","2026-11-14":"HOLD","2026-11-15":"REVIEW_SOON","2026-11-16":"REVIEW_SOON","2026-11-17":"DATED"}{
  if got:=lifetimeStatus(day,"2026-11-14");got!=want{t.Fatal(day,got)}
 }
}
func TestLifetimeReceiveProjectionReopen(t *testing.T){
 path:=filepath.Join(t.TempDir(),"lifetime.json")
 _,mux:=checkpointMux(t,path)
 today:=lifetimeToday(time.Now())
 dt,_:=time.Parse("2006-01-02",today)
 tomorrow:=dt.AddDate(0,0,1).Format("2006-01-02")
 body:=`{"productId":"milk","quantity":5,"unitCost":3100,"reference":"dated-demo","useBy":"`+tomorrow+`"}`
 w:=retailCall(mux,"POST","/api/retail/inventory","lifetime-receipt",body)
 if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
 e,mux:=checkpointMux(t,path)
 w=retailCall(mux,"POST","/api/retail/inventory","lifetime-receipt",body)
 if w.Code!=200||len(e.movements)!=1||e.movements[0].UseBy!=tomorrow{t.Fatal("dated replay",w.Code)}
 f,err:=e.financeProjection();if err!=nil{t.Fatal(err)}
 r:=e.lifetimeProjection(f,today)
 if r.ReviewValue!=15500||r.HeldValue!=0{t.Fatal(r)}
 for _,row:=range r.Rows{if row.UseBy==tomorrow&&(!row.ReviewEligible||row.ReviewPrice!=3920){t.Fatal(row)}}
 r=e.lifetimeProjection(f,tomorrow)
 if r.HeldValue!=15500||r.ReviewValue!=0{t.Fatal(r)}
 for _,row:=range r.Rows{if row.Status=="HOLD"&&row.ReviewEligible{t.Fatal("held offer")}}
 w=retailCall(mux,"GET","/api/retail/lifetime","","")
 var report lifetimeReport
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&report)!=nil||!report.Demo{t.Fatal(w.Code)}
}
func TestLifetimeFIFOAndFulfillmentGate(t *testing.T){
 e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
 before:=e.products[2].Stock
 // Exhaust unknown opening milk; add a future dated lot through the real API.
 first:=financeOrder(t,mux,"lifetime-first",`{"items":[{"id":"milk","quantity":20}],"mode":"pickup","replacement":"skip"}`)
 financeStatus(t,mux,first.ID,"picking","packed","collected")
 dt,_:=time.Parse("2006-01-02",lifetimeToday(time.Now()))
 tomorrow:=dt.AddDate(0,0,1).Format("2006-01-02")
 body:=`{"productId":"milk","quantity":5,"unitCost":3100,"reference":"demo","useBy":"`+tomorrow+`"}`
 w:=retailCall(mux,"POST","/api/retail/inventory","lifetime-gate-receipt",body)
 if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
 o:=financeOrder(t,mux,"lifetime-second",`{"items":[{"id":"milk","quantity":2}],"mode":"pickup","replacement":"skip"}`)
 f,err:=e.financeProjection();if err!=nil||f.orderUseBy[o.ID]!=tomorrow{t.Fatal(err)}
 if !lifetimeCanReserve(f.availableLots["milk"],3,dt.Format("2006-01-02"))||lifetimeCanReserve(f.availableLots["milk"],1,tomorrow){t.Fatal("FIFO expiry")}
 // Simulated passage of time through a test-only dated movement rewrite.
 for i:=range e.movements{if e.movements[i].Kind=="receive"{e.movements[i].UseBy=dt.Format("2006-01-02")}}
 w=retailCall(mux,"POST","/api/retail/order?id="+o.ID,"",`{"status":"picking"}`)
 if w.Code!=409{t.Fatal("expired reserved lot advanced",w.Code,w.Body.String())}
 w=retailCall(mux,"POST","/api/retail/orders","lifetime-third",`{"items":[{"id":"milk","quantity":1}],"mode":"pickup","replacement":"skip"}`)
 if w.Code!=409{t.Fatal("expired lot reserved",w.Code)}
 financeStatus(t,mux,o.ID,"cancelled")
 if e.products[2].Stock!=before-20+5{t.Fatal("stock wrong after cancel")}
}
