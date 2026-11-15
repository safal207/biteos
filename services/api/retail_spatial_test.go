package main

import("encoding/json";"net/http";"reflect";"testing")
func spatialFixture()spatialInput{
 return spatialInput{Stops:[]spatialStop{{"order-a","A",1,0,60,5,3500},{"order-b","B",1,0,60,5,3500},{"order-c","C",1,0,60,5,3500}},Couriers:1,Capacity:3,ShiftMinutes:60,SpeedKMH:30,CostPerKM:500,CostPerMinute:100,FixedPerRoute:1000}
}
func TestSpatialGrouping(t *testing.T){
 i:=spatialFixture()
 r:=calculateSpatial(i)
 if !r.Individual.Feasible||!r.Grouped.Feasible||len(r.Grouped.Routes)!=1||r.Individual.Meters!=11600||r.Grouped.Meters!=6600||r.Individual.Cost!=12700||r.Grouped.Cost!=7200||r.SavedCost==nil||*r.SavedCost!=5500||r.Grouped.Contribution!=3300||r.Grouped.CourierMinutes!=29{t.Fatal(r)}
 i.Stops[0],i.Stops[2]=i.Stops[2],i.Stops[0]
 if !reflect.DeepEqual(r,calculateSpatial(i)){t.Fatal("non deterministic")}
}
func TestSpatialCapacityAndWindows(t *testing.T){
 i:=spatialFixture();i.Capacity=2
 if calculateSpatial(i).Grouped.Feasible{t.Fatal("overloaded route accepted")}
 i.Couriers=2;r:=calculateSpatial(i)
 if !r.Grouped.Feasible||len(r.Grouped.Routes)!=2{t.Fatal(r)}
 seen:=map[string]bool{}
 for _,route:=range r.Grouped.Routes{if route.Units>i.Capacity{t.Fatal(route)};for _,v:=range route.Visits{if seen[v.ID]{t.Fatal("duplicate stop")};seen[v.ID]=true}}
 if len(seen)!=3{t.Fatal("missing stop")}
 i.Stops[2].Latest=1
 r=calculateSpatial(i);if r.Grouped.Feasible||r.Individual.Feasible||r.SavedCost!=nil{t.Fatal("impossible deadline accepted",r)}
 i=spatialFixture();i.Stops=i.Stops[:1];i.Stops[0].Earliest=20
 r=calculateSpatial(i);if r.Grouped.Makespan!=27||r.Grouped.Routes[0].Visits[0].Completion!=25{t.Fatal(r)}
}
func TestSpatialAPIReadOnly(t *testing.T){
 e:=newRetailEngine();mux:=http.NewServeMux();e.register(mux)
 before,_:=json.Marshal(e.state());i:=spatialFixture();body,_:=json.Marshal(i)
 w:=retailCall(mux,"POST","/api/retail/spatial","",string(body))
 var r spatialResult
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&r)!=nil||!r.Grouped.Feasible{t.Fatal(w.Code,w.Body.String())}
 after,_:=json.Marshal(e.state());if string(before)!=string(after){t.Fatal("planner mutated state")}
 i.Stops[1].ID=i.Stops[0].ID;body,_=json.Marshal(i)
 w=retailCall(mux,"POST","/api/retail/spatial","",string(body));if w.Code!=422{t.Fatal(w.Code)}
}
