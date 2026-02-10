package api

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
)

const (
	selfHostedBotAPIIDFileName   = "telegram_api_id"
	selfHostedBotAPIHashFileName = "telegram_api_hash"
)

func (s *Server) syncSelfHostedBotAPICredentials(tgAPIID *int64, tgAPIHash *string) error {
	credentialDir := strings.TrimSpace(s.cfg.SelfHostedBotAPICredentialDir)
	if credentialDir == "" {
		return errors.New("未配置自建 Bot API 凭据目录")
	}
	if tgAPIID == nil || *tgAPIID <= 0 {
		return errors.New("自建 Bot API 模式下 API ID 必须是正整数")
	}
	if tgAPIHash == nil || strings.TrimSpace(*tgAPIHash) == "" {
		return errors.New("自建 Bot API 模式下 API Hash 不能为空")
	}

	if err := os.MkdirAll(credentialDir, 0o750); err != nil {
		return fmt.Errorf("创建自建 Bot API 凭据目录失败: %w", err)
	}

	idValue := strconv.FormatInt(*tgAPIID, 10)
	hashValue := strings.TrimSpace(*tgAPIHash)
	idFile := filepath.Join(credentialDir, selfHostedBotAPIIDFileName)
	hashFile := filepath.Join(credentialDir, selfHostedBotAPIHashFileName)

	if err := writeAtomicTextFile(idFile, idValue, 0o640); err != nil {
		return fmt.Errorf("写入 API ID 凭据文件失败: %w", err)
	}
	if err := writeAtomicTextFile(hashFile, hashValue, 0o640); err != nil {
		return fmt.Errorf("写入 API Hash 凭据文件失败: %w", err)
	}
	return nil
}

func (s *Server) syncSelfHostedBotAPICredentialsFromConfig(cfg store.SystemConfig) error {
	return s.syncSelfHostedBotAPICredentials(cfg.TGAPIID, cfg.TGAPIHash)
}

func (s *Server) loadSelfHostedBotAPICredentialsFromFiles() (*int64, *string, error) {
	credentialDir := strings.TrimSpace(s.cfg.SelfHostedBotAPICredentialDir)
	if credentialDir == "" {
		return nil, nil, errors.New("未配置自建 Bot API 凭据目录")
	}
	idFile := filepath.Join(credentialDir, selfHostedBotAPIIDFileName)
	hashFile := filepath.Join(credentialDir, selfHostedBotAPIHashFileName)

	idRaw, err := os.ReadFile(idFile)
	if err != nil {
		return nil, nil, err
	}
	hashRaw, err := os.ReadFile(hashFile)
	if err != nil {
		return nil, nil, err
	}

	idText := strings.TrimSpace(string(idRaw))
	hashText := strings.TrimSpace(string(hashRaw))
	if idText == "" || hashText == "" {
		return nil, nil, errors.New("自建 Bot API 凭据文件内容为空")
	}
	idValue, err := strconv.ParseInt(idText, 10, 64)
	if err != nil || idValue <= 0 {
		return nil, nil, errors.New("自建 Bot API API ID 凭据文件不是正整数")
	}

	hashValue := hashText
	return &idValue, &hashValue, nil
}

func writeAtomicTextFile(path string, value string, perm os.FileMode) error {
	dir := filepath.Dir(path)
	tmpFile, err := os.CreateTemp(dir, ".tmp-telegram-*")
	if err != nil {
		return err
	}
	tmpPath := tmpFile.Name()
	cleanup := true
	defer func() {
		_ = tmpFile.Close()
		if cleanup {
			_ = os.Remove(tmpPath)
		}
	}()

	if _, err := tmpFile.WriteString(strings.TrimSpace(value)); err != nil {
		return err
	}
	if err := tmpFile.Sync(); err != nil {
		return err
	}
	if err := tmpFile.Chmod(perm); err != nil {
		return err
	}
	if err := tmpFile.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return err
	}
	cleanup = false
	return nil
}

func runSetupConnectionTestWithRetry(
	ctx context.Context,
	tgBotToken string,
	tgStorageChatID string,
	accessMethod string,
	tgAPIBaseURL *string,
) setupConnectionTestDetails {
	if accessMethod != setupAccessMethodSelfHosted {
		return runSetupConnectionTest(ctx, tgBotToken, tgStorageChatID, accessMethod, tgAPIBaseURL)
	}

	const maxAttempts = 15
	const interval = 1200 * time.Millisecond
	var details setupConnectionTestDetails
	for attempt := 0; attempt < maxAttempts; attempt++ {
		details = runSetupConnectionTest(ctx, tgBotToken, tgStorageChatID, accessMethod, tgAPIBaseURL)
		if details.OverallOK {
			return details
		}
		if !isSelfHostedConnectionRetryable(details) || attempt == maxAttempts-1 {
			return details
		}
		select {
		case <-ctx.Done():
			details.Summary = "连接测试取消"
			if details.Bot.Error == "" {
				details.Bot.Error = ctx.Err().Error()
			}
			return details
		case <-time.After(interval):
		}
	}
	return details
}

func isSelfHostedConnectionRetryable(details setupConnectionTestDetails) bool {
	if details.OverallOK {
		return false
	}
	botErr := strings.ToLower(strings.TrimSpace(details.Bot.Error))
	if botErr == "" {
		return false
	}

	keywords := []string{
		"eof",
		"connection refused",
		"connection reset",
		"no such host",
		"i/o timeout",
		"context deadline exceeded",
		"server misbehaving",
		"internal server error: restart",
		"restart",
	}
	for _, keyword := range keywords {
		if strings.Contains(botErr, keyword) {
			return true
		}
	}
	return false
}
