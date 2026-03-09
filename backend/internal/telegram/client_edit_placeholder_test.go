package telegram

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestReplaceMessageWithDeletedPhoto_SendsEditMessageMediaUpload(t *testing.T) {
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
				Body:       io.NopCloser(strings.NewReader(`{"ok":true,"result":{"message_id":42}}`)),
				Header:     make(http.Header),
				Request:    req,
			}, nil
		}),
	})

	if err := client.ReplaceMessageWithDeletedPhoto(context.Background(), "-100123", 42, "文件已删除"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(gotPath, "/editMessageMedia") {
		t.Fatalf("unexpected path: %s", gotPath)
	}
	if !strings.Contains(gotBody, `name="media"`) || !strings.Contains(gotBody, `"type":"photo"`) {
		t.Fatalf("expected photo media payload, got: %s", gotBody)
	}
	if !strings.Contains(gotBody, `attach://replacement`) {
		t.Fatalf("expected attach reference in media payload, got: %s", gotBody)
	}
	if !strings.Contains(gotBody, `name="replacement"; filename="deleted.png"`) {
		t.Fatalf("expected replacement file part, got: %s", gotBody)
	}
	if !strings.Contains(gotBody, "文件已删除") {
		t.Fatalf("expected deleted placeholder text in multipart body, got: %s", gotBody)
	}
}

func TestReplaceMessageWithDeletedDocument_SendsDocumentPayload(t *testing.T) {
	t.Parallel()

	var gotBody string
	client := NewClient("test-token", &http.Client{
		Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
			body, _ := io.ReadAll(req.Body)
			gotBody = string(body)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"ok":true,"result":{"message_id":42}}`)),
				Header:     make(http.Header),
				Request:    req,
			}, nil
		}),
	})

	if err := client.ReplaceMessageWithDeletedDocument(context.Background(), "-100123", 42, "文件已删除"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(gotBody, `"type":"document"`) {
		t.Fatalf("expected document media payload, got: %s", gotBody)
	}
	if !strings.Contains(gotBody, `name="replacement"; filename="deleted.txt"`) {
		t.Fatalf("expected replacement text file part, got: %s", gotBody)
	}
}
