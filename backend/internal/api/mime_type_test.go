package api

import (
	"testing"

	"github.com/const/tg-cloud-drive/backend/internal/store"
)

func TestNormalizeUploadMimeType(t *testing.T) {
	tests := []struct {
		name     string
		fileName string
		rawMime  string
		want     string
	}{
		{
			name:     "保留明确 MIME",
			fileName: "video.bin",
			rawMime:  "video/mp4; charset=utf-8",
			want:     "video/mp4",
		},
		{
			name:     "octet-stream 回退扩展名",
			fileName: "movie.mp4",
			rawMime:  "application/octet-stream",
			want:     "video/mp4",
		},
		{
			name:     "空 MIME 回退扩展名",
			fileName: "movie.mp4",
			rawMime:  "",
			want:     "video/mp4",
		},
		{
			name:     "未知扩展保持空值",
			fileName: "movie.unknownext",
			rawMime:  "",
			want:     "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizeUploadMimeType(tc.fileName, tc.rawMime)
			if got != tc.want {
				t.Fatalf("normalizeUploadMimeType() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestResolveDownloadMimeType(t *testing.T) {
	videoMime := "video/mp4; charset=utf-8"
	octetMime := "application/octet-stream"

	tests := []struct {
		name string
		item store.Item
		want string
	}{
		{
			name: "保留明确 MIME",
			item: store.Item{
				Name:     "movie.bin",
				MimeType: &videoMime,
			},
			want: "video/mp4",
		},
		{
			name: "octet-stream 回退扩展名",
			item: store.Item{
				Name:     "movie.mp4",
				MimeType: &octetMime,
			},
			want: "video/mp4",
		},
		{
			name: "空 MIME 回退扩展名",
			item: store.Item{
				Name: "movie.mp4",
			},
			want: "video/mp4",
		},
		{
			name: "未知扩展回退 octet-stream",
			item: store.Item{
				Name: "movie.unknownext",
			},
			want: "application/octet-stream",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := resolveDownloadMimeType(tc.item)
			if got != tc.want {
				t.Fatalf("resolveDownloadMimeType() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestShouldInlinePreviewDownload(t *testing.T) {
	tests := []struct {
		name          string
		itemType      store.ItemType
		mimeType      string
		forceDownload bool
		want          bool
	}{
		{
			name:          "强制下载关闭预览",
			itemType:      store.ItemTypeVideo,
			mimeType:      "video/mp4",
			forceDownload: true,
			want:          false,
		},
		{
			name:          "可预览 MIME 走 inline",
			itemType:      store.ItemTypeOther,
			mimeType:      "video/mp4",
			forceDownload: false,
			want:          true,
		},
		{
			name:          "视频类型即使 MIME 非预览也 inline",
			itemType:      store.ItemTypeVideo,
			mimeType:      "application/octet-stream",
			forceDownload: false,
			want:          true,
		},
		{
			name:          "非可预览类型保持 attachment",
			itemType:      store.ItemTypeDocument,
			mimeType:      "application/octet-stream",
			forceDownload: false,
			want:          false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := shouldInlinePreviewDownload(tc.itemType, tc.mimeType, tc.forceDownload)
			if got != tc.want {
				t.Fatalf("shouldInlinePreviewDownload() = %v, want %v", got, tc.want)
			}
		})
	}
}
