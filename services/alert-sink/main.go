package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"
)

type AlertNotification struct {
	Receiver string `json:"receiver"`
	Status   string `json:"status"`
	Alerts   []struct {
		Status      string            `json:"status"`
		Labels      map[string]string `json:"labels"`
		Annotations map[string]string `json:"annotations"`
		StartsAt    time.Time         `json:"startsAt"`
	} `json:"alerts"`
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	var notif AlertNotification
	if err := json.Unmarshal(body, &notif); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	for _, alert := range notif.Alerts {
		log.Printf("[ALERT-SINK] Status=%s Alert=%s Service=%s Summary=%s",
			alert.Status,
			alert.Labels["alertname"],
			alert.Labels["service"],
			alert.Annotations["summary"],
		)
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"received"}`))
}

func main() {
	http.HandleFunc("/webhook", webhookHandler)
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	log.Println("[INFO] alert-sink webhook server running on :9099")
	http.ListenAndServe(":9099", nil)
}
