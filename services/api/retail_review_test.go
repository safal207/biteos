package main

import("encoding/json";"net/http";"net/http/httptest";"path/filepath";"strings";"testing")
const testReviewCredential="local-demo-review-test-credential-123456789"
func reviewCall(mux *http.ServeMux,method,path,token,body string)*httptest.ResponseRecorder{
 req:=httptest.NewRequest(method,path,strings.NewReader(body))
 if token!=""{req.Header.Set("Authorization","Bearer "+token)}
 w:=httptest.NewRecorder();mux.ServeHTTP(w,req);return w
}
func readBrain(t *testing.T,mux *http.ServeMux)brainReport{
 t.Helper();w:=retailCall(mux,"GET","/api/retail/brain","","")
 var r brainReport
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&r)!=nil||!reviewHex(r.Snapshot){t.Fatal(w.Code,w.Body.String())}
 return r
}
func reviewBody(snap,id,outcome string)string{b,_:=json.Marshal(reviewInput{snap,id,outcome});return string(b)}
func TestReviewAuthorityAndStaleness(t *testing.T){
 t.Setenv("BITEOS_REVIEW_TOKEN","")
 e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
 b:=readBrain(t,mux)
 if b.ReviewEnabled{t.Fatal("enabled by default")}
 body:=reviewBody(b.Snapshot,b.Decisions[0].ID,"reviewed")
 path:="/api/retail/brain/review"
 if w:=reviewCall(mux,"POST",path,"",body);w.Code!=503{t.Fatal(w.Code)}
 t.Setenv("BITEOS_REVIEW_TOKEN",testReviewCredential)
 if w:=reviewCall(mux,"POST",path,"wrong",body);w.Code!=401{t.Fatal(w.Code)}
 b=readBrain(t,mux)
 if !b.ReviewEnabled{t.Fatal("credential not enabled")}
 body=reviewBody(b.Snapshot,b.Decisions[0].ID,"reviewed")
 w:=reviewCall(mux,"POST",path,testReviewCredential,body)
 var v struct{Record reviewRecord;Current bool;ExternalEffectsAuthorized bool}
 if w.Code!=201||json.Unmarshal(w.Body.Bytes(),&v)!=nil||!v.Current||v.ExternalEffectsAuthorized||v.Record.ExternalEffectsAuthorized||len(e.reviews)!=1||len(e.evidence)!=0{t.Fatal(w.Code,w.Body.String())}
 if readBrain(t,mux).Snapshot!=b.Snapshot{t.Fatal("review changed operational snapshot")}
 if w=reviewCall(mux,"POST",path,testReviewCredential,body);w.Code!=200{t.Fatal(w.Code)}
 if w=reviewCall(mux,"POST",path,testReviewCredential,reviewBody(b.Snapshot,b.Decisions[0].ID,"needs-followup"));w.Code!=409{t.Fatal(w.Code)}
 w=retailCall(mux,"POST","/api/retail/demand","review-demand-1",`{"candidateId":"kefir","quantity":1}`)
 if w.Code!=201{t.Fatal(w.Code)}
 if readBrain(t,mux).Snapshot==b.Snapshot{t.Fatal("demand did not invalidate snapshot")}
 if w=reviewCall(mux,"POST",path,testReviewCredential,reviewBody(b.Snapshot,b.Decisions[1].ID,"reviewed"));w.Code!=409{t.Fatal(w.Code)}
 w=reviewCall(mux,"POST",path,testReviewCredential,body)
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&v)!=nil||v.Current{t.Fatal("historic retry",w.Code,w.Body.String())}
 if len(e.reviews)!=1||len(e.orders)!=0||len(e.movements)!=0{t.Fatal("review leaked effect")}
}
func TestReviewCheckpointAndDigest(t *testing.T){
 t.Setenv("BITEOS_REVIEW_TOKEN",testReviewCredential)
 path:=filepath.Join(t.TempDir(),"review.json");_,mux:=checkpointMux(t,path)
 b:=readBrain(t,mux);body:=reviewBody(b.Snapshot,b.Decisions[0].ID,"needs-followup")
 w:=reviewCall(mux,"POST","/api/retail/brain/review",testReviewCredential,body)
 if w.Code!=201{t.Fatal(w.Code,w.Body.String())}
 e,mux:=checkpointMux(t,path)
 w=reviewCall(mux,"POST","/api/retail/brain/review",testReviewCredential,body)
 if w.Code!=200||len(e.reviews)!=1{t.Fatal(w.Code)}
 for id,r:=range e.reviews{r.Outcome="reviewed";e.reviews[id]=r}
 if validateRetailState(e.state())==nil{t.Fatal("review digest mismatch accepted")}
}
