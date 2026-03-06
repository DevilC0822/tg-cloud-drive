package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"tg-cloud-drive-api/internal/config"
	"tg-cloud-drive-api/internal/store"
)

func TestBuildVaultStatusResponse(t *testing.T) {
	t.Parallel()

	now := time.Unix(1_700_000_000, 0)
	server := &Server{
		cfg: config.Config{
			CookieSecret: []byte("0123456789abcdef0123456789abcdef"),
		},
	}

	disabled := server.buildVaultStatusResponse(
		httptest.NewRequest(http.MethodGet, "/api/vault/status", nil),
		store.RuntimeSettings{},
		now,
	)
	if disabled.Enabled {
		t.Fatalf("disabled.Enabled = true, want false")
	}
	if disabled.Unlocked {
		t.Fatalf("disabled.Unlocked = true, want false")
	}

	settings := store.RuntimeSettings{
		VaultPasswordHash:   "vault-hash",
		VaultSessionTTLMins: 60,
	}

	locked := server.buildVaultStatusResponse(
		httptest.NewRequest(http.MethodGet, "/api/vault/status", nil),
		settings,
		now,
	)
	if !locked.Enabled {
		t.Fatalf("locked.Enabled = false, want true")
	}
	if locked.Unlocked {
		t.Fatalf("locked.Unlocked = true, want false")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/vault/status", nil)
	req.AddCookie(&http.Cookie{
		Name:  vaultCookieName,
		Value: buildVaultCookieValue(now, server.cfg.CookieSecret, settings.VaultPasswordHash),
	})

	unlocked := server.buildVaultStatusResponse(req, settings, now.Add(5*time.Minute))
	if !unlocked.Enabled {
		t.Fatalf("unlocked.Enabled = false, want true")
	}
	if !unlocked.Unlocked {
		t.Fatalf("unlocked.Unlocked = false, want true")
	}
	if unlocked.ExpiresAt == "" {
		t.Fatalf("unlocked.ExpiresAt empty, want populated value")
	}
}

func TestWriteVaultListResponses(t *testing.T) {
	t.Parallel()

	vault := &vaultStatusResponse{
		Enabled:  true,
		Unlocked: false,
	}

	t.Run("items", func(t *testing.T) {
		t.Parallel()

		rr := httptest.NewRecorder()
		writeItemsListResponse(rr, nil, newPaginationResponse(1, 50, 0), vault)

		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
		}

		var resp itemsListResponse
		if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if len(resp.Items) != 0 {
			t.Fatalf("items length = %d, want 0", len(resp.Items))
		}
		if resp.Vault == nil || resp.Vault.Unlocked {
			t.Fatalf("vault unlocked = %v, want false", resp.Vault)
		}
		if resp.Pagination.TotalPages != minimumPaginationTotalPages {
			t.Fatalf("totalPages = %d, want %d", resp.Pagination.TotalPages, minimumPaginationTotalPages)
		}
	})

	t.Run("folders", func(t *testing.T) {
		t.Parallel()

		rr := httptest.NewRecorder()
		writeFoldersListResponse(rr, nil, vault)

		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
		}

		var resp foldersListResponse
		if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if len(resp.Items) != 0 {
			t.Fatalf("items length = %d, want 0", len(resp.Items))
		}
		if resp.Vault == nil || resp.Vault.Unlocked {
			t.Fatalf("vault unlocked = %v, want false", resp.Vault)
		}
	})
}
