package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/const/tg-cloud-drive/backend/internal/config"
)

func TestNormalizeRequestHost(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		in   string
		want string
	}{
		{name: "domain with port", in: "pan.example.com:443", want: "pan.example.com"},
		{name: "domain without port", in: "pan.example.com", want: "pan.example.com"},
		{name: "ipv4 with port", in: "127.0.0.1:8080", want: "127.0.0.1"},
		{name: "ipv4 without port", in: "127.0.0.1", want: "127.0.0.1"},
		{name: "ipv6 with port", in: "[2001:db8::1]:443", want: "2001:db8::1"},
		{name: "ipv6 without port bracket", in: "[2001:db8::1]", want: "2001:db8::1"},
		{name: "ipv6 without bracket", in: "::1", want: "::1"},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := normalizeRequestHost(tc.in); got != tc.want {
				t.Fatalf("normalizeRequestHost(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestIsIPLiteralHost(t *testing.T) {
	t.Parallel()

	if !isIPLiteralHost("127.0.0.1") {
		t.Fatal("expected ipv4 literal to be true")
	}
	if !isIPLiteralHost("2001:db8::1") {
		t.Fatal("expected ipv6 literal to be true")
	}
	if isIPLiteralHost("pan.example.com") {
		t.Fatal("expected domain host to be false")
	}
}

func TestRejectIPHostMiddleware(t *testing.T) {
	t.Parallel()

	server := &Server{
		cfg: config.Config{
			DisableIPPortAccess: true,
		},
	}

	t.Run("deny ip host", func(t *testing.T) {
		t.Parallel()

		nextCalled := false
		handler := server.rejectIPHostMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			nextCalled = true
			w.WriteHeader(http.StatusNoContent)
		}))

		req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:8080/api/setup/status", nil)
		req.Host = "127.0.0.1:8080"
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusForbidden {
			t.Fatalf("unexpected status: got %d want %d", rr.Code, http.StatusForbidden)
		}
		if nextCalled {
			t.Fatal("expected next handler not to be called for ip host")
		}
	})

	t.Run("allow domain host", func(t *testing.T) {
		t.Parallel()

		nextCalled := false
		handler := server.rejectIPHostMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			nextCalled = true
			w.WriteHeader(http.StatusNoContent)
		}))

		req := httptest.NewRequest(http.MethodGet, "http://pan.example.com/api/setup/status", nil)
		req.Host = "pan.example.com"
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusNoContent {
			t.Fatalf("unexpected status: got %d want %d", rr.Code, http.StatusNoContent)
		}
		if !nextCalled {
			t.Fatal("expected next handler to be called for domain host")
		}
	})
}
