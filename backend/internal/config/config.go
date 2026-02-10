package config

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	DatabaseURL                   string
	TGStorageChatID               string
	SelfHostedBotAPICredentialDir string
	SelfHostedBotAPIUploadDir     string

	CookieSecret []byte
	CookieSecure bool
	CookieMaxAge int // 秒

	ChunkSizeBytes               int64
	UploadConcurrencyDefault     int
	DownloadConcurrencyDefault   int
	ReservedDiskBytesDefault     int64
	UploadSessionTTL             time.Duration
	UploadSessionCleanupInterval time.Duration
	ThumbnailCacheMaxBytes       int64
	ThumbnailCacheTTL            time.Duration
	ThumbnailGenerateConcurrency int
	ThumbnailCacheDir            string
	FFmpegBinary                 string

	BaseURL         string
	FrontendOrigin  string
	AllowDevNoAuth  bool
	ListenHost      string
	ListenPort      int
	PublicURLHeader string
}

func Load() (Config, error) {
	var cfg Config

	cfg.DatabaseURL = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if cfg.DatabaseURL == "" {
		// 兼容 docker-compose 默认拓扑：postgres 服务名 + tgcd 默认账号库名。
		cfg.DatabaseURL = "postgres://tgcd:tgcd@postgres:5432/tgcd?sslmode=disable"
	}
	cfg.BaseURL = strings.TrimSpace(os.Getenv("BASE_URL"))
	cfg.FrontendOrigin = strings.TrimSpace(os.Getenv("FRONTEND_ORIGIN"))
	cfg.SelfHostedBotAPICredentialDir = strings.TrimSpace(os.Getenv("SELF_HOSTED_BOT_API_SECRET_DIR"))
	if cfg.SelfHostedBotAPICredentialDir == "" {
		cfg.SelfHostedBotAPICredentialDir = "/var/lib/tgcd-runtime/self-hosted-bot-api"
	}
	cfg.SelfHostedBotAPIUploadDir = strings.TrimSpace(os.Getenv("SELF_HOSTED_BOT_API_UPLOAD_DIR"))
	if cfg.SelfHostedBotAPIUploadDir == "" {
		cfg.SelfHostedBotAPIUploadDir = "/var/lib/tgcd-runtime/self-hosted-bot-api-upload"
	}

	cfg.ListenHost = strings.TrimSpace(os.Getenv("HOST"))
	if cfg.ListenHost == "" {
		cfg.ListenHost = "0.0.0.0"
	}

	cfg.ListenPort = intFromEnv("PORT", 8080)
	cfg.CookieMaxAge = intFromEnv("COOKIE_MAX_AGE_SECONDS", 7*24*3600)
	cfg.CookieSecure = boolFromEnv("COOKIE_SECURE", false)
	cfg.ChunkSizeBytes = int64FromEnv("CHUNK_SIZE_BYTES", 20*1024*1024)
	cfg.UploadConcurrencyDefault = intFromEnv("UPLOAD_CONCURRENCY", 1)
	cfg.DownloadConcurrencyDefault = intFromEnv("DOWNLOAD_CONCURRENCY", 2)
	cfg.ReservedDiskBytesDefault = int64FromEnv("RESERVED_DISK_BYTES", 2*1024*1024*1024)
	cfg.UploadSessionTTL = time.Duration(intFromEnv("UPLOAD_SESSION_TTL_HOURS", 24)) * time.Hour
	cfg.UploadSessionCleanupInterval = time.Duration(intFromEnv("UPLOAD_SESSION_CLEANUP_INTERVAL_MINUTES", 30)) * time.Minute
	cfg.ThumbnailCacheMaxBytes = int64FromEnv("THUMBNAIL_CACHE_MAX_BYTES", 512*1024*1024)
	cfg.ThumbnailCacheTTL = time.Duration(intFromEnv("THUMBNAIL_CACHE_TTL_HOURS", 30*24)) * time.Hour
	cfg.ThumbnailGenerateConcurrency = intFromEnv("THUMBNAIL_GENERATE_CONCURRENCY", 1)
	cfg.ThumbnailCacheDir = strings.TrimSpace(os.Getenv("THUMBNAIL_CACHE_DIR"))
	cfg.FFmpegBinary = strings.TrimSpace(os.Getenv("FFMPEG_BINARY"))
	if cfg.FFmpegBinary == "" {
		cfg.FFmpegBinary = "ffmpeg"
	}
	cfg.AllowDevNoAuth = boolFromEnv("ALLOW_DEV_NO_AUTH", false)
	cfg.PublicURLHeader = strings.TrimSpace(os.Getenv("PUBLIC_URL_HEADER"))

	if cfg.UploadConcurrencyDefault < 1 {
		cfg.UploadConcurrencyDefault = 1
	}
	if cfg.DownloadConcurrencyDefault < 1 {
		cfg.DownloadConcurrencyDefault = 1
	}
	if cfg.ReservedDiskBytesDefault < 0 {
		cfg.ReservedDiskBytesDefault = 0
	}
	if cfg.UploadSessionTTL <= 0 {
		cfg.UploadSessionTTL = 24 * time.Hour
	}
	if cfg.UploadSessionCleanupInterval <= 0 {
		cfg.UploadSessionCleanupInterval = 30 * time.Minute
	}
	if cfg.ThumbnailCacheMaxBytes < 0 {
		cfg.ThumbnailCacheMaxBytes = 0
	}
	if cfg.ThumbnailCacheTTL <= 0 {
		cfg.ThumbnailCacheTTL = 30 * 24 * time.Hour
	}
	if cfg.ThumbnailGenerateConcurrency < 1 {
		cfg.ThumbnailGenerateConcurrency = 1
	}

	secretB64 := strings.TrimSpace(os.Getenv("COOKIE_SECRET_B64"))
	if secretB64 != "" {
		secret, err := base64.StdEncoding.DecodeString(secretB64)
		if err != nil {
			return Config{}, fmt.Errorf("COOKIE_SECRET_B64 不是合法 base64: %w", err)
		}
		if len(secret) < 32 {
			return Config{}, errors.New("COOKIE_SECRET_B64 长度不足（建议 >= 32 字节）")
		}
		cfg.CookieSecret = secret
	} else {
		// 兜底：没有显式配置时自动生成（重启会导致所有登录失效）
		secret := make([]byte, 32)
		if _, err := rand.Read(secret); err != nil {
			return Config{}, fmt.Errorf("生成 COOKIE_SECRET 失败: %w", err)
		}
		cfg.CookieSecret = secret
	}

	return cfg, nil
}

func (c Config) ListenAddr() string {
	return fmt.Sprintf("%s:%d", c.ListenHost, c.ListenPort)
}

func intFromEnv(key string, def int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return v
}

func int64FromEnv(key string, def int64) int64 {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	v, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return def
	}
	return v
}

func boolFromEnv(key string, def bool) bool {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if raw == "" {
		return def
	}
	switch raw {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return def
	}
}
