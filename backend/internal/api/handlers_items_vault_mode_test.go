package api

import (
	"testing"

	"github.com/const/tg-cloud-drive/backend/internal/store"
)

func TestDetectVaultSpoilerMode(t *testing.T) {
	t.Parallel()

	jpeg := "image/jpeg"
	gif := "image/gif"
	webp := "image/webp"
	svg := "image/svg+xml"

	cases := []struct {
		name string
		item store.Item
		want vaultSpoilerMode
	}{
		{
			name: "视频走 sendVideo",
			item: store.Item{Type: store.ItemTypeVideo, Name: "a.mp4"},
			want: vaultSpoilerModeVideo,
		},
		{
			name: "gif 走 sendAnimation",
			item: store.Item{Type: store.ItemTypeImage, Name: "a.gif", MimeType: &gif},
			want: vaultSpoilerModeAnimation,
		},
		{
			name: "webp 走 sendAnimation",
			item: store.Item{Type: store.ItemTypeImage, Name: "a.webp", MimeType: &webp},
			want: vaultSpoilerModeAnimation,
		},
		{
			name: "jpg 走 sendPhoto",
			item: store.Item{Type: store.ItemTypeImage, Name: "a.jpg", MimeType: &jpeg},
			want: vaultSpoilerModePhoto,
		},
		{
			name: "svg 不支持",
			item: store.Item{Type: store.ItemTypeImage, Name: "a.svg", MimeType: &svg},
			want: vaultSpoilerModeNone,
		},
		{
			name: "非图片不支持",
			item: store.Item{Type: store.ItemTypeDocument, Name: "a.bin"},
			want: vaultSpoilerModeNone,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := detectVaultSpoilerMode(tc.item)
			if got != tc.want {
				t.Fatalf("detectVaultSpoilerMode()=%s, want=%s", got, tc.want)
			}
		})
	}
}
