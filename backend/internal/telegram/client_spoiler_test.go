package telegram

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestSendPhotoByFileID_WithSpoiler(t *testing.T) {
	t.Parallel()

	var gotPath string
	var gotBody string
	client := NewClient("test-token", &http.Client{
		Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
			gotPath = req.URL.Path
			body, _ := io.ReadAll(req.Body)
			gotBody = string(body)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(`{
				  "ok": true,
				  "result": {
				    "message_id": 101,
				    "photo": [
				      {"file_id":"photo-id","file_unique_id":"photo-uniq","file_size":123}
				    ]
				  }
				}`)),
				Header:  make(http.Header),
				Request: req,
			}, nil
		}),
	})

	msg, err := client.SendPhotoByFileID(context.Background(), "-100123", "file-id-1", "cap", true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotPath == "" || !strings.Contains(gotPath, "/sendPhoto") {
		t.Fatalf("unexpected path: %s", gotPath)
	}
	if !strings.Contains(gotBody, "has_spoiler=true") {
		t.Fatalf("expected has_spoiler in request body, got: %s", gotBody)
	}
	if msg.Document.FileID != "photo-id" {
		t.Fatalf("expected normalized document file_id, got: %s", msg.Document.FileID)
	}
}

func TestSendVideoByFileID_WithSpoiler(t *testing.T) {
	t.Parallel()

	var gotPath string
	var gotBody string
	client := NewClient("test-token", &http.Client{
		Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
			gotPath = req.URL.Path
			body, _ := io.ReadAll(req.Body)
			gotBody = string(body)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(`{
				  "ok": true,
				  "result": {
				    "message_id": 202,
				    "video": {"file_id":"video-id","file_unique_id":"video-uniq","file_size":456}
				  }
				}`)),
				Header:  make(http.Header),
				Request: req,
			}, nil
		}),
	})

	msg, err := client.SendVideoByFileID(context.Background(), "-100123", "file-id-2", "cap2", true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotPath == "" || !strings.Contains(gotPath, "/sendVideo") {
		t.Fatalf("unexpected path: %s", gotPath)
	}
	if !strings.Contains(gotBody, "has_spoiler=true") {
		t.Fatalf("expected has_spoiler in request body, got: %s", gotBody)
	}
	if !strings.Contains(gotBody, "supports_streaming=true") {
		t.Fatalf("expected supports_streaming in request body, got: %s", gotBody)
	}
	if msg.Document.FileID != "video-id" {
		t.Fatalf("expected normalized document file_id, got: %s", msg.Document.FileID)
	}
}

func TestSendAnimationByFileID_WithSpoiler(t *testing.T) {
	t.Parallel()

	var gotPath string
	var gotBody string
	client := NewClient("test-token", &http.Client{
		Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
			gotPath = req.URL.Path
			body, _ := io.ReadAll(req.Body)
			gotBody = string(body)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body: io.NopCloser(strings.NewReader(`{
				  "ok": true,
				  "result": {
				    "message_id": 303,
				    "animation": {"file_id":"anim-id","file_unique_id":"anim-uniq","file_size":789}
				  }
				}`)),
				Header:  make(http.Header),
				Request: req,
			}, nil
		}),
	})

	msg, err := client.SendAnimationByFileID(context.Background(), "-100123", "file-id-3", "cap3", true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotPath == "" || !strings.Contains(gotPath, "/sendAnimation") {
		t.Fatalf("unexpected path: %s", gotPath)
	}
	if !strings.Contains(gotBody, "has_spoiler=true") {
		t.Fatalf("expected has_spoiler in request body, got: %s", gotBody)
	}
	if msg.Document.FileID != "anim-id" {
		t.Fatalf("expected normalized document file_id, got: %s", msg.Document.FileID)
	}
}
