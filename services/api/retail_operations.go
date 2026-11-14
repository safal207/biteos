package main

import (
	"encoding/json"
	"crypto/sha256"
	"net/http"
	"fmt"
	"strings"
	"time"
)

type retailSlot struct {
	ID string `json:"id"`
	Label string `json:"label"`
	Capacity int `json:"capacity"`
	Remaining int `json:"remaining"`
}
type retailZone struct {
	ID string `json:"id"`
	Name string `json:"name"`
	Fee int64 `json:"fee"`
	Minimum int64 `json:"minimum"`
	Slots []retailSlot `json:"slots"`
}
// Fictional windows and prices, not actual service areas or ETA promises.
func retailZones() []retailZone {
	return []retailZone{
		{"center","Gazipaşa · merkez",3500,5000,[]retailSlot{{"center-a","10:00–12:00",3,3},{"center-b","16:00–18:00",5,5}}},
		{"outer","Gazipaşa · çevre",6500,15000,[]retailSlot{{"outer-a","12:00–14:00",2,2},{"outer-b","18:00–20:00",3,3}}},
	}
}
func findRetailSlot(zoneID,slotID string)(retailZone,retailSlot,bool){
	for _,z:=range retailZones(){if z.ID==zoneID{for _,s:=range z.Slots{if s.ID==slotID{return z,s,true}}}}
	return retailZone{},retailSlot{},false
}
func(e *retailEngine) delivery(w http.ResponseWriter,r *http.Request){
	if !method(w,r,"GET"){return}
	e.mu.Lock()
	defer e.mu.Unlock()
	zones:=retailZones()
	for i:=range zones{for j:=range zones[i].Slots{s:=&zones[i].Slots[j];s.Remaining=s.Capacity-e.usedSlots[s.ID]}}
	respond(w,200,map[string]any{"demo":true,"currency":"TRY","zones":zones})
}

type retailMovement struct {
	ProductID string `json:"productId"`
	Kind string `json:"kind"`
	Delta int `json:"delta"`
	Reference string `json:"reference"`
	UnitCost int64 `json:"unitCost,omitempty"`
	At time.Time `json:"at"`
}
type retailReceipt struct{
	Hash [32]byte
	Movement retailMovement
}
type retailReceiving struct {
	ProductID string `json:"productId"`
	Quantity int `json:"quantity"`
	UnitCost int64 `json:"unitCost"`
	Reference string `json:"reference"`
}
func(e *retailEngine) recordMovement(id,kind string,delta int,reference string,cost int64) retailMovement {
	m:=retailMovement{id,kind,delta,reference,cost,time.Now().UTC()}
	e.movements=append(e.movements,m)
	return m
}
// Demo only: no authentication. Do not deploy this API publicly.
func(e *retailEngine) inventory(w http.ResponseWriter,r *http.Request){
	if r.Method=="GET"{
		e.mu.Lock()
		defer e.mu.Unlock()
		movements:=e.movements
		if len(movements)>100 {movements=movements[len(movements)-100:]}
		respond(w,200,map[string]any{"demo":true,"products":e.products,"movements":movements})
		return
	}
	if r.Method!="POST"{w.Header().Set("Allow","GET, POST");fail(w,405,"method not allowed");return}
	var req retailReceiving
	if !retailDecode(w,r,&req){return}
	key:=r.Header.Get("Idempotency-Key")
	if len(key)<8||len(key)>128||req.Quantity<1||req.Quantity>1000||req.UnitCost<1||req.UnitCost>100000000||strings.TrimSpace(req.Reference)==""||len(req.Reference)>128{fail(w,422,"invalid receipt");return}
	data,_:=json.Marshal(req)
	hash:=sha256.Sum256(data)
	e.mu.Lock()
	defer e.mu.Unlock()
	if old,ok:=e.receipts[key];ok{
		if old.Hash!=hash{fail(w,409,"receipt key conflict");return}
		respond(w,200,old.Movement);return
	}
	if len(e.receipts)>=1000{fail(w,503,"demo capacity reached");return}
	for i,p:=range e.products{
		if p.ID==req.ProductID{
			if p.Stock>100000-req.Quantity{fail(w,422,"stock limit exceeded");return}
			before,err:=e.beforeMutation()
			if err!=nil {fail(w,503,"checkpoint unavailable");return}
			e.products[i].Stock+=req.Quantity
			m:=e.recordMovement(p.ID,"receive",req.Quantity,req.Reference,req.UnitCost)
			e.receipts[key]=retailReceipt{hash,m}
			e.emitEvidence(fmt.Sprintf("receipt-%d",len(e.receipts)),"inventory","received",1)
			if err=e.commitMutation(before);err!=nil {fail(w,503,"checkpoint unavailable");return}
			respond(w,201,m);return
		}
	}
	fail(w,404,"unknown product")
}
