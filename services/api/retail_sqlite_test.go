//go:build sqlite && cgo

package main

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func sqliteMux(t *testing.T,path string)(*retailEngine,*http.ServeMux){
	t.Helper()
	e,err:=openSQLiteRetailEngine(path)
	if err!=nil{t.Fatal(err)}
	mux:=http.NewServeMux()
	e.register(mux)
	return e,mux
}
func TestRetailSQLiteReopenAndOutbox(t *testing.T){
	path:=filepath.Join(t.TempDir(),"retail.db")
	_,mux:=sqliteMux(t,path)
	o:=checkpointCreate(t,mux)
	w:=retailCall(mux,"POST","/api/retail/inventory","checkpoint-receipt-1",checkpointReceiptBody)
	if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
	e,mux:=sqliteMux(t,path)
	if e.products[2].Stock!=23||len(e.evidence)!=2||e.usedSlots["center-a"]!=1{t.Fatal("reopen mismatch")}
	w=retailCall(mux,"POST","/api/retail/orders","checkpoint-order-1",checkpointOrderBody)
	var got retailOrder
	if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&got)!=nil||got.ID!=o.ID{t.Fatal("lost idempotency",w.Code)}
	w=retailCall(mux,"POST","/api/retail/inventory","checkpoint-receipt-1",checkpointReceiptBody)
	if w.Code!=200||len(e.evidence)!=2{t.Fatal("duplicate evidence")}
	w=retailCall(mux,"POST","/api/retail/order?id="+o.ID,"",`{"status":"cancelled"}`)
	if w.Code!=200{t.Fatal(w.Code,w.Body.String())}
	e,_=sqliteMux(t,path)
	if e.products[2].Stock!=25||e.usedSlots["center-a"]!=0||e.orders[o.ID].Status!="cancelled"||len(e.evidence)!=3{t.Fatal("cancellation mismatch")}
	// An outbox record may not silently disappear.
	c,err:=connectRetailSQL(path)
	if err!=nil{t.Fatal(err)}
	err=c.exec("DELETE FROM retail_outbox WHERE seq=2")
	c.close()
	if err!=nil{t.Fatal(err)}
	if _,err=openSQLiteRetailEngine(path);err==nil{t.Fatal("inconsistent outbox accepted")}
}
func TestRetailSQLiteTransactionFailure(t *testing.T){
	path:=filepath.Join(t.TempDir(),"retail.db")
	e,mux:=sqliteMux(t,path)
	c,err:=connectRetailSQL(path)
	if err!=nil{t.Fatal(err)}
	err=c.exec("CREATE TRIGGER reject_event BEFORE INSERT ON retail_outbox BEGIN SELECT RAISE(ABORT, 'injected failure'); END")
	c.close()
	if err!=nil{t.Fatal(err)}
	w:=retailCall(mux,"POST","/api/retail/orders","checkpoint-order-1",checkpointOrderBody)
	if w.Code!=503||!e.storageFailed||len(e.orders)!=0||len(e.evidence)!=0||e.products[2].Stock!=20{t.Fatal("partial transaction",w.Code)}
	if w=retailCall(mux,"GET","/api/retail/catalog","","");w.Code!=503{t.Fatal("stale reads after failure",w.Code)}
	reopened,_:=sqliteMux(t,path)
	if len(reopened.orders)!=0||len(reopened.evidence)!=0||reopened.products[2].Stock!=20{t.Fatal("sqlite transaction partially committed")}
}
func TestRetailSQLiteStaleWriter(t *testing.T){
	path:=filepath.Join(t.TempDir(),"retail.db")
	_,winner:=sqliteMux(t,path)
	stale,loser:=sqliteMux(t,path)
	checkpointCreate(t,winner)
	w:=retailCall(loser,"POST","/api/retail/orders","another-order",checkpointOrderBody)
	if w.Code!=503||!stale.storageFailed{t.Fatal("stale writer not fenced",w.Code)}
	e,_:=sqliteMux(t,path)
	if len(e.orders)!=1||e.products[2].Stock!=18||len(e.evidence)!=1{t.Fatal("winner lost")}
}
func TestRetailSQLiteRejectExistingEmpty(t *testing.T){
	path:=filepath.Join(t.TempDir(),"retail.db")
	if err:=os.WriteFile(path,nil,0600);err!=nil{t.Fatal(err)}
	if _,err:=openSQLiteRetailEngine(path);err==nil{t.Fatal("existing empty store silently seeded")}
}
// Child is killed immediately after acknowledging the first order.
func TestRetailSQLiteCrashWorker(t *testing.T){
	path:=os.Getenv("BITEOS_SQLITE_CRASH_FILE")
	if path==""{t.Skip("child process only")}
	_,mux:=sqliteMux(t,path)
	checkpointCreate(t,mux)
	p,err:=os.FindProcess(os.Getpid())
	if err!=nil{t.Fatal(err)}
	if err=p.Kill();err!=nil{t.Fatal(err)}
}
func TestRetailSQLiteProcessKill(t *testing.T){
	path:=filepath.Join(t.TempDir(),"retail.db")
	cmd:=exec.Command(os.Args[0],"-test.run=^TestRetailSQLiteCrashWorker$")
	cmd.Env=append(os.Environ(),"BITEOS_SQLITE_CRASH_FILE="+path)
	if err:=cmd.Run();err==nil{t.Fatal("expected killed child")}
	e,mux:=sqliteMux(t,path)
	w:=retailCall(mux,"POST","/api/retail/orders","checkpoint-order-1",checkpointOrderBody)
	if w.Code!=200||len(e.orders)!=1||len(e.evidence)!=1||e.products[2].Stock!=18||e.usedSlots["center-a"]!=1{t.Fatal("lost acknowledged order",w.Code)}
}

func TestRetailSQLiteEvidenceSyncFixture(t *testing.T){
	path:=os.Getenv("BITEOS_SQLITE_SYNC_FILE")
	if path==""{t.Skip("native bridge fixture only")}
	e,mux:=sqliteMux(t,path)
	checkpointCreate(t,mux)
	w:=retailCall(mux,"POST","/api/retail/inventory","checkpoint-receipt-1",checkpointReceiptBody)
	if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
	b,err:=e.evidenceBatch("ci-store")
	if err!=nil||len(b.Events)!=2{t.Fatal(err)}
	r:=evidenceImportReceipt{Schema:"biteos.evidence.receipt.v1",Stream:b.Stream,Count:2,Head:b.Events[1].Event.Digest,Inserted:2}
	if err=verifyImportReceipt(b,r);err!=nil{t.Fatal(err)}
	r.ExternalEffectsAuthorized=true
	if err=verifyImportReceipt(b,r);err==nil{t.Fatal("storage receipt granted external authority")}
}

func TestRetailSQLiteDemandReplay(t *testing.T){
 path:=filepath.Join(t.TempDir(),"demand.db")
 _,mux:=sqliteMux(t,path)
 body:=`{"candidateId":"tvorog","quantity":2}`
 w:=retailCall(mux,"POST","/api/retail/demand","sqlite-demand-1",body)
 if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
 e,mux:=sqliteMux(t,path)
 w=retailCall(mux,"POST","/api/retail/demand","sqlite-demand-1",body)
 if w.Code!=200||len(e.demandSignals)!=1||len(e.evidence)!=0{t.Fatal("demand replay",w.Code)}
 checkpointCreate(t,mux)
 e,_=sqliteMux(t,path)
 if len(e.demandSignals)!=1||len(e.orders)!=1||len(e.evidence)!=1{t.Fatal("demand/order isolation")}
}

func TestRetailSQLiteReviewReplay(t *testing.T){
 t.Setenv("BITEOS_REVIEW_TOKEN",testReviewCredential)
 path:=filepath.Join(t.TempDir(),"review.db")
 _,mux:=sqliteMux(t,path)
 b:=readBrain(t,mux)
 body:=reviewBody(b.Snapshot,b.Decisions[0].ID,"reviewed")
 w:=reviewCall(mux,"POST","/api/retail/brain/review",testReviewCredential,body)
 if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
 e,mux:=sqliteMux(t,path)
 w=reviewCall(mux,"POST","/api/retail/brain/review",testReviewCredential,body)
 if w.Code!=200||len(e.reviews)!=1||len(e.evidence)!=0{t.Fatal("review reopen",w.Code)}
 if readBrain(t,mux).Snapshot!=b.Snapshot{t.Fatal("review-only snapshot drift")}
}
