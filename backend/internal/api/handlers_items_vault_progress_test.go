package api

import (
	"net/http/httptest"
	"testing"
)

func TestIsVaultProgressStreamRequested(t *testing.T) {
	t.Parallel()

	yesCases := []string{"1", "true", "TRUE", " yes ", "on"}
	for _, raw := range yesCases {
		if !isVaultProgressStreamRequested(raw) {
			t.Fatalf("expected %q to enable vault progress stream", raw)
		}
	}

	noCases := []string{"", "0", "false", "off", "random"}
	for _, raw := range noCases {
		if isVaultProgressStreamRequested(raw) {
			t.Fatalf("expected %q to disable vault progress stream", raw)
		}
	}
}

func TestVaultSpoilerProgressPercent(t *testing.T) {
	t.Parallel()

	if got := vaultSpoilerProgressPercent(0, 0); got != 100 {
		t.Fatalf("zero total percent = %v, want 100", got)
	}
	if got := vaultSpoilerProgressPercent(2, 4); got != 50 {
		t.Fatalf("2/4 percent = %v, want 50", got)
	}
	if got := vaultSpoilerProgressPercent(10, 4); got != 100 {
		t.Fatalf("overflow percent = %v, want 100", got)
	}
}

func TestResolveResponseWriterFlusherWithWrappedRecorder(t *testing.T) {
	t.Parallel()

	base := httptest.NewRecorder()
	wrapped := &responseRecorder{ResponseWriter: base, status: 200}

	if _, ok := resolveResponseWriterFlusher(wrapped); !ok {
		t.Fatal("expected wrapped response writer to resolve flusher")
	}
}
