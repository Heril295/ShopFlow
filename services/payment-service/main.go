package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type FaultState struct {
	mu        sync.RWMutex
	LatencyMs int     `json:"latency_ms"`
	ErrorRate float64 `json:"error_rate"`
	Timeout   bool    `json:"timeout"`
}

var faults = FaultState{}

var (
	paymentAttempts = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "payment_charges_total",
		Help: "Total charges processed by gateway",
	}, []string{"status"})

	paymentLatency = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "payment_charge_duration_seconds",
		Help:    "Latency of third party payment API",
		Buckets: []float64{0.1, 0.5, 1.0, 2.0, 3.5, 5.0},
	})
)

func chargeHandler(w http.ResponseWriter, r *http.Request) {
	faults.mu.RLock()
	lat := faults.LatencyMs
	errRate := faults.ErrorRate
	timeout := faults.Timeout
	faults.mu.RUnlock()

	start := time.Now()
	if lat > 0 {
		time.Sleep(time.Duration(lat) * time.Millisecond)
	}

	if timeout {
		time.Sleep(6 * time.Second)
		http.Error(w, "Gateway Timeout", http.StatusGatewayTimeout)
		paymentAttempts.WithLabelValues("timeout").Inc()
		return
	}

	if errRate > 0 && rand.Float64() < errRate {
		http.Error(w, "500 Internal Bank Error: upstream declined", http.StatusInternalServerError)
		paymentAttempts.WithLabelValues("failed").Inc()
		return
	}

	paymentLatency.Observe(time.Since(start).Seconds())
	paymentAttempts.WithLabelValues("success").Inc()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":       "APPROVED",
		"auth_code":    fmt.Sprintf("AUTH-%06d", rand.Intn(999999)),
		"processed_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func main() {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/charge", chargeHandler)

	go func() {
		adminMux := http.NewServeMux()
		adminMux.HandleFunc("/admin/faults", func(w http.ResponseWriter, r *http.Request) {
			faults.mu.Lock()
			defer faults.mu.Unlock()
			if r.Method == http.MethodPut || r.Method == http.MethodPost {
				json.NewDecoder(r.Body).Decode(&faults)
				log.Printf("[ADMIN] payment-service faults updated: Latency=%dms ErrorRate=%.2f", faults.LatencyMs, faults.ErrorRate)
			}
			json.NewEncoder(w).Encode(faults)
		})
		http.ListenAndServe(":9002", adminMux)
	}()

	log.Println("[INFO] payment-service running on :8082")
	http.ListenAndServe(":8082", mux)
}
