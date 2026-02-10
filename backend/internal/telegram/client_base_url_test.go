package telegram

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestClient_GetMe_UsesCustomBaseURL(t *testing.T) {
	t.Parallel()

	var gotURL string
	client := NewClient("test-token", &http.Client{
		Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
			gotURL = req.URL.String()
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"ok":true,"result":{"id":1,"is_bot":true,"username":"demo"}}`)),
				Header:     make(http.Header),
				Request:    req,
			}, nil
		}),
	}, WithBaseURL("http://telegram-bot-api:8081"))

	if _, err := client.GetMe(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotURL != "http://telegram-bot-api:8081/bottest-token/getMe" {
		t.Fatalf("unexpected url: %s", gotURL)
	}
}

func TestClient_DownloadURLFromFilePath_UsesCustomBaseURL(t *testing.T) {
	t.Parallel()

	client := NewClient("test-token", nil, WithBaseURL("http://telegram-bot-api:8081/"))
	got := client.DownloadURLFromFilePath("/documents/abc.bin")
	want := "http://telegram-bot-api:8081/file/bottest-token/documents/abc.bin"
	if got != want {
		t.Fatalf("unexpected download url: got=%s want=%s", got, want)
	}
}
