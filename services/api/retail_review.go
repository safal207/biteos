package main

import (
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "encoding/json"
 "errors"
 "net/http"
 "os"
 "sort"
 "time"
)

// Shared local-demo review credential, not a staff identity or execution grant.
func reviewEnabled()bool{return len(os.Getenv("BITEOS_REVIEW_TOKEN"))>=32}
func reviewAuthorized(r *http.Request)bool{
 token:=os.Getenv("BITEOS_REVIEW_TOKEN")
 if len(token)<32{return false}
 want:=sha256.Sum256([]byte("Bearer "+token))
 got:=sha256.Sum256([]byte(r.Header.Get("Authorization")))
 return subtle.ConstantTimeCompare(want[:],got[:])==1
}
type reviewInput struct {
 Snapshot string `json:"snapshot"`
 DecisionID string `json:"decisionId"`
 Outcome string `json:"outcome"`
}
type reviewRecord struct{
 ID string `json:"id"`
 Snapshot string `json:"snapshot"`
 RuleVersion string `json:"ruleVersion"`
 AsOf string `json:"asOf"`
 Decision brainDecision `json:"decision"`
 Outcome string `json:"outcome"`
 RecordedAt time.Time `json:"recordedAt"`
 ExternalEffectsAuthorized bool `json:"externalEffectsAuthorized"`
 Digest string `json:"digest"`
}
func reviewHex(s string)bool{b,e:=hex.DecodeString(s);return e==nil&&len(b)==32&&hex.EncodeToString(b)==s}
func reviewID(snapshot,decision string)string{return checkpointDigest([]byte(snapshot+":"+decision))}
func reviewDigest(r reviewRecord)string{r.Digest="";b,_:=json.Marshal(r);return checkpointDigest(b)}
func validOutcome(s string)bool{return s=="reviewed"||s=="needs-followup"}
func validateReviews(records map[string]reviewRecord)error{
 if len(records)>1000{return errors.New("review capacity")}
 for id,r:=range records{
  if !reviewHex(r.Snapshot)||id!=r.ID||id!=reviewID(r.Snapshot,r.Decision.ID)||r.RuleVersion!="brain-v1"||!validLifetimeDay(r.AsOf)||r.RecordedAt.IsZero()||lifetimeToday(r.RecordedAt)!=r.AsOf||!validOutcome(r.Outcome)||r.ExternalEffectsAuthorized||r.Decision.ID==""||r.Decision.ID!=r.Decision.Rule+":"+r.Decision.Subject||r.Decision.Priority<0||r.Decision.Priority>3||len(r.Decision.Facts)==0||r.Digest!=reviewDigest(r){return errors.New("invalid review record")}
 }
 return nil
}
// Snapshot binds every recorded operational input, excluding the review
// journal itself. Date and rule version are included; no signature is implied.
func(e *retailEngine) reviewSnapshot(r brainReport)(string,error){
 state:=e.state()
 state.Reviews=nil
 b,err:=json.Marshal(struct{Domain string;State retailState;Report brainReport}{"biteos-review-v1",state,r})
 if err!=nil{return "",err}
 return checkpointDigest(b),nil
}
func(e *retailEngine) review(w http.ResponseWriter,r *http.Request){
 if r.Method!="GET"&&r.Method!="POST"{w.Header().Set("Allow","GET, POST");fail(w,405,"method not allowed");return}
 w.Header().Set("Cache-Control","no-store")
 if !reviewEnabled(){fail(w,503,"local review disabled");return}
 if !reviewAuthorized(r){fail(w,401,"review credential required");return}
 var in reviewInput
 if r.Method=="POST"{
  if !retailDecode(w,r,&in){return}
  if !reviewHex(in.Snapshot)||len(in.DecisionID)<1||len(in.DecisionID)>160||!validOutcome(in.Outcome){fail(w,422,"invalid review");return}
 }
 e.mu.Lock();defer e.mu.Unlock()
 if e.storageFailed{fail(w,503,"storage recovery required");return}
 f,err:=e.financeProjection();if err!=nil{fail(w,503,"finance reconciliation unavailable");return}
 now:=time.Now().UTC()
 report:=e.brainProjection(f,lifetimeToday(now))
 snapshot,err:=e.reviewSnapshot(report);if err!=nil{fail(w,503,"snapshot unavailable");return}
 if r.Method=="GET"{
  rows:=[]reviewRecord{}
  for _,v:=range e.reviews{rows=append(rows,v)}
  sortReviewRecords(rows)
  respond(w,200,map[string]any{"demo":true,"currentSnapshot":snapshot,"records":rows,"externalEffectsAuthorized":false});return
 }
 id:=reviewID(in.Snapshot,in.DecisionID)
 if old,ok:=e.reviews[id];ok{
  if old.Outcome!=in.Outcome{fail(w,409,"review outcome immutable");return}
  respond(w,200,map[string]any{"record":old,"current":old.Snapshot==snapshot,"externalEffectsAuthorized":false});return
 }
 if in.Snapshot!=snapshot{fail(w,409,"snapshot changed; refresh and review again");return}
 var decision *brainDecision
 for i:=range report.Decisions{if report.Decisions[i].ID==in.DecisionID{decision=&report.Decisions[i];break}}
 if decision==nil{fail(w,404,"decision unavailable");return}
 if len(e.reviews)>=1000{fail(w,503,"demo review capacity reached");return}
 before,err:=e.beforeMutation();if err!=nil{fail(w,503,"checkpoint unavailable");return}
 v:=reviewRecord{ID:id,Snapshot:snapshot,RuleVersion:report.RuleVersion,AsOf:report.AsOf,Decision:*decision,Outcome:in.Outcome,RecordedAt:now}
 v.Digest=reviewDigest(v)
 if e.reviews==nil{e.reviews=map[string]reviewRecord{}}
 e.reviews[id]=v
 if err=e.commitMutation(before);err!=nil{fail(w,503,"checkpoint unavailable");return}
 respond(w,201,map[string]any{"record":v,"current":true,"externalEffectsAuthorized":false})
}

func sortReviewRecords(rows []reviewRecord){
 sort.Slice(rows,func(i,j int)bool{if !rows[i].RecordedAt.Equal(rows[j].RecordedAt){return rows[i].RecordedAt.After(rows[j].RecordedAt)};return rows[i].ID<rows[j].ID})
}
