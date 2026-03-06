package telegram

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

type capturedEditMessageRequest struct {
	path   string
	values url.Values
}

func TestEditMessageMediaByFileID_WithSpoiler(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name                 string
		responsePayload      string
		expectedMediaType    string
		expectedDocumentFile string
		expectedStreaming    bool
		call                 func(*Client) (Message, error)
	}{
		{
			name: "photo",
			responsePayload: `{
			  "ok": true,
			  "result": {"message_id": 901, "photo": [{"file_id":"photo-id","file_unique_id":"photo-uniq","file_size":1}]}
			}`,
			expectedMediaType:    editMessageMediaPhotoType,
			expectedDocumentFile: "photo-id",
			expectedStreaming:    false,
			call: func(c *Client) (Message, error) {
				return c.EditPhotoMessageByFileID(context.Background(), "-100123", 101, "photo-file-id", "cap", true)
			},
		},
		{
			name: "video",
			responsePayload: `{
			  "ok": true,
			  "result": {"message_id": 902, "video": {"file_id":"video-id","file_unique_id":"video-uniq","file_size":2}}
			}`,
			expectedMediaType:    editMessageMediaVideoType,
			expectedDocumentFile: "video-id",
			expectedStreaming:    true,
			call: func(c *Client) (Message, error) {
				return c.EditVideoMessageByFileID(context.Background(), "-100123", 102, "video-file-id", "cap2", true)
			},
		},
		{
			name: "animation",
			responsePayload: `{
			  "ok": true,
			  "result": {"message_id": 903, "animation": {"file_id":"anim-id","file_unique_id":"anim-uniq","file_size":3}}
			}`,
			expectedMediaType:    editMessageMediaAnimationType,
			expectedDocumentFile: "anim-id",
			expectedStreaming:    false,
			call: func(c *Client) (Message, error) {
				return c.EditAnimationMessageByFileID(context.Background(), "-100123", 103, "animation-file-id", "cap3", true)
			},
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var captured capturedEditMessageRequest
			client := newEditMediaTestClient(tc.responsePayload, &captured)

			msg, err := tc.call(client)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if captured.path == "" || !strings.Contains(captured.path, "/editMessageMedia") {
				t.Fatalf("unexpected path: %s", captured.path)
			}

			media := decodeMediaPayload(t, captured.values.Get("media"))
			if media["type"] != tc.expectedMediaType {
				t.Fatalf("media.type = %v, want %s", media["type"], tc.expectedMediaType)
			}
			if media["has_spoiler"] != true {
				t.Fatalf("media.has_spoiler = %v, want true", media["has_spoiler"])
			}
			if captured.values.Get("chat_id") != "-100123" {
				t.Fatalf("chat_id = %s, want -100123", captured.values.Get("chat_id"))
			}
			if captured.values.Get("message_id") == "" {
				t.Fatalf("message_id should not be empty")
			}

			_, hasStreaming := media["supports_streaming"]
			if hasStreaming != tc.expectedStreaming {
				t.Fatalf("supports_streaming present = %v, want %v", hasStreaming, tc.expectedStreaming)
			}

			if msg.Document.FileID != tc.expectedDocumentFile {
				t.Fatalf("normalized file_id = %s, want %s", msg.Document.FileID, tc.expectedDocumentFile)
			}
		})
	}
}

func newEditMediaTestClient(payload string, captured *capturedEditMessageRequest) *Client {
	return NewClient("test-token", &http.Client{
		Transport: roundTripperFunc(func(req *http.Request) (*http.Response, error) {
			captured.path = req.URL.Path
			body, _ := io.ReadAll(req.Body)
			values, _ := url.ParseQuery(string(body))
			captured.values = values
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(payload)),
				Header:     make(http.Header),
				Request:    req,
			}, nil
		}),
	})
}

func decodeMediaPayload(t *testing.T, raw string) map[string]any {
	t.Helper()

	if strings.TrimSpace(raw) == "" {
		t.Fatalf("media payload is empty")
	}
	var out map[string]any
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		t.Fatalf("decode media payload failed: %v", err)
	}
	return out
}
