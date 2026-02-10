package api

import "testing"

func TestSelectTelegramUploadKind(t *testing.T) {
	tests := []struct {
		name     string
		fileName string
		mimeType string
		want     telegramUploadKind
	}{
		{
			name:     "mp4 按视频发送",
			fileName: "movie.mp4",
			mimeType: "application/octet-stream",
			want:     telegramUploadKindVideo,
		},
		{
			name:     "视频 MIME 优先视频发送",
			fileName: "blob.bin",
			mimeType: "video/mp4",
			want:     telegramUploadKindVideo,
		},
		{
			name:     "mov 按视频发送",
			fileName: "movie.mov",
			mimeType: "",
			want:     telegramUploadKindVideo,
		},
		{
			name:     "mkv 按视频发送",
			fileName: "movie.mkv",
			mimeType: "",
			want:     telegramUploadKindVideo,
		},
		{
			name:     "webm 按视频发送",
			fileName: "movie.webm",
			mimeType: "",
			want:     telegramUploadKindVideo,
		},
		{
			name:     "avi 按视频发送",
			fileName: "movie.avi",
			mimeType: "",
			want:     telegramUploadKindVideo,
		},
		{
			name:     "3gp 按视频发送",
			fileName: "movie.3gp",
			mimeType: "",
			want:     telegramUploadKindVideo,
		},
		{
			name:     "jpg 按图片发送",
			fileName: "cover.jpg",
			mimeType: "",
			want:     telegramUploadKindPhoto,
		},
		{
			name:     "png MIME 含参数按图片发送",
			fileName: "cover",
			mimeType: "image/png; charset=utf-8",
			want:     telegramUploadKindPhoto,
		},
		{
			name:     "mp3 按音频发送",
			fileName: "track.mp3",
			mimeType: "",
			want:     telegramUploadKindAudio,
		},
		{
			name:     "音频 MIME 按音频发送",
			fileName: "track",
			mimeType: "audio/ogg",
			want:     telegramUploadKindAudio,
		},
		{
			name:     "gif 按动图发送",
			fileName: "anim.gif",
			mimeType: "image/gif",
			want:     telegramUploadKindAnimation,
		},
		{
			name:     "gif MIME 按动图发送",
			fileName: "anim.bin",
			mimeType: "image/gif",
			want:     telegramUploadKindAnimation,
		},
		{
			name:     "svg 默认文档",
			fileName: "vector.svg",
			mimeType: "image/svg+xml",
			want:     telegramUploadKindDocument,
		},
		{
			name:     "未知类型默认文档",
			fileName: "archive.bin",
			mimeType: "application/octet-stream",
			want:     telegramUploadKindDocument,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := selectTelegramUploadKind(tc.fileName, tc.mimeType)
			if got != tc.want {
				t.Fatalf("selectTelegramUploadKind() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestBuildFaststartOutputName(t *testing.T) {
	tests := []struct {
		name     string
		fileName string
		want     string
	}{
		{
			name:     "mp4 保持基础名称并标准化后缀",
			fileName: "movie.mp4",
			want:     "movie.mp4",
		},
		{
			name:     "mov 转为 mp4 后缀",
			fileName: "movie.mov",
			want:     "movie.mp4",
		},
		{
			name:     "无后缀补齐 mp4",
			fileName: "movie",
			want:     "movie.mp4",
		},
		{
			name:     "空名称使用默认",
			fileName: "",
			want:     "video.mp4",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := buildFaststartOutputName(tc.fileName)
			if got != tc.want {
				t.Fatalf("buildFaststartOutputName() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestOfficialBotAPISingleUploadLimitBytes(t *testing.T) {
	tests := []struct {
		name     string
		fileName string
		mimeType string
		want     int64
	}{
		{
			name:     "普通图片 10MB 限制",
			fileName: "cover.jpg",
			mimeType: "image/jpeg",
			want:     telegramBotAPIMaxPhotoUploadBytes,
		},
		{
			name:     "gif 走 animation 使用 50MB 限制",
			fileName: "anim.gif",
			mimeType: "image/gif",
			want:     telegramBotAPIMaxGeneralUploadBytes,
		},
		{
			name:     "视频 50MB 限制",
			fileName: "movie.mp4",
			mimeType: "video/mp4",
			want:     telegramBotAPIMaxGeneralUploadBytes,
		},
		{
			name:     "文档 50MB 限制",
			fileName: "archive.zip",
			mimeType: "application/zip",
			want:     telegramBotAPIMaxGeneralUploadBytes,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := officialBotAPISingleUploadLimitBytes(tc.fileName, tc.mimeType)
			if got != tc.want {
				t.Fatalf("officialBotAPISingleUploadLimitBytes() = %d, want %d", got, tc.want)
			}
		})
	}
}
