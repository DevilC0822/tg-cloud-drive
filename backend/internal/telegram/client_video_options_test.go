package telegram

import (
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSendVideoByLocalPathWithOptions(t *testing.T) {
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
				    "message_id": 401,
				    "video": {"file_id":"video-id","file_unique_id":"video-uniq","file_size":789}
				  }
				}`)),
				Header:  make(http.Header),
				Request: req,
			}, nil
		}),
	})

	_, err := client.SendVideoByLocalPathWithOptions(
		context.Background(),
		"-100123",
		"/tmp/video.mp4",
		"cap",
		&SendVideoOptions{
			SupportsStreaming: true,
			DurationSeconds:   87,
			Width:             1080,
			Height:            1920,
			ThumbnailPath:     "/tmp/thumb.jpg",
			CoverPath:         "/tmp/cover.jpg",
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotPath == "" || !strings.Contains(gotPath, "/sendVideo") {
		t.Fatalf("unexpected path: %s", gotPath)
	}
	if !strings.Contains(gotBody, "supports_streaming=true") {
		t.Fatalf("expected supports_streaming in request body, got: %s", gotBody)
	}
	if !strings.Contains(gotBody, "duration=87") {
		t.Fatalf("expected duration in request body, got: %s", gotBody)
	}
	if !strings.Contains(gotBody, "width=1080") {
		t.Fatalf("expected width in request body, got: %s", gotBody)
	}
	if !strings.Contains(gotBody, "height=1920") {
		t.Fatalf("expected height in request body, got: %s", gotBody)
	}
	if !strings.Contains(gotBody, "thumbnail=file%3A%2F%2F%2Ftmp%2Fthumb.jpg") {
		t.Fatalf("expected thumbnail local file URI in request body, got: %s", gotBody)
	}
	if !strings.Contains(gotBody, "cover=file%3A%2F%2F%2Ftmp%2Fcover.jpg") {
		t.Fatalf("expected cover local file URI in request body, got: %s", gotBody)
	}
}

func TestSendVideoFileWithOptions_MultipartContainsThumbnailAndCover(t *testing.T) {
	t.Parallel()

	workdir := t.TempDir()
	thumbPath := filepath.Join(workdir, "thumb.jpg")
	coverPath := filepath.Join(workdir, "cover.jpg")
	if err := os.WriteFile(thumbPath, []byte("thumb"), 0o600); err != nil {
		t.Fatalf("write thumb failed: %v", err)
	}
	if err := os.WriteFile(coverPath, []byte("cover"), 0o600); err != nil {
		t.Fatalf("write cover failed: %v", err)
	}

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
				    "message_id": 402,
				    "video": {"file_id":"video-id","file_unique_id":"video-uniq","file_size":456}
				  }
				}`)),
				Header:  make(http.Header),
				Request: req,
			}, nil
		}),
	})

	_, err := client.SendVideoFileWithOptions(
		context.Background(),
		"-100123",
		"movie.mp4",
		strings.NewReader("video-content"),
		"cap",
		&SendVideoOptions{
			SupportsStreaming: true,
			DurationSeconds:   123,
			Width:             1920,
			Height:            1080,
			ThumbnailPath:     thumbPath,
			CoverPath:         coverPath,
		},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotPath == "" || !strings.Contains(gotPath, "/sendVideo") {
		t.Fatalf("unexpected path: %s", gotPath)
	}
	if !strings.Contains(gotBody, `name="supports_streaming"`) || !strings.Contains(gotBody, "true") {
		t.Fatalf("expected supports_streaming field in multipart body")
	}
	if !strings.Contains(gotBody, `name="duration"`) || !strings.Contains(gotBody, "123") {
		t.Fatalf("expected duration field in multipart body")
	}
	if !strings.Contains(gotBody, `name="width"`) || !strings.Contains(gotBody, "1920") {
		t.Fatalf("expected width field in multipart body")
	}
	if !strings.Contains(gotBody, `name="height"`) || !strings.Contains(gotBody, "1080") {
		t.Fatalf("expected height field in multipart body")
	}
	if !strings.Contains(gotBody, `name="thumbnail"; filename="thumb.jpg"`) {
		t.Fatalf("expected thumbnail multipart file field, got: %s", gotBody)
	}
	if !strings.Contains(gotBody, `name="cover"; filename="cover.jpg"`) {
		t.Fatalf("expected cover multipart file field, got: %s", gotBody)
	}
}
