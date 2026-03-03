package api

import "testing"

func TestResolveStoredSizeByTelegramSize(t *testing.T) {
	tests := []struct {
		name         string
		telegramSize int64
		fallback     int64
		want         int64
	}{
		{
			name:         "优先 Telegram 文件大小",
			telegramSize: 1234,
			fallback:     999,
			want:         1234,
		},
		{
			name:         "Telegram 大小无效时回退",
			telegramSize: 0,
			fallback:     999,
			want:         999,
		},
		{
			name:         "回退值负数时归零",
			telegramSize: 0,
			fallback:     -1,
			want:         0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := resolveStoredSizeByTelegramSize(tc.telegramSize, tc.fallback)
			if got != tc.want {
				t.Fatalf("resolveStoredSizeByTelegramSize() = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestResolveStoredChunkSize(t *testing.T) {
	got := resolveStoredChunkSize(2048, 1024)
	if got != 2048 {
		t.Fatalf("resolveStoredChunkSize() = %d, want 2048", got)
	}
}
