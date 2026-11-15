package main

import("encoding/json";"net/http";"strings";"testing")
func TestBusinessRoleIsolation(t *testing.T){
 for _,role:=range businessRoles{t.Setenv(businessRoleEnv(role),"test-local-business-"+role+"-credential-000000")}
 t.Setenv("BITEOS_REVIEW_TOKEN","separate-test-review-credential-000000")
 e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
 pickup:=financeOrder(t,mux,"business-pickup",`{"items":[{"id":"milk","quantity":2}],"mode":"pickup","replacement":"skip"}`)
 financeStatus(t,mux,pickup.ID,"picking","packed")
 delivery:=financeOrder(t,mux,"business-delivery",checkpointOrderBody)
 financeStatus(t,mux,delivery.ID,"picking","packed")
 reserved:=financeOrder(t,mux,"business-reserved",`{"items":[{"id":"bread","quantity":1}],"mode":"pickup","replacement":"skip"}`)
 before,_:=json.Marshal(e.state())
 for role,want:=range map[string]string{"seller":pickup.ID,"warehouse":reserved.ID,"courier":delivery.ID,"owner":"","admin":""}{
  path:="/api/retail/business?role="+role
  token,_:=businessRoleToken(role)
  w:=reviewCall(mux,"GET",path,token,"")
  var r businessReport
  if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&r)!=nil||r.Role!=role||r.ExternalEffectsAuthorized||r.Mode!="read-only"{t.Fatal(role,w.Code,w.Body.String())}
  if want!=""&&(len(r.Queue)!=1||r.Queue[0].ID!=want){t.Fatal(role,r.Queue)}
  if (role=="owner"||role=="admin")&&len(r.Queue)!=3{t.Fatal(role,r.Queue)}
  if role!="owner"&&(strings.Contains(w.Body.String(),"TRY-minor")||strings.Contains(w.Body.String(),"\"contribution\"")){t.Fatal("financial leakage",role)}
  for _,row:=range r.Queue{
   if (role=="seller"||role=="warehouse")!=(len(row.Items)>0){t.Fatal("item scope",role,row)}
   if role=="seller"||role=="warehouse"{if row.Zone!=""||row.Slot!=""{t.Fatal("zone scope")}}
  }
  if w=reviewCall(mux,"GET",path,"wrong","");w.Code!=401{t.Fatal(role,w.Code)}
  if w=reviewCall(mux,"POST",path,token,"{}");w.Code!=405{t.Fatal(role,w.Code)}
 }
 after,_:=json.Marshal(e.state());if string(before)!=string(after){t.Fatal("workspace mutated state")}
 owner,_:=businessRoleToken("owner")
 if w:=reviewCall(mux,"GET","/api/retail/business?role=courier",owner,"");w.Code!=401{t.Fatal("cross role access",w.Code)}
 t.Setenv("BITEOS_COURIER_TOKEN",owner)
 if w:=reviewCall(mux,"GET","/api/retail/business?role=owner",owner,"");w.Code!=503{t.Fatal("shared credential accepted",w.Code)}
 t.Setenv("BITEOS_COURIER_TOKEN","")
 if w:=reviewCall(mux,"GET","/api/retail/business?role=courier",owner,"");w.Code!=503{t.Fatal("disabled workspace",w.Code)}
}
