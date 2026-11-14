package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

func retailCall(mux http.Handler, method, path, key, body string) *httptest.ResponseRecorder {
	w:=httptest.NewRecorder()
	req:=httptest.NewRequest(method,path,bytes.NewBufferString(body))
	req.Header.Set("Idempotency-Key",key)
	mux.ServeHTTP(w,req)
	return w
}
func TestRetailReserveReplayCancel(t *testing.T) {
	e:=newRetailEngine()
	mux:=http.NewServeMux()
	e.register(mux)
	body:=`{"items":[{"id":"milk","quantity":2}],"mode":"delivery","replacement":"contact","zoneId":"center","slotId":"center-a"}`
	w:=retailCall(mux,"POST","/api/retail/orders","demo-key-1",body)
	if w.Code!=201 {t.Fatal(w.Code,w.Body.String())}
	var o retailOrder
	if err:=json.Unmarshal(w.Body.Bytes(),&o);err!=nil {t.Fatal(err)}
	if o.Total!=13300 || o.Currency!="TRY" || e.products[2].Stock!=18 {t.Fatal(o,e.products[2])}
	w=retailCall(mux,"POST","/api/retail/orders","demo-key-1",body)
	if w.Code!=200 || e.products[2].Stock!=18 {t.Fatal("replay changed stock",w.Code)}
	w=retailCall(mux,"POST","/api/retail/orders","demo-key-1",`{"items":[{"id":"milk","quantity":1}],"mode":"pickup","replacement":"skip"}`)
	if w.Code!=409 {t.Fatal("key conflict",w.Code)}
	path:="/api/retail/order?id="+o.ID
	if w=retailCall(mux,"POST",path,"",`{"status":"delivered"}`);w.Code!=409 {t.Fatal("invalid transition",w.Code)}
	for i:=0;i<2;i++ {if w=retailCall(mux,"POST",path,"",`{"status":"cancelled"}`);w.Code!=200 {t.Fatal(w.Code)}}
	if e.products[2].Stock!=20 {t.Fatal("wrong restored stock",e.products[2])}
}
func TestRetailConcurrentLastStock(t *testing.T) {
	e:=newRetailEngine()
	e.products[0].Stock=1
	mux:=http.NewServeMux()
	e.register(mux)
	body:=`{"items":[{"id":"avocado","quantity":1}],"mode":"pickup","replacement":"skip"}`
	var wg sync.WaitGroup
	results:=make(chan int,2)
	for _,key:=range []string{"request-a","request-b"} {
		wg.Add(1)
		go func(k string){defer wg.Done();results<-retailCall(mux,"POST","/api/retail/orders",k,body).Code}(key)
	}
	wg.Wait()
	close(results)
	count:=map[int]int{}
	for code:=range results {count[code]++}
	if count[201]!=1 || count[409]!=1 || e.products[0].Stock!=0 {t.Fatal(count)}
}
func TestRetailFailedBasketDoesNotChangeStock(t *testing.T) {
	e:=newRetailEngine()
	mux:=http.NewServeMux()
	e.register(mux)
	body:=`{"items":[{"id":"milk","quantity":1},{"id":"missing","quantity":1}],"mode":"pickup","replacement":"skip"}`
	w:=retailCall(mux,"POST","/api/retail/orders","demo-key-2",body)
	if w.Code!=422 || e.products[2].Stock!=20 {t.Fatal(w.Code,e.products[2])}
}

func TestRetailDeliveryCapacityAndCancellation(t *testing.T) {
	e:=newRetailEngine()
	mux:=http.NewServeMux()
	e.register(mux)
	body:=`{"items":[{"id":"milk","quantity":2}],"mode":"delivery","replacement":"skip","zoneId":"center","slotId":"center-a"}`
	var first retailOrder
	for _,key:=range []string{"capacity-a","capacity-b","capacity-c"} {
		w:=retailCall(mux,"POST","/api/retail/orders",key,body)
		if w.Code!=201 {t.Fatal(w.Code,w.Body.String())}
		if first.ID=="" {if err:=json.Unmarshal(w.Body.Bytes(),&first);err!=nil{t.Fatal(err)}}
	}
	w:=retailCall(mux,"POST","/api/retail/orders","capacity-d",body)
	if w.Code!=409 || e.products[2].Stock!=14 {t.Fatal(w.Code,e.products[2])}
	w=retailCall(mux,"POST","/api/retail/order?id="+first.ID,"",`{"status":"cancelled"}`)
	if w.Code!=200 {t.Fatal(w.Code)}
	w=retailCall(mux,"POST","/api/retail/orders","capacity-d",body)
	if w.Code!=201 || e.usedSlots["center-a"]!=3 {t.Fatal(w.Code,e.usedSlots)}
}
func TestRetailDeliveryValidation(t *testing.T) {
	e:=newRetailEngine()
	mux:=http.NewServeMux()
	e.register(mux)
	for _,b:=range []string{
		`{"items":[{"id":"milk","quantity":1}],"mode":"delivery","replacement":"skip","zoneId":"outer","slotId":"outer-a"}`,
		`{"items":[{"id":"milk","quantity":4}],"mode":"delivery","replacement":"skip","zoneId":"outer","slotId":"center-a"}`,
		`{"items":[{"id":"milk","quantity":1}],"mode":"pickup","replacement":"skip","zoneId":"center","slotId":"center-a"}`,
	}{
		w:=retailCall(mux,"POST","/api/retail/orders","validation-a",b)
		if w.Code!=422 || e.products[2].Stock!=20 || len(e.movements)!=0 {t.Fatal(w.Code)}
	}
}
func TestRetailReceivingReplay(t *testing.T) {
	e:=newRetailEngine()
	mux:=http.NewServeMux()
	e.register(mux)
	body:=`{"productId":"milk","quantity":5,"unitCost":3100,"reference":"demo-invoice"}`
	for i,want:=range []int{201,200}{
		w:=retailCall(mux,"POST","/api/retail/inventory","receiving-1",body)
		if w.Code!=want || e.products[2].Stock!=25 || len(e.movements)!=1 {t.Fatal(i,w.Code)}
	}
	w:=retailCall(mux,"POST","/api/retail/inventory","receiving-1",`{"productId":"milk","quantity":6,"unitCost":3100,"reference":"demo-invoice"}`)
	if w.Code!=409 || e.products[2].Stock!=25 {t.Fatal(w.Code)}
	if e.movements[0].UnitCost!=3100 || e.movements[0].Delta!=5 {t.Fatal(e.movements)}
}
