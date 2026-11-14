package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"sync"
	"time"
)

// Retail is an isolated, in-memory demonstration. No real dispatch, payments or personal data.
type retailProduct struct {
	ID string `json:"id"`
	Name map[string]string `json:"name"`
	Category string `json:"category"`
	Unit string `json:"unit"`
	Price int64 `json:"price"`
	Stock int `json:"stock"`
}
type retailItem struct {
	ID string `json:"id"`
	Quantity int `json:"quantity"`
}
type retailRequest struct {
	Items []retailItem `json:"items"`
	Mode string `json:"mode"`
	Replacement string `json:"replacement"`
}
type retailLine struct {
	ID string `json:"id"`
	Name map[string]string `json:"name"`
	Quantity int `json:"quantity"`
	UnitPrice int64 `json:"unitPrice"`
}
type retailEvent struct {
	Status string `json:"status"`
	At time.Time `json:"at"`
}
type retailOrder struct {
	ID string `json:"id"`
	Lines []retailLine `json:"lines"`
	Mode string `json:"mode"`
	Replacement string `json:"replacement"`
	Currency string `json:"currency"`
	Subtotal int64 `json:"subtotal"`
	Fee int64 `json:"fee"`
	Total int64 `json:"total"`
	Status string `json:"status"`
	Events []retailEvent `json:"events"`
}
type retailReplay struct {
	hash [32]byte
	id string
}
type retailEngine struct {
	mu sync.Mutex
	products []retailProduct
	orders map[string]retailOrder
	keys map[string]retailReplay
}
func newRetailEngine() *retailEngine {
	return &retailEngine{
		products: []retailProduct{
			{"avocado", map[string]string{"tr":"Avokado","ru":"Авокадо","en":"Avocado"}, "fresh", "1 pc", 4500, 18},
			{"banana", map[string]string{"tr":"Muz","ru":"Бананы","en":"Bananas"}, "fresh", "500 g", 3900, 30},
			{"milk", map[string]string{"tr":"Süt","ru":"Молоко","en":"Milk"}, "dairy", "1 L", 4900, 20},
			{"eggs", map[string]string{"tr":"Yumurta","ru":"Яйца","en":"Eggs"}, "dairy", "6 pcs", 7200, 12},
			{"bread", map[string]string{"tr":"Ekmek","ru":"Хлеб","en":"Bread"}, "pantry", "1 pc", 6500, 15},
			{"buckwheat", map[string]string{"tr":"Karabuğday","ru":"Гречка","en":"Buckwheat"}, "international", "500 g", 9500, 9},
			{"dumplings", map[string]string{"tr":"Pelmeni","ru":"Пельмени","en":"Pelmeni"}, "international", "400 g", 16500, 8},
		},
		orders: make(map[string]retailOrder), keys: make(map[string]retailReplay),
	}
}

func retailDecode(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 32768)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(dst) != nil || d.Decode(&struct{}{}) != io.EOF {
		fail(w, 400, "invalid JSON")
		return false
	}
	return true
}

func (e *retailEngine) register(mux *http.ServeMux) {
	mux.HandleFunc("/api/retail/catalog", e.catalog)
	mux.HandleFunc("/api/retail/orders", e.create)
	mux.HandleFunc("/api/retail/order", e.order)
}
func (e *retailEngine) catalog(w http.ResponseWriter, r *http.Request) {
	if !method(w,r,"GET") { return }
	e.mu.Lock()
	defer e.mu.Unlock()
	respond(w,200,map[string]any{"demo":true,"currency":"TRY","products":e.products})
}
func (e *retailEngine) create(w http.ResponseWriter, r *http.Request) {
	if !method(w,r,"POST") { return }
	var req retailRequest
	if !retailDecode(w,r,&req) { return }
	key := r.Header.Get("Idempotency-Key")
	if len(key)<8 || len(key)>128 { fail(w,400,"idempotency key required"); return }
	data,_ := json.Marshal(req)
	hash := sha256.Sum256(data)
	e.mu.Lock()
	defer e.mu.Unlock()
	if replay,ok := e.keys[key]; ok {
		if replay.hash != hash { fail(w,409,"idempotency key conflict"); return }
		respond(w,200,e.orders[replay.id]); return
	}
	if len(e.orders)>=1000 { fail(w,503,"demo capacity reached"); return }
	if len(req.Items)==0 || len(req.Items)>50 || (req.Mode!="pickup" && req.Mode!="delivery") || (req.Replacement!="contact" && req.Replacement!="skip") {
		fail(w,422,"invalid order"); return
	}
	seen := make(map[string]bool)
	o := retailOrder{Mode:req.Mode,Replacement:req.Replacement,Currency:"TRY",Status:"reserved"}
	indexes := make([]int,0,len(req.Items))
	for _,item := range req.Items {
		if seen[item.ID] || item.Quantity<1 || item.Quantity>20 { fail(w,422,"invalid or duplicate item"); return }
		seen[item.ID]=true
		index := -1
		for i,p := range e.products { if p.ID==item.ID { index=i; break } }
		if index<0 { fail(w,422,"unknown item"); return }
		p := e.products[index]
		if p.Stock<item.Quantity { fail(w,409,"insufficient stock"); return }
		indexes=append(indexes,index)
		o.Lines=append(o.Lines,retailLine{p.ID,p.Name,item.Quantity,p.Price})
		o.Subtotal+=p.Price*int64(item.Quantity)
	}
	if req.Mode=="delivery" { o.Fee=3500 }
	o.Total=o.Subtotal+o.Fee
	var id [16]byte
	if _,err:=rand.Read(id[:]);err!=nil { fail(w,503,"order identifier unavailable"); return }
	o.ID="retail-"+hex.EncodeToString(id[:])
	o.Events=[]retailEvent{{o.Status,time.Now().UTC()}}
	for i,line:=range o.Lines { e.products[indexes[i]].Stock-=line.Quantity }
	e.orders[o.ID]=o
	e.keys[key]=retailReplay{hash,o.ID}
	respond(w,201,o)
}
func (e *retailEngine) order(w http.ResponseWriter,r *http.Request) {
	if r.Method!="GET" && r.Method!="POST" { w.Header().Set("Allow","GET, POST"); fail(w,405,"method not allowed"); return }
	var action struct { Status string `json:"status"` }
	if r.Method=="POST" && !retailDecode(w,r,&action) { return }
	e.mu.Lock()
	defer e.mu.Unlock()
	o,ok:=e.orders[r.URL.Query().Get("id")]
	if !ok { fail(w,404,"order not found"); return }
	if r.Method=="GET" { respond(w,200,o); return }
	if action.Status==o.Status { respond(w,200,o); return }
	next:=map[string]string{"reserved":"picking","picking":"packed"}
	if o.Mode=="delivery" {next["packed"]="in_transit";next["in_transit"]="delivered"} else { next["packed"]="collected" }
	cancel:=action.Status=="cancelled" && (o.Status=="reserved" || o.Status=="picking" || o.Status=="packed")
	if !cancel && (next[o.Status]=="" || next[o.Status]!=action.Status) { fail(w,409,"invalid transition"); return }
	if cancel {
		for _,line:=range o.Lines { for i,p:=range e.products { if p.ID==line.ID { e.products[i].Stock+=line.Quantity; break } } }
	}
	o.Status=action.Status
	o.Events=append(o.Events,retailEvent{o.Status,time.Now().UTC()})
	e.orders[o.ID]=o
	respond(w,200,o)
}
