package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// Single-process checkpoint prototype. The file is replaced atomically on
// supported local filesystems; no multi-process or host-power-loss claim.
type retailState struct {
	Products []retailProduct `json:"products"`
	Orders map[string]retailOrder `json:"orders"`
	Keys map[string]retailReplay `json:"keys"`
	UsedSlots map[string]int `json:"usedSlots"`
	Movements []retailMovement `json:"movements"`
	Receipts map[string]retailReceipt `json:"receipts"`
	Evidence []retailEvidence `json:"evidence"`
}
type retailCheckpoint struct {
	Version int `json:"version"`
	State json.RawMessage `json:"state"`
	Digest string `json:"digest"`
}
func (e *retailEngine) state() retailState {
	return retailState{e.products,e.orders,e.keys,e.usedSlots,e.movements,e.receipts,e.evidence}
}
func (e *retailEngine) restore(s retailState) {
	e.products=s.Products
	e.orders=s.Orders
	e.keys=s.Keys
	e.usedSlots=s.UsedSlots
	e.movements=s.Movements
	e.receipts=s.Receipts
	e.evidence=s.Evidence
}
func checkpointDigest(b []byte) string {
	h:=sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
func validateRetailState(s retailState) error {
	if len(s.Products)==0 || s.Orders==nil || s.Keys==nil || s.UsedSlots==nil || s.Receipts==nil {
		return errors.New("missing state")
	}
	if len(s.Orders)>1000 || len(s.Receipts)>1000 || len(s.Keys)!=len(s.Orders) {
		return errors.New("invalid state cardinality")
	}
	seen:=map[string]bool{}
	stock:=map[string]int{}
	for _,p:=range newRetailEngine().products {stock[p.ID]=p.Stock}
	for _,m:=range s.Movements {
		if _,ok:=stock[m.ProductID]; !ok {return errors.New("unknown movement product")}
		if (m.Kind=="receive" || m.Kind=="release") && m.Delta>0 || m.Kind=="reserve" && m.Delta<0 {
			stock[m.ProductID]+=m.Delta
		} else {return errors.New("invalid movement")}
		if stock[m.ProductID]<0 {return errors.New("negative stock history")}
	}
	for _,p:=range s.Products {
		v,ok:=stock[p.ID]
		if !ok || p.Stock<0 || p.Stock!=v || seen[p.ID] {return errors.New("stock invariant")}
		seen[p.ID]=true
	}
	if len(seen)!=len(stock) {return errors.New("missing product")}
	used:=map[string]int{}
	orderKeys:=map[string]bool{}
	for _,v:=range s.Keys {
		if _,ok:=s.Orders[v.ID]; !ok || orderKeys[v.ID] {return errors.New("invalid replay identity")}
		orderKeys[v.ID]=true
	}
	for id,o:=range s.Orders {
		if id!=o.ID || len(o.Events)==0 || o.Events[len(o.Events)-1].Status!=o.Status {return errors.New("invalid order history")}
		if o.Mode=="delivery" {
			_,_,ok:=findRetailSlot(o.ZoneID,o.SlotID)
			if !ok {return errors.New("unknown slot")}
			if o.Status!="cancelled" {used[o.SlotID]++}
		} else if o.Mode!="pickup" || o.SlotID!="" || o.ZoneID!="" {return errors.New("invalid mode")}
	}
	for _,z:=range retailZones(){for _,slot:=range z.Slots{
		if used[slot.ID]!=s.UsedSlots[slot.ID] || used[slot.ID]>slot.Capacity {return errors.New("slot invariant")}
	}}
	for id,n:=range s.UsedSlots {if used[id]!=n {return errors.New("unknown or invalid used slot")}}
	prev:=""
	events:=map[string]bool{}
	for i,ev:=range s.Evidence {
		if ev.Version!=1 || ev.Sequence!=i+1 || ev.PreviousDigest!=prev || ev.Digest!=retailDigest(ev) || events[ev.EventID] {return errors.New("invalid evidence chain")}
		prev=ev.Digest
		events[ev.EventID]=true
	}
	expectedCount:=len(s.Receipts)
	for _,o:=range s.Orders {
		expectedCount+=len(o.Events)
		for _,ev:=range o.Events {
			if !events[o.ID+":order:"+ev.Status] {return errors.New("missing order evidence")}
		}
	}
	for i:=1;i<=len(s.Receipts);i++{
		if !events[fmt.Sprintf("receipt-%d:inventory:received",i)] {return errors.New("missing receipt evidence")}
	}
	if len(events)!=expectedCount {return errors.New("evidence cardinality")}
	return nil
}
func openRetailEngine(path string) (*retailEngine,error) {
	e:=newRetailEngine()
	e.checkpointPath=path
	if path=="" {return e,nil}
	data,err:=os.ReadFile(path)
	if errors.Is(err,os.ErrNotExist) {return e,nil}
	if err!=nil {return nil,err}
	var cp retailCheckpoint
	if err=json.Unmarshal(data,&cp);err!=nil {return nil,err}
	if cp.Version!=1 || checkpointDigest(cp.State)!=cp.Digest {return nil,errors.New("retail checkpoint checksum or version mismatch")}
	var state retailState
	if err=json.Unmarshal(cp.State,&state);err!=nil {return nil,err}
	if err=validateRetailState(state);err!=nil{return nil,err}
	e.restore(state)
	return e,nil
}
// Caller holds engine lock. This deep copy is only needed for persistent mode.
func (e *retailEngine) beforeMutation() ([]byte,error) {
	if e.checkpointPath=="" {return nil,nil}
	return json.Marshal(e.state())
}
func (e *retailEngine) commitMutation(before []byte) error {
	if e.checkpointPath=="" {return nil}
	err:=e.saveCheckpoint()
	if err!=nil {
		var previous retailState
		// before was generated from this engine under its lock.
		if decodeErr:=json.Unmarshal(before,&previous);decodeErr!=nil {panic(decodeErr)}
		e.restore(previous)
	}
	return err
}
func (e *retailEngine) saveCheckpoint() error {
	state:=e.state()
	if err:=validateRetailState(state);err!=nil{return err}
	raw,err:=json.Marshal(state)
	if err!=nil {return err}
	data,err:=json.Marshal(retailCheckpoint{1,raw,checkpointDigest(raw)})
	if err!=nil {return err}
	dir:=filepath.Dir(e.checkpointPath)
	if err=os.MkdirAll(dir,0700);err!=nil {return err}
	f,err:=os.CreateTemp(dir,"retail-*.tmp")
	if err!=nil {return err}
	defer os.Remove(f.Name())
	if _,err=f.Write(data);err==nil {err=f.Sync()}
	closeErr:=f.Close()
	if err==nil {err=closeErr}
	if err!=nil {return err}
	// Rename is the process-crash commit boundary, not an independent
	// durable LiminalDB acknowledgement. Directory fsync/host failure
	// and non-atomic filesystems are outside this prototype.
	return os.Rename(f.Name(),e.checkpointPath)
}
