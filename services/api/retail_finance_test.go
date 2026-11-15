package main

import (
	"encoding/json"
	"net/http"
	"testing"
)
func financeRead(t *testing.T,mux *http.ServeMux) financeReport{
	t.Helper()
	w:=retailCall(mux,"GET","/api/retail/finance","","")
	var r financeReport
	if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&r)!=nil {t.Fatal(w.Code,w.Body.String())}
	return r
}
func financeOrder(t *testing.T,mux *http.ServeMux,key,body string)retailOrder{
	t.Helper()
	w:=retailCall(mux,"POST","/api/retail/orders",key,body)
	var o retailOrder
	if w.Code!=201||json.Unmarshal(w.Body.Bytes(),&o)!=nil{t.Fatal(w.Code,w.Body.String())}
	return o
}
func financeStatus(t *testing.T,mux *http.ServeMux,id string,states ...string){
	t.Helper()
	for _,s:=range states{
		w:=retailCall(mux,"POST","/api/retail/order?id="+id,"",`{"status":"`+s+`"}`)
		if w.Code!=200{t.Fatal(w.Code,w.Body.String())}
	}
}
func TestRetailFinanceFulfillment(t *testing.T){
	e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
	o:=financeOrder(t,mux,"finance-order-1",checkpointOrderBody)
	r:=financeRead(t,mux)
	if r.Open!=1||r.Revenue!=0||r.COGS!=0||r.ReservedValue!=6200{t.Fatal(r)}
	financeStatus(t,mux,o.ID,"picking","packed","in_transit","delivered")
	r=financeRead(t,mux)
	if r.Fulfilled!=1||r.Open!=0||r.Revenue!=9800||r.COGS!=6200||r.GrossProfit!=3600||r.DeliveryFees!=3500||r.DeliveryCost!=4500||r.Contribution!=2600||r.ReservedValue!=0{t.Fatal(r)}
	financeStatus(t,mux,o.ID,"delivered")
	s:=financeRead(t,mux)
	if s.Revenue!=r.Revenue||s.Contribution!=r.Contribution{t.Fatal("duplicate fulfillment revenue",s)}
}
func TestRetailFinanceOriginalLotsAfterCancellation(t *testing.T){
	e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
	a:=financeOrder(t,mux,"finance-first",`{"items":[{"id":"milk","quantity":20}],"mode":"pickup","replacement":"skip"}`)
	w:=retailCall(mux,"POST","/api/retail/inventory","finance-receipt",`{"productId":"milk","quantity":5,"unitCost":5000,"reference":"demo"}`)
	if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
	b:=financeOrder(t,mux,"finance-second",`{"items":[{"id":"milk","quantity":2}],"mode":"pickup","replacement":"skip"}`)
	financeStatus(t,mux,a.ID,"cancelled")
	financeStatus(t,mux,b.ID,"picking","packed","collected")
	c:=financeOrder(t,mux,"finance-third",`{"items":[{"id":"milk","quantity":2}],"mode":"pickup","replacement":"skip"}`)
	financeStatus(t,mux,c.ID,"picking","packed","collected")
	r:=financeRead(t,mux)
	if r.Fulfilled!=2||r.Cancelled!=1||r.Revenue!=19600||r.COGS!=16200||r.GrossProfit!=3400||r.ReservedValue!=0{t.Fatal(r)}
	for _,p:=range r.Products{if p.ID=="milk"&&(p.AvailableStock!=21||p.AvailableValue!=70800||p.UnitsSold!=4){t.Fatal(p)}}
}
func TestRetailFinanceInvalidHistory(t *testing.T){
	e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
	o:=financeOrder(t,mux,"finance-order-2",checkpointOrderBody)
	o.Subtotal++
	e.orders[o.ID]=o
	w:=retailCall(mux,"GET","/api/retail/finance","","")
	if w.Code!=503{t.Fatal("bad totals accepted",w.Code)}
}
