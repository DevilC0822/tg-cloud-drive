package api

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestBuildTelegramLocalFileCandidates(t *testing.T) {
	t.Run("absolute path", func(t *testing.T) {
		got := buildTelegramLocalFileCandidates("/tmp/a.mp4")
		want := []string{"/tmp/a.mp4"}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("buildTelegramLocalFileCandidates() = %#v, want %#v", got, want)
		}
	})

	t.Run("relative path", func(t *testing.T) {
		got := buildTelegramLocalFileCandidates("abc/def.mp4")
		want := []string{filepath.Join(telegramBotAPILocalDataDir, "abc/def.mp4")}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("buildTelegramLocalFileCandidates() = %#v, want %#v", got, want)
		}
	})

	t.Run("invalid traversal path", func(t *testing.T) {
		got := buildTelegramLocalFileCandidates("../etc/passwd")
		if len(got) != 0 {
			t.Fatalf("expected no candidates for traversal path, got %#v", got)
		}
	})
}

func TestOpenTelegramLocalFileByFilePath(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "video.mp4")
	if err := os.WriteFile(path, []byte("test-video"), 0o644); err != nil {
		t.Fatalf("write temp file failed: %v", err)
	}

	f, resolvedPath, err := openTelegramLocalFileByFilePath(path)
	if err != nil {
		t.Fatalf("openTelegramLocalFileByFilePath returned error: %v", err)
	}
	defer f.Close()

	if resolvedPath != path {
		t.Fatalf("resolvedPath = %q, want %q", resolvedPath, path)
	}
}
