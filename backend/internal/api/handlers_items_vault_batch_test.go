package api

import (
	"bytes"
	"net/http"
	"testing"
)

func TestParseUniqueBatchVaultIDs(t *testing.T) {
	t.Parallel()

	ids, err := parseUniqueBatchVaultIDs([]string{
		"313cd29a-f536-4706-9c92-58a0a93cf5bc",
		" 313cd29a-f536-4706-9c92-58a0a93cf5bc ",
		"8f848a2e-a84a-4f13-a5db-6e854753f8d8",
	})
	if err != nil {
		t.Fatalf("parse ids failed: %v", err)
	}
	if len(ids) != 2 {
		t.Fatalf("len(ids) = %d, want 2", len(ids))
	}
}

func TestVaultBatchOverallPercent(t *testing.T) {
	t.Parallel()

	if got := vaultBatchOverallPercent(0, 0); got != 100 {
		t.Fatalf("0/0 percent = %v, want 100", got)
	}
	if got := vaultBatchOverallPercent(1, 4); got != 25 {
		t.Fatalf("1/4 percent = %v, want 25", got)
	}
	if got := vaultBatchOverallPercent(10, 4); got != 100 {
		t.Fatalf("10/4 percent = %v, want 100", got)
	}
}

func TestDecodeBatchVaultRequest(t *testing.T) {
	t.Parallel()

	r := httptestRequest("{\"enabled\":true,\"itemIds\":[\"313cd29a-f536-4706-9c92-58a0a93cf5bc\"]}")
	req, err := decodeBatchVaultRequest(r)
	if err != nil {
		t.Fatalf("decode request failed: %v", err)
	}
	if req.Enabled == nil || !*req.Enabled {
		t.Fatalf("enabled not parsed")
	}
	if len(req.ItemIDs) != 1 {
		t.Fatalf("len(itemIds) = %d, want 1", len(req.ItemIDs))
	}
}

func httptestRequest(body string) *http.Request {
	req, _ := http.NewRequest(http.MethodPost, "/api/items/vault/batch", bytes.NewBufferString(body))
	return req
}
