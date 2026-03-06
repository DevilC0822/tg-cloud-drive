package api

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/const/tg-cloud-drive/backend/internal/store"
)

func TestCanRetryTorrentTaskByDirectUpload(t *testing.T) {
	dir := t.TempDir()

	existingFile := filepath.Join(dir, "ok.bin")
	if err := os.WriteFile(existingFile, []byte("data"), 0o600); err != nil {
		t.Fatalf("write existingFile failed: %v", err)
	}

	emptyFile := filepath.Join(dir, "empty.bin")
	if err := os.WriteFile(emptyFile, nil, 0o600); err != nil {
		t.Fatalf("write emptyFile failed: %v", err)
	}

	tests := []struct {
		name  string
		files []store.TorrentTaskFile
		want  bool
	}{
		{
			name: "至少一个文件且全部存在可读",
			files: []store.TorrentTaskFile{
				{FilePath: existingFile},
			},
			want: true,
		},
		{
			name:  "空列表不允许直接上传重试",
			files: nil,
			want:  false,
		},
		{
			name: "路径为空不允许直接上传重试",
			files: []store.TorrentTaskFile{
				{FilePath: "   "},
			},
			want: false,
		},
		{
			name: "文件不存在不允许直接上传重试",
			files: []store.TorrentTaskFile{
				{FilePath: filepath.Join(dir, "missing.bin")},
			},
			want: false,
		},
		{
			name: "空文件不允许直接上传重试",
			files: []store.TorrentTaskFile{
				{FilePath: emptyFile},
			},
			want: false,
		},
		{
			name: "目录不允许直接上传重试",
			files: []store.TorrentTaskFile{
				{FilePath: dir},
			},
			want: false,
		},
		{
			name: "任一文件不可用则整体不允许",
			files: []store.TorrentTaskFile{
				{FilePath: existingFile},
				{FilePath: filepath.Join(dir, "missing.bin")},
			},
			want: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := canRetryTorrentTaskByDirectUpload(tc.files)
			if got != tc.want {
				t.Fatalf("canRetryTorrentTaskByDirectUpload() = %v, want %v", got, tc.want)
			}
		})
	}
}
