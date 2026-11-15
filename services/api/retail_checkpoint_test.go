package main

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

const checkpointOrderBody = `{"items":[{"id":"milk","quantity":2}],"mode":"delivery","replacement":"skip","zoneId":"center","slotId":"center-a"}`
const checkpointReceiptBody = `{"productId":"milk","quantity":5,"unitCost":3100,"reference":"demo-invoice"}`

func checkpointMux(t *testing.T,path string)(*retailEngine,*http.ServeMux){
	t.Helper()
	e,err:=openRetailEngine(path)
	if err!=nil {t.Fatal(err)}
	mux:=http.NewServeMux()
	e.register(mux)
	return e,mux
}
func checkpointCreate(t *testing.T,mux *http.ServeMux) retailOrder {
	t.Helper()
	w:=retailCall(mux,"POST","/api/retail/orders","checkpoint-order-1",checkpointOrderBody)
	if w.Code!=201 {t.Fatal(w.Code,w.Body.String())}
	var o retailOrder
	if err:=json.Unmarshal(w.Body.Bytes(),&o);err!=nil {t.Fatal(err)}
	return o
}
func TestRetailCheckpointReopenReplay(t *testing.T){
	path:=filepath.Join(t.TempDir(),"retail.json")
	_,mux:=checkpointMux(t,path)
	o:=checkpointCreate(t,mux)
	w:=retailCall(mux,"POST","/api/retail/inventory","checkpoint-receipt-1",checkpointReceiptBody)
	if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
	e,mux:=checkpointMux(t,path)
	if e.products[2].Stock!=23||e.usedSlots["center-a"]!=1||len(e.evidence)!=2{t.Fatal("incomplete recovery")}
	w=retailCall(mux,"POST","/api/retail/orders","checkpoint-order-1",checkpointOrderBody)
	var same retailOrder
	if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&same)!=nil||same.ID!=o.ID{t.Fatal("lost replay",w.Code)}
	w=retailCall(mux,"POST","/api/retail/inventory","checkpoint-receipt-1",checkpointReceiptBody)
	if w.Code!=200||e.products[2].Stock!=23||len(e.evidence)!=2{t.Fatal("duplicate receipt",w.Code)}
	w=retailCall(mux,"POST","/api/retail/order?id="+o.ID,"",`{"status":"cancelled"}`)
	if w.Code!=200{t.Fatal(w.Code,w.Body.String())}
	e,mux=checkpointMux(t,path)
	if e.orders[o.ID].Status!="cancelled"||e.products[2].Stock!=25||e.usedSlots["center-a"]!=0||len(e.evidence)!=3{t.Fatal("lost cancellation")}
	w=retailCall(mux,"POST","/api/retail/order?id="+o.ID,"",`{"status":"cancelled"}`)
	if w.Code!=200||e.products[2].Stock!=25||len(e.evidence)!=3{t.Fatal("duplicate cancellation")}
}
func TestRetailCheckpointWriteFailureRollsBack(t *testing.T){
	path:=filepath.Join(t.TempDir(),"retail.json")
	e,mux:=checkpointMux(t,path)
	if err:=os.Mkdir(path,0700);err!=nil{t.Fatal(err)}
	w:=retailCall(mux,"POST","/api/retail/orders","checkpoint-order-1",checkpointOrderBody)
	if w.Code!=503||e.products[2].Stock!=20||len(e.orders)!=0||len(e.keys)!=0||len(e.evidence)!=0||len(e.movements)!=0||e.usedSlots["center-a"]!=0{t.Fatal("partial order",w.Code)}
	w=retailCall(mux,"POST","/api/retail/inventory","checkpoint-receipt-1",checkpointReceiptBody)
	if w.Code!=503||e.products[2].Stock!=20||len(e.receipts)!=0||len(e.evidence)!=0{t.Fatal("partial receipt",w.Code)}
	if err:=os.Remove(path);err!=nil{t.Fatal(err)}
	o:=checkpointCreate(t,mux)
	if err:=os.Rename(path,path+".previous");err!=nil{t.Fatal(err)}
	if err:=os.Mkdir(path,0700);err!=nil{t.Fatal(err)}
	w=retailCall(mux,"POST","/api/retail/order?id="+o.ID,"",`{"status":"cancelled"}`)
	if w.Code!=503||e.orders[o.ID].Status!="reserved"||e.products[2].Stock!=18||e.usedSlots["center-a"]!=1||len(e.evidence)!=1{t.Fatal("partial cancellation",w.Code)}
}
func TestRetailCheckpointRejectsCorruption(t *testing.T){
	path:=filepath.Join(t.TempDir(),"retail.json")
	_,mux:=checkpointMux(t,path)
	checkpointCreate(t,mux)
	data,err:=os.ReadFile(path)
	if err!=nil{t.Fatal(err)}
	var cp retailCheckpoint
	if err=json.Unmarshal(data,&cp);err!=nil{t.Fatal(err)}
	var s retailState
	if err=json.Unmarshal(cp.State,&s);err!=nil{t.Fatal(err)}
	s.Products[2].Stock++
	cp.State,err=json.Marshal(s)
	if err!=nil{t.Fatal(err)}
	// First reject the invalid checksum; then reject even a rehashed stock inconsistency.
	for _,rehash:=range []bool{false,true}{
		if rehash{cp.Digest=checkpointDigest(cp.State)}
		raw,err:=json.Marshal(cp)
		if err!=nil{t.Fatal(err)}
		if err=os.WriteFile(path,raw,0600);err!=nil{t.Fatal(err)}
		if _,err=openRetailEngine(path);err==nil{t.Fatal("corrupt checkpoint accepted",rehash)}
	}
}
func TestRetailCheckpointCrashWorker(t *testing.T){
	path:=os.Getenv("BITEOS_CRASH_TEST_FILE")
	if path==""{t.Skip("child process only")}
	_,mux:=checkpointMux(t,path)
	checkpointCreate(t,mux)
	if err:=os.WriteFile(path+".ready",[]byte("acknowledged"),0600);err!=nil{t.Fatal(err)}
	for {time.Sleep(time.Hour)}
}
func TestRetailCheckpointAfterProcessKill(t *testing.T){
	path:=filepath.Join(t.TempDir(),"retail.json")
	cmd:=exec.Command(os.Args[0],"-test.run=^TestRetailCheckpointCrashWorker$")
	cmd.Env=append(os.Environ(),"BITEOS_CRASH_TEST_FILE="+path)
	if err:=cmd.Start();err!=nil{t.Fatal(err)}
	defer func(){if cmd.ProcessState==nil{_ = cmd.Process.Kill();_ = cmd.Wait()}}()
	deadline:=time.Now().Add(15*time.Second)
	for {
		if _,err:=os.Stat(path+".ready");err==nil{break}
		if time.Now().After(deadline){t.Fatal("child did not acknowledge")}
		time.Sleep(20*time.Millisecond)
	}
	if err:=cmd.Process.Kill();err!=nil{t.Fatal(err)}
	if err:=cmd.Wait();err==nil{t.Fatal("expected killed child")}
	e,mux:=checkpointMux(t,path)
	w:=retailCall(mux,"POST","/api/retail/orders","checkpoint-order-1",checkpointOrderBody)
	if w.Code!=200||e.products[2].Stock!=18||len(e.orders)!=1||len(e.evidence)!=1||e.usedSlots["center-a"]!=1{t.Fatal("lost acknowledged order or duplicate effect",w.Code)}
}
