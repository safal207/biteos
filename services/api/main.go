package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

//go:embed catalog.json
var catalogJSON []byte

type Product struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Description string   `json:"description"`
	Price       int      `json:"price"`
	Weight      string   `json:"weight"`
	Kcal        int      `json:"kcal"`
	Image       int      `json:"image"`
	Badge       string   `json:"badge"`
	Available   bool     `json:"available"`
	Options     []string `json:"options"`
}
type Option struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Price int    `json:"price"`
}
type Catalog struct {
	Currency string    `json:"currency"`
	Products []Product `json:"products"`
	Options  []Option  `json:"options"`
	Combo    struct {
		SideID   string `json:"sideId"`
		DrinkID  string `json:"drinkId"`
		Discount int    `json:"discount"`
	} `json:"combo"`
}
type Item struct {
	ProductID string   `json:"productId"`
	Quantity  int      `json:"quantity"`
	OptionIDs []string `json:"optionIds"`
	Combo     bool     `json:"combo"`
}
type Basket struct {
	Items []Item `json:"items"`
	Mode  string `json:"mode"`
}
type Quote struct {
	Subtotal int `json:"subtotal"`
	Discount int `json:"discount"`
	Total    int `json:"total"`
	Count    int `json:"count"`
}
type Order struct {
	ID        string    `json:"id"`
	Number    int       `json:"number"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	Basket    Basket    `json:"basket"`
	Quote     Quote     `json:"quote"`
}
type Receipt struct {
	Key   string `json:"key"`
	Hash  string `json:"hash"`
	Order Order  `json:"order"`
}
type Store struct {
	mu      sync.Mutex
	path    string
	records []Receipt
}
type Server struct {
	catalog   Catalog
	store     *Store
	engineURL string
	client    *http.Client
}

func loadCatalog() Catalog {
	var c Catalog
	if err := json.Unmarshal(catalogJSON, &c); err != nil {
		panic(err)
	}
	return c
}
func (c Catalog) product(id string) (Product, bool) {
	for _, p := range c.Products {
		if p.ID == id {
			return p, true
		}
	}
	return Product{}, false
}
func contains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

// All prices are integer minor currency units; the client never supplies a price.
func (c Catalog) price(b Basket) (Quote, error) {
	q := Quote{}
	if b.Mode != "dine-in" && b.Mode != "takeaway" {
		return q, errors.New("Выберите: в зале или с собой")
	}
	if len(b.Items) > 50 {
		return q, errors.New("Слишком много позиций")
	}
	for _, item := range b.Items {
		p, ok := c.product(item.ProductID)
		if !ok || !p.Available {
			return Quote{}, errors.New("Блюдо недоступно")
		}
		if item.Quantity < 1 || item.Quantity > 20 {
			return Quote{}, errors.New("Количество должно быть от 1 до 20")
		}
		unit := p.Price
		seen := map[string]bool{}
		for _, id := range item.OptionIDs {
			if seen[id] || !contains(p.Options, id) {
				return Quote{}, errors.New("Недопустимая добавка")
			}
			seen[id] = true
			found := false
			for _, o := range c.Options {
				if o.ID == id {
					unit += o.Price
					found = true
					break
				}
			}
			if !found {
				return Quote{}, errors.New("Добавка недоступна")
			}
		}
		if item.Combo {
			side, sideOK := c.product(c.Combo.SideID)
			drink, drinkOK := c.product(c.Combo.DrinkID)
			if p.Category != "burgers" || !sideOK || !drinkOK || !side.Available || !drink.Available {
				return Quote{}, errors.New("Комбо недоступно")
			}
			unit += side.Price + drink.Price
			q.Discount += c.Combo.Discount * item.Quantity
		}
		q.Subtotal += unit * item.Quantity
		q.Count += item.Quantity
		if q.Count > 50 {
			return Quote{}, errors.New("Не больше 50 блюд в заказе")
		}
	}
	q.Total = q.Subtotal - q.Discount
	return q, nil
}

func openStore(path string) (*Store, error) {
	s := &Store{path: path, records: []Receipt{}}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(data, &s.records); err != nil {
		return nil, fmt.Errorf("invalid order store: %w", err)
	}
	return s, nil
}

var errConflict = errors.New("Этот ключ уже использован для другого заказа")

// Persist before acknowledging. Single-process demo store; replace with a transactional DB for multiple replicas.
func (s *Store) create(key string, b Basket, q Quote) (Order, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, _ := json.Marshal(b)
	digest := sha256.Sum256(data)
	hash := hex.EncodeToString(digest[:])
	for _, r := range s.records {
		if r.Key == key {
			if r.Hash != hash {
				return Order{}, false, errConflict
			}
			return r.Order, true, nil
		}
	}
	n := len(s.records) + 1
	o := Order{ID: fmt.Sprintf("bite-%06d", n), Number: n, Status: "demo-confirmed", CreatedAt: time.Now().UTC(), Basket: b, Quote: q}
	next := append(append([]Receipt{}, s.records...), Receipt{Key: key, Hash: hash, Order: o})
	encoded, err := json.MarshalIndent(next, "", "  ")
	if err != nil {
		return Order{}, false, err
	}
	if err = os.MkdirAll(filepath.Dir(s.path), 0700); err != nil {
		return Order{}, false, err
	}
	f, err := os.CreateTemp(filepath.Dir(s.path), "orders-*.tmp")
	if err != nil {
		return Order{}, false, err
	}
	name := f.Name()
	defer os.Remove(name)
	if _, err = f.Write(encoded); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return Order{}, false, err
	}
	if err = os.Rename(name, s.path); err != nil {
		return Order{}, false, err
	}
	s.records = next
	return o, false, nil
}

func respond(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
func fail(w http.ResponseWriter, status int, message string) {
	respond(w, status, map[string]string{"error": message})
}
func method(w http.ResponseWriter, r *http.Request, want string) bool {
	if r.Method == want {
		return true
	}
	w.Header().Set("Allow", want)
	fail(w, 405, "Метод не поддерживается")
	return false
}
func decode(w http.ResponseWriter, r *http.Request, b *Basket) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 32768)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(b); err != nil {
		fail(w, 400, "Некорректная корзина")
		return false
	}
	if err := d.Decode(&struct{}{}); err != io.EOF {
		fail(w, 400, "Ожидается один JSON-объект")
		return false
	}
	return true
}
func (s *Server) handler(webDir string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		if method(w, r, "GET") {
			respond(w, 200, map[string]string{"status": "ok", "service": "biteos-api"})
		}
	})
	mux.HandleFunc("/api/menu", func(w http.ResponseWriter, r *http.Request) {
		if method(w, r, "GET") {
			respond(w, 200, s.catalog)
		}
	})
	mux.HandleFunc("/api/quote", func(w http.ResponseWriter, r *http.Request) {
		if !method(w, r, "POST") {
			return
		}
		var b Basket
		if !decode(w, r, &b) {
			return
		}
		q, err := s.catalog.price(b)
		if err != nil {
			fail(w, 422, err.Error())
			return
		}
		respond(w, 200, q)
	})
	mux.HandleFunc("/api/orders", func(w http.ResponseWriter, r *http.Request) {
		if !method(w, r, "POST") {
			return
		}
		var b Basket
		if !decode(w, r, &b) {
			return
		}
		key := r.Header.Get("Idempotency-Key")
		if len(key) < 8 || len(key) > 128 {
			fail(w, 400, "Требуется ключ заказа")
			return
		}
		q, err := s.catalog.price(b)
		if err != nil {
			fail(w, 422, err.Error())
			return
		}
		if q.Count == 0 {
			fail(w, 422, "Корзина пуста")
			return
		}
		o, replayed, err := s.store.create(key, b, q)
		if errors.Is(err, errConflict) {
			fail(w, 409, err.Error())
			return
		}
		if err != nil {
			log.Printf("persist order: %v", err)
			fail(w, 503, "Не удалось сохранить заказ. Попробуйте ещё раз")
			return
		}
		status := 201
		if replayed {
			status = 200
		}
		respond(w, status, o)
	})
	mux.HandleFunc("/api/recommendations", func(w http.ResponseWriter, r *http.Request) {
		if !method(w, r, "POST") {
			return
		}
		var b Basket
		if !decode(w, r, &b) {
			return
		}
		if _, err := s.catalog.price(b); err != nil {
			fail(w, 422, err.Error())
			return
		}
		payload, _ := json.Marshal(map[string]any{"catalog": s.catalog, "items": b.Items})
		req, err := http.NewRequestWithContext(r.Context(), "POST", s.engineURL+"/recommend", bytes.NewReader(payload))
		if err != nil {
			fail(w, 503, "Рекомендации временно недоступны")
			return
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := s.client.Do(req)
		if err != nil {
			respond(w, 200, map[string]any{"source": "unavailable", "offers": []any{}})
			return
		}
		defer res.Body.Close()
		var out json.RawMessage
		if res.StatusCode != 200 || json.NewDecoder(io.LimitReader(res.Body, 65536)).Decode(&out) != nil {
			respond(w, 200, map[string]any{"source": "unavailable", "offers": []any{}})
			return
		}
		respond(w, 200, out)
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { fail(w, 404, "Маршрут не найден") })
	mux.Handle("/", http.FileServer(http.Dir(webDir)))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'self'")
		mux.ServeHTTP(w, r)
	})
}
func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
func main() {
	store, err := openStore(env("ORDER_STORE", "data/orders.json"))
	if err != nil {
		log.Fatal(err)
	}
	s := &Server{catalog: loadCatalog(), store: store, engineURL: strings.TrimRight(env("ENGINE_URL", "http://127.0.0.1:8091"), "/"), client: &http.Client{Timeout: 800 * time.Millisecond}}
	server := &http.Server{Addr: env("ADDR", "127.0.0.1:8090"), Handler: s.handler(env("WEB_DIR", "../../apps/kiosk/dist")), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	log.Printf("BiteOS listening on http://%s", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
