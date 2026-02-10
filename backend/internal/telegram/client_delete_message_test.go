package telegram

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func testTelegramClient(t *testing.T, payload string) *Client {
	t.Helper()

	httpClient := &http.Client{
		Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(payload)),
				Header:     make(http.Header),
				Request:    req,
			}, nil
		}),
	}
	return NewClient("test-token", httpClient)
}

func TestDeleteMessage_IgnoresOnlyNotFoundLikeErrors(t *testing.T) {
	t.Parallel()

	client := testTelegramClient(t, `{"ok":false,"error_code":400,"description":"Bad Request: message to delete not found"}`)
	if err := client.DeleteMessage(context.Background(), "-100123", 1); err != nil {
		t.Fatalf("expected nil error for not found message, got: %v", err)
	}
}

func TestDeleteMessage_ReturnsErrorWhenCannotDelete(t *testing.T) {
	t.Parallel()

	client := testTelegramClient(t, `{"ok":false,"error_code":400,"description":"Bad Request: message can't be deleted for everyone"}`)
	if err := client.DeleteMessage(context.Background(), "-100123", 1); err == nil {
		t.Fatalf("expected error when telegram says message can't be deleted")
	}
}

