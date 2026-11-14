package main

import (
	"encoding/json"
	"net/http"
	"os"
	"testing"
)

func TestRetailEvidenceSequenceAndReplay(t *testing.T) {
	e:=newRetailEngine()
	mux:=http.NewServeMux()
	e.register(mux)
	body:=`{"items":[{"id":"milk","quantity":2}],"mode":"delivery","replacement":"skip","zoneId":"center","slotId":"center-a"}`
	w:=retailCall(mux,"POST","/api/retail/orders","evidence-order-1",body)
	if w.Code!=201 {t.Fatal(w.Code,w.Body.String())}
	var o retailOrder
	if err:=json.Unmarshal(w.Body.Bytes(),&o);err!=nil {t.Fatal(err)}
	if w=retailCall(mux,"POST","/api/retail/orders","evidence-order-1",body);w.Code!=200 {t.Fatal(w.Code)}
	if len(e.evidence)!=1 {t.Fatal("duplicate evidence")}
	path:="/api/retail/order?id="+o.ID
	if w=retailCall(mux,"POST",path,"",`{"status":"delivered"}`);w.Code!=409 {t.Fatal(w.Code)}
	if w=retailCall(mux,"POST",path,"",`{"status":"cancelled"}`);w.Code!=200 {t.Fatal(w.Code)}
	if w=retailCall(mux,"POST",path,"",`{"status":"cancelled"}`);w.Code!=200 {t.Fatal(w.Code)}
	receipt:=`{"productId":"milk","quantity":3,"unitCost":3100,"reference":"not-exported"}`
	for _,want:=range []int{201,200}{
		if w=retailCall(mux,"POST","/api/retail/inventory","evidence-receipt-1",receipt);w.Code!=want {t.Fatal(w.Code)}
	}
	if len(e.evidence)!=3 {t.Fatal("event count",len(e.evidence))}
	prev:=""
	for i,ev:=range e.evidence {
		if ev.Sequence!=i+1||ev.PreviousDigest!=prev||ev.Digest!=retailDigest(ev){t.Fatal("invalid chain",ev)}
		prev=ev.Digest
	}
	if e.evidence[1].ActionID!=o.ID||e.evidence[1].AggregateVersion!=2||e.products[2].Stock!=23 {t.Fatal("business or aggregate mismatch")}
	tampered:=e.evidence[0]
	tampered.Status="delivered"
	if retailDigest(tampered)==tampered.Digest {t.Fatal("tamper undetected")}
	w=retailCall(mux,"GET","/api/retail/evidence","","")
	var report struct{
		Durable bool `json:"durable"`
		ExternalAcknowledged bool `json:"externalAcknowledged"`
		Events []retailEvidence `json:"events"`
	}
	if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&report)!=nil||report.Durable||report.ExternalAcknowledged||len(report.Events)!=3 {t.Fatal("bad report",w.Body.String())}
	if path:=os.Getenv("BITEOS_EVIDENCE_FIXTURE");path!=""{
		// Export the accepted internal reservation claim and its canonical hash input.
		ev:=e.evidence[0]
		canonical:=ev
		canonical.Digest=""
		raw,err:=json.Marshal(canonical)
		if err!=nil{t.Fatal(err)}
		data,err:=json.Marshal(map[string]any{"claim":ev,"canonical":string(raw),"readback":"UNAVAILABLE"})
		if err!=nil{t.Fatal(err)}
		if err=os.WriteFile(path,data,0600);err!=nil{t.Fatal(err)}
	}
}
func TestRetailRecoveryConservative(t *testing.T){
	for input,want:=range map[string]string{
		"UNAVAILABLE":"REVALIDATE","NO_EFFECT":"REVALIDATE","CLAIM_ONLY":"REVALIDATE","":"REVALIDATE",
		"ONE_EFFECT_MATCHING":"REPORT_ONLY","ONE_EFFECT_MISMATCHED":"BLOCKED","MULTIPLE_EFFECTS_MATCHING":"BLOCKED",
	}{
		if got:=retailRecoveryPosture(input);got!=want{t.Fatalf("%s: %s != %s",input,got,want)}
	}
}
