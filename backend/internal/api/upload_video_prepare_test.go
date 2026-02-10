package api

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/const/tg-cloud-drive/backend/internal/config"
)

func TestCreatePreprocessTempFilePreferInputDir(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	inputPath := filepath.Join(dir, "input.mp4")

	tmp, err := createPreprocessTempFile(inputPath, "tgcd-test-*.tmp")
	if err != nil {
		t.Fatalf("createPreprocessTempFile returned error: %v", err)
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()

	if got, want := filepath.Dir(tmp.Name()), dir; got != want {
		t.Fatalf("unexpected temp dir: got %q want %q", got, want)
	}
}

func TestCreatePreprocessTempFileWithEmptyInput(t *testing.T) {
	t.Parallel()

	tmp, err := createPreprocessTempFile("", "tgcd-test-*.tmp")
	if err != nil {
		t.Fatalf("createPreprocessTempFile returned error: %v", err)
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()

	if tmp.Name() == "" {
		t.Fatalf("temp file path should not be empty")
	}
}

func TestPrepareVideoUploadAssetsLocalPathCompatibility(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	inputPath := filepath.Join(dir, "input.mp4")
	if err := os.WriteFile(inputPath, []byte("fake-video"), 0o644); err != nil {
		t.Fatalf("write input file failed: %v", err)
	}

	ffmpegPath := filepath.Join(dir, "fake-ffmpeg.sh")
	script := strings.Join([]string{
		"#!/bin/sh",
		"set -eu",
		"in=\"\"",
		"last=\"\"",
		"prev=\"\"",
		"for arg in \"$@\"; do",
		"  if [ \"$prev\" = \"-i\" ]; then in=\"$arg\"; fi",
		"  prev=\"$arg\"",
		"  last=\"$arg\"",
		"done",
		"if [ -z \"$last\" ]; then",
		"  exit 1",
		"fi",
		"if [ -n \"$in\" ]; then",
		"  cp \"$in\" \"$last\"",
		"else",
		"  : >\"$last\"",
		"fi",
	}, "\n")
	if err := os.WriteFile(ffmpegPath, []byte(script), 0o755); err != nil {
		t.Fatalf("write fake ffmpeg failed: %v", err)
	}

	srv := &Server{
		logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		cfg: config.Config{
			FFmpegBinary: ffmpegPath,
		},
	}

	prepared := srv.prepareVideoUploadAssets(context.Background(), "input.mp4", inputPath)
	defer prepared.cleanup()

	if !prepared.process.FaststartApplied {
		t.Fatalf("expected faststart to be applied")
	}
	if !prepared.process.PreviewAttached {
		t.Fatalf("expected preview to be attached")
	}
	if prepared.options == nil {
		t.Fatalf("expected video options to be initialized")
	}
	if prepared.options.ThumbnailPath == "" || prepared.options.CoverPath == "" {
		t.Fatalf("expected thumbnail and cover path to be set")
	}

	if got, want := filepath.Dir(prepared.filePath), dir; got != want {
		t.Fatalf("faststart output should be in source directory: got=%q want=%q", got, want)
	}
	if got, want := filepath.Dir(prepared.options.ThumbnailPath), dir; got != want {
		t.Fatalf("preview output should be in source directory: got=%q want=%q", got, want)
	}

	if info, err := os.Stat(prepared.filePath); err != nil {
		t.Fatalf("stat faststart output failed: %v", err)
	} else if perm := info.Mode().Perm(); perm != 0o644 {
		t.Fatalf("faststart output perm mismatch: got=%#o want=0644", perm)
	}
	if info, err := os.Stat(prepared.options.ThumbnailPath); err != nil {
		t.Fatalf("stat preview output failed: %v", err)
	} else if perm := info.Mode().Perm(); perm != 0o644 {
		t.Fatalf("preview output perm mismatch: got=%#o want=0644", perm)
	}
}
