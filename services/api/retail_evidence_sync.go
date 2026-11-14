package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

type evidenceImportItem struct {
	Event retailEvidence `json:"event"`
	Canonical string `json:"canonical"`
}
type evidenceImportBatch struct {
	Schema string `json:"schema"`
	Stream string `json:"stream"`
	Events []evidenceImportItem `json:"events"`
}
type evidenceImportReceipt struct {
	Schema string `json:"schema"`
	Stream string `json:"stream"`
	Count int `json:"count"`
	Head string `json:"head"`
	Inserted int `json:"inserted"`
	Replayed int `json:"replayed"`
	ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
}

func validEvidenceStream(s string)bool{
	if len(s)<1||len(s)>64{return false}
	for _,r:=range s{if !(r>='a'&&r<='z'||r>='A'&&r<='Z'||r>='0'&&r<='9'||r=='-'||r=='_'){return false}}
	return true
}
func(e *retailEngine) evidenceBatch(stream string)(evidenceImportBatch,error){
	e.mu.Lock()
	defer e.mu.Unlock()
	b:=evidenceImportBatch{Schema:"biteos.evidence.batch.v1",Stream:stream,Events:[]evidenceImportItem{}}
	if !validEvidenceStream(stream)||e.sqliteSave==nil||e.storageFailed{return b,errors.New("healthy SQLite store and explicit stream required")}
	if err:=validateRetailState(e.state());err!=nil{return b,err}
	for _,ev:=range e.evidence{
		canonical:=ev
		canonical.Digest=""
		raw,err:=json.Marshal(canonical)
		if err!=nil{return b,err}
		b.Events=append(b.Events,evidenceImportItem{ev,string(raw)})
	}
	return b,nil
}
func verifyImportReceipt(b evidenceImportBatch,r evidenceImportReceipt)error{
	head:=""
	if len(b.Events)>0{head=b.Events[len(b.Events)-1].Event.Digest}
	if r.Schema!="biteos.evidence.receipt.v1"||r.Stream!=b.Stream||r.Count!=len(b.Events)||r.Head!=head||r.Inserted<0||r.Replayed<0||r.Inserted>r.Count||r.Replayed>r.Count||r.Inserted+r.Replayed!=r.Count||r.ExternalEffectsAuthorized{return errors.New("LiminalDB receipt mismatch")}
	return nil
}
// Operator-only offline command. No network or public mutation endpoint.
// Source and target remain separate, and no evidence is removed after receipt.
func syncRetailEvidence(ctx context.Context,e *retailEngine,stream,importer,root string)(evidenceImportReceipt,error){
	var r evidenceImportReceipt
	b,err:=e.evidenceBatch(stream)
	if err!=nil{return r,err}
	if strings.TrimSpace(importer)==""||strings.TrimSpace(root)==""{return r,errors.New("explicit importer executable and ledger root required")}
	raw,err:=json.Marshal(b);if err!=nil{return r,err}
	cmd:=exec.CommandContext(ctx,importer,root)
	cmd.Stdin=bytes.NewReader(raw)
	cmd.Stderr=os.Stderr
	out,err:=cmd.Output()
	if err!=nil{return r,fmt.Errorf("LiminalDB import not acknowledged: %w",err)}
	if err=json.Unmarshal(out,&r);err!=nil{return r,err}
	if err=verifyImportReceipt(b,r);err!=nil{return r,err}
	return r,nil
}
func runRetailEvidenceCommand()error{
	path:=os.Getenv("RETAIL_STORE")
	if path==""||os.Getenv("RETAIL_BACKEND")!="sqlite"{return errors.New("set RETAIL_BACKEND=sqlite and explicit RETAIL_STORE")}
	if _,err:=os.Stat(path);err!=nil{return fmt.Errorf("existing SQLite source required: %w",err)}
	e,err:=openSQLiteRetailEngine(path)
	if err!=nil{return err}
	ctx,cancel:=context.WithTimeout(context.Background(),2*time.Minute)
	defer cancel()
	r,err:=syncRetailEvidence(ctx,e,os.Getenv("RETAIL_EVIDENCE_STREAM"),os.Getenv("LIMINALDB_IMPORTER"),os.Getenv("LIMINALDB_EVIDENCE_ROOT"))
	if err!=nil{return err}
	return json.NewEncoder(os.Stdout).Encode(r)
}
