package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"
)

// Local, in-memory outbox proof. Business commits and events share the engine lock.
// No durable acknowledgement, external authority, or LiminalDB write is claimed.
type retailEvidence struct {
	Version int `json:"version"`
	EventID string `json:"eventId"`
	ActionID string `json:"actionId"`
	Kind string `json:"kind"`
	Sequence int `json:"sequence"`
	AggregateVersion int `json:"aggregateVersion"`
	Status string `json:"status"`
	CapturedAt time.Time `json:"capturedAt"`
	PreviousDigest string `json:"previousDigest"`
	Digest string `json:"digest"`
}

func retailDigest(ev retailEvidence) string {
	ev.Digest = ""
	data, _ := json.Marshal(ev)
	sum := sha256.Sum256(data)
	return "sha256:" + hex.EncodeToString(sum[:])
}

// Caller holds e.mu. Only internal opaque IDs and enum state are exported.
// No customer info, idempotency keys, supplier references, or payment claims.
func(e *retailEngine) emitEvidence(actionID,kind,status string,version int) {
	seq:=len(e.evidence)+1
	prev:=""
	if seq>1 {prev=e.evidence[seq-2].Digest}
	ev:=retailEvidence{Version:1, EventID:actionID+":"+kind+":"+status, ActionID:actionID, Kind:kind, Sequence:seq, AggregateVersion:version, Status:status, CapturedAt:time.Now().UTC(), PreviousDigest:prev}
	ev.Digest=retailDigest(ev)
	e.evidence=append(e.evidence,ev)
}

// A bounded review endpoint; never signals external delivery or durability.
func(e *retailEngine) evidenceReport(w http.ResponseWriter,r *http.Request){
	if !method(w,r,"GET"){return}
	e.mu.Lock()
	defer e.mu.Unlock()
	events:=e.evidence
	if len(events)>100 {events=events[len(events)-100:]}
	respond(w,200,map[string]any{"demo":true,"durable":false,"externalAcknowledged":false,"events":events})
}

// Conservative decision proposal, not authority or permission to execute.
func retailRecoveryPosture(readback string) string {
	switch readback {
	case "ONE_EFFECT_MATCHING": return "REPORT_ONLY"
	case "ONE_EFFECT_MISMATCHED","MULTIPLE_EFFECTS": return "BLOCKED"
	default: return "REVALIDATE"
	}
}
