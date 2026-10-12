package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var (
	ordersCreated = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "orders_created_total",
		Help: "Total number of orders created by status",
	}, []string{"status"})

	orderDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "Order handler latency",
		Buckets: []float64{0.05, 0.1, 0.25, 0.4, 0.8, 1.5, 3.0},
	}, []string{"service", "handler"})
)

type CreateOrderRequest struct {
	CustomerID string   `json:"customer_id"`
	Items      []string `json:"items"`
	TotalUSD   float64  `json:"total_usd"`
}

func createOrderHandler(db *sql.DB, mq *amqp.Channel, inventoryURL, paymentURL string) http.HandlerFunc {
	tracer := otel.Tracer("order-service")

	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := tracer.Start(r.Context(), "CreateOrderFlow")
		defer span.End()

		var req CreateOrderRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		orderID := uuid.New().String()
		span.SetAttributes(attribute.String("order.id", orderID), attribute.Float64("order.amount", req.TotalUSD))

		// 1. Reserve Inventory
		_, invSpan := tracer.Start(ctx, "HTTP ReserveInventory")
		invResp, err := http.Post(fmt.Sprintf("%s/reserve", inventoryURL), "application/json", nil)
		invSpan.End()
		if err != nil || (invResp != nil && invResp.StatusCode != http.StatusOK) {
			ordersCreated.WithLabelValues("inventory_failed").Inc()
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]string{"error": "insufficient inventory"})
			return
		}

		// 2. Begin Transaction
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			ordersCreated.WithLabelValues("db_error").Inc()
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		_, err = tx.ExecContext(ctx,
			"INSERT INTO orders (id, customer_id, total_usd, status, created_at) VALUES ($1, $2, $3, $4, NOW())",
			orderID, req.CustomerID, req.TotalUSD, "PENDING",
		)
		if err != nil {
			tx.Rollback()
			http.Error(w, "failed to insert order", http.StatusInternalServerError)
			return
		}

		// 3. Call Payment Service
		_, paySpan := tracer.Start(ctx, "HTTP AuthorizePayment")
		payClient := &http.Client{Timeout: 3 * time.Second}
		payBody, _ := json.Marshal(map[string]interface{}{"order_id": orderID, "amount": req.TotalUSD})
		payResp, err := payClient.Post(fmt.Sprintf("%s/charge", paymentURL), "application/json", bytes.NewReader(payBody))
		paySpan.End()

		if err != nil || (payResp != nil && payResp.StatusCode != http.StatusOK) {
			tx.Rollback()
			ordersCreated.WithLabelValues("payment_failed").Inc()
			w.WriteHeader(http.StatusPaymentRequired)
			json.NewEncoder(w).Encode(map[string]string{"error": "payment authorization rejected"})
			return
		}

		// 4. Transactional Outbox Pattern
		eventPayload, _ := json.Marshal(map[string]interface{}{
			"order_id": orderID, "customer_id": req.CustomerID, "amount": req.TotalUSD,
		})
		_, err = tx.ExecContext(ctx,
			"INSERT INTO outbox (event_type, payload, status, created_at) VALUES ($1, $2, 'PENDING', NOW())",
			"order.confirmed", string(eventPayload),
		)
		if err != nil {
			tx.Rollback()
			http.Error(w, "outbox write failed", http.StatusInternalServerError)
			return
		}

		if err := tx.Commit(); err != nil {
			ordersCreated.WithLabelValues("commit_failed").Inc()
			http.Error(w, "commit error", http.StatusInternalServerError)
			return
		}

		ordersCreated.WithLabelValues("confirmed").Inc()
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"order_id": orderID,
			"status":   "CONFIRMED",
		})
	}
}

func main() {
	db, _ := sql.Open("pgx", "postgres://shopflow:secret@postgres:5432/order_db?sslmode=disable")
	db.SetMaxOpenConns(50)

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/orders", createOrderHandler(db, nil, "http://inventory-service:8084", "http://payment-service:8082"))

	log.Println("[INFO] order-service running on :8081")
	http.ListenAndServe(":8081", mux)
}
