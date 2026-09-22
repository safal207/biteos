package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func basket() Basket {
	return Basket{Mode: "dine-in", Items: []Item{{ProductID: "smash", Quantity: 1, OptionIDs: []string{}, Combo: true}}}
}
func TestPricing(t *testing.T) {
	c := loadCatalog()
	b := basket()
	b.Items[0].Quantity = 2
	b.Items[0].OptionIDs = []string{"cheese"}
	q, err := c.price(b)
	if err != nil {
		t.Fatal(err)
	}
	if q.Total != 119200 || q.Subtotal != 133200 || q.Discount != 14000 || q.Count != 2 {
		t.Fatalf("wrong combo quote: %+v", q)
	}
}
func TestRejectInvalidBasket(t *testing.T) {
	tests := map[string]func(*Basket){
		"negative quantity": func(b *Basket) { b.Items[0].Quantity = -1 },
		"huge quantity":     func(b *Basket) { b.Items[0].Quantity = 2147483647 },
		"unknown product":   func(b *Basket) { b.Items[0].ProductID = "free-burger" },
		"duplicate addon":   func(b *Basket) { b.Items[0].OptionIDs = []string{"cheese", "cheese"} },
		"wrong addon":       func(b *Basket) { b.Items[0].OptionIDs = []string{"sauce"} },
		"combo on a drink":  func(b *Basket) { b.Items[0].ProductID = "cola" },
		"wrong mode":        func(b *Basket) { b.Mode = "delivery" },
		"too many items": func(b *Basket) {
			b.Items = []Item{{ProductID: "smash", Quantity: 20}, {ProductID: "bbq", Quantity: 20}, {ProductID: "chicken", Quantity: 20}}
		},
	}
	for name, edit := range tests {
		t.Run(name, func(t *testing.T) {
			b := basket()
			edit(&b)
			if _, err := loadCatalog().price(b); err == nil {
				t.Fatal("invalid basket accepted")
			}
		})
	}
}
func TestUnavailableComboComponent(t *testing.T) {
	c := loadCatalog()
	for i := range c.Products {
		if c.Products[i].ID == "fries" {
			c.Products[i].Available = false
		}
	}
	if _, err := c.price(basket()); err == nil {
		t.Fatal("unavailable combo sold")
	}
}
func TestIdempotencyAndPersistence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "orders.json")
	s, _ := openStore(path)
	b := basket()
	q, _ := loadCatalog().price(b)
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			o, _, err := s.create("stable-order-key", b, q)
			if err != nil || o.Number != 1 {
				t.Errorf("duplicate order: %+v %v", o, err)
			}
		}()
	}
	wg.Wait()
	loaded, err := openStore(path)
	if err != nil {
		t.Fatal(err)
	}
	o, replayed, err := loaded.create("stable-order-key", b, q)
	if err != nil || !replayed || o.Number != 1 || len(loaded.records) != 1 {
		t.Fatal("retry after restart changed order")
	}
	b.Mode = "takeaway"
	if _, _, err := loaded.create("stable-order-key", b, q); err != errConflict {
		t.Fatal("conflicting replay was accepted")
	}
	o, _, err = loaded.create("another-order-key", b, q)
	if err != nil || o.Number != 2 {
		t.Fatal("sequence did not survive restart")
	}
}
func testServer(t *testing.T, engine string) http.Handler {
	t.Helper()
	s, _ := openStore(filepath.Join(t.TempDir(), "orders.json"))
	return (&Server{catalog: loadCatalog(), store: s, engineURL: engine, client: &http.Client{Timeout: 50 * time.Millisecond}}).handler(t.TempDir())
}
func TestOrderHTTP(t *testing.T) {
	h := testServer(t, "http://127.0.0.1:1")
	raw, _ := json.Marshal(basket())
	for i, want := range []int{201, 200} {
		req := httptest.NewRequest("POST", "/api/orders", bytes.NewReader(raw))
		req.Header.Set("Idempotency-Key", "http-retry-key")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		if w.Code != want {
			t.Fatalf("attempt %d: %d %s", i, w.Code, w.Body)
		}
	}
	for _, tt := range []struct {
		method, path, body string
		status             int
	}{
		{"POST", "/api/orders", `{"items":[],"mode":"dine-in"}`, 422},
		{"POST", "/api/quote", `{"items":[],"mode":"dine-in","total":1}`, 400},
		{"POST", "/api/quote", `{"items":[],"mode":"dine-in"}{}`, 400},
		{"GET", "/api/orders", "", 405},
		{"GET", "/api/missing", "", 404},
	} {
		req := httptest.NewRequest(tt.method, tt.path, bytes.NewBufferString(tt.body))
		req.Header.Set("Idempotency-Key", "test-unique-key")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		if w.Code != tt.status {
			t.Errorf("%s: got %d want %d", tt.path, w.Code, tt.status)
		}
	}
}
func TestRecommendationsFailOpen(t *testing.T) {
	h := testServer(t, "http://127.0.0.1:1")
	raw, _ := json.Marshal(basket())
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("POST", "/api/recommendations", bytes.NewReader(raw)))
	if w.Code != 200 || !bytes.Contains(w.Body.Bytes(), []byte(`"offers":[]`)) {
		t.Fatalf("engine outage breaks kiosk: %s", w.Body)
	}
}
