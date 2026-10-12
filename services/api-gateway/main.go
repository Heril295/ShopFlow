package main

import (
	"encoding/json"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sony/gobreaker"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests through API gateway",
	}, []string{"service", "method", "route", "status_code"})

	httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request latency at gateway",
		Buckets: []float64{0.05, 0.1, 0.25, 0.4, 0.8, 1.5, 3.0, 5.0},
	}, []string{"service", "route"})

	circuitBreakerStatus = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "circuit_breaker_state",
		Help: "0: Closed, 1: Half-Open, 2: Open",
	}, []string{"target_service"})
)

type FaultConfig struct {
	LatencyMs int     `json:"latency_ms"`
	ErrorRate float64 `json:"error_rate"`
	Timeout   bool    `json:"timeout"`
}

var currentFaults FaultConfig

func main() {
	log.Println("[INFO] Starting ShopFlow API Gateway on :8080...")

	orderServiceURL, _ := url.Parse(getEnv("ORDER_SERVICE_URL", "http://order-service:8081"))
	catalogServiceURL, _ := url.Parse(getEnv("CATALOG_SERVICE_URL", "http://catalog-service:8083"))

	orderProxy := httputil.NewSingleHostReverseProxy(orderServiceURL)
	catalogProxy := httputil.NewSingleHostReverseProxy(catalogServiceURL)

	orderCB := gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "order-service-cb",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     5 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return counts.Requests >= 5 && failureRatio >= 0.5
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			log.Printf("[WARN] CircuitBreaker %s transitioned from %v to %v", name, from, to)
			val := 0.0
			if to == gobreaker.StateHalfOpen {
				val = 1.0
			}
			if to == gobreaker.StateOpen {
				val = 2.0
			}
			circuitBreakerStatus.WithLabelValues("order-service").Set(val)
		},
	})

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","service":"api-gateway"}`))
	})

	r.Handle("/metrics", promhttp.Handler())

	r.HandleFunc("/api/v1/orders*", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		_, err := orderCB.Execute(func() (interface{}, error) {
			orderProxy.ServeHTTP(w, r)
			return nil, nil
		})
		duration := time.Since(start).Seconds()
		httpRequestDuration.WithLabelValues("api-gateway", "/api/v1/orders").Observe(duration)

		if err != nil {
			httpRequestsTotal.WithLabelValues("api-gateway", r.Method, "/api/v1/orders", "503").Inc()
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Circuit breaker open: order-service is unavailable",
			})
		}
	})

	r.HandleFunc("/api/v1/catalog*", func(w http.ResponseWriter, r *http.Request) {
		catalogProxy.ServeHTTP(w, r)
	})

	go func() {
		adminMux := http.NewServeMux()
		adminMux.HandleFunc("/admin/faults", func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPut || r.Method == http.MethodPost {
				json.NewDecoder(r.Body).Decode(&currentFaults)
				log.Printf("[ADMIN] Injected faults: Latency=%dms ErrorRate=%.2f", currentFaults.LatencyMs, currentFaults.ErrorRate)
			}
			json.NewEncoder(w).Encode(currentFaults)
		})
		log.Println("[INFO] Admin Fault API listening on :9000")
		http.ListenAndServe(":9000", adminMux)
	}()

	srv := &http.Server{Addr: ":8080", Handler: r}
	srv.ListenAndServe()
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
