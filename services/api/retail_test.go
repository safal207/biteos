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
	body:=`{"items":[{"id":"milk","quantity":2}],"mode":"delivery","replacement":"contact"}`
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
