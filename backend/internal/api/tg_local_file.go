package api

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

const telegramBotAPILocalDataDir = "/var/lib/telegram-bot-api"

func openTelegramLocalFileByFilePath(filePath string) (*os.File, string, error) {
	candidates := buildTelegramLocalFileCandidates(filePath)
	if len(candidates) == 0 {
		return nil, "", os.ErrNotExist
	}

	var lastErr error
	for _, candidate := range candidates {
		f, err := os.Open(candidate)
		if err == nil {
			return f, candidate, nil
		}
		lastErr = err
	}
	if lastErr == nil {
		lastErr = os.ErrNotExist
	}
	return nil, "", lastErr
}

func buildTelegramLocalFileCandidates(filePath string) []string {
	trimmed := strings.TrimSpace(filePath)
	if trimmed == "" {
		return nil
	}

	if filepath.IsAbs(trimmed) {
		return []string{trimmed}
	}

	relativePath, err := sanitizeTelegramRelativePath(trimmed)
	if err != nil {
		return nil
	}
	return []string{filepath.Join(telegramBotAPILocalDataDir, relativePath)}
}

func sanitizeTelegramRelativePath(path string) (string, error) {
	normalized := strings.TrimSpace(path)
	if normalized == "" {
		return "", errors.New("empty path")
	}
	normalized = strings.ReplaceAll(normalized, "\\", "/")
	for strings.HasPrefix(normalized, "/") {
		normalized = strings.TrimPrefix(normalized, "/")
	}
	if normalized == "" {
		return "", errors.New("empty path")
	}

	cleaned := filepath.Clean(normalized)
	if cleaned == "." || cleaned == "" {
		return "", errors.New("invalid path")
	}
	if cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) {
		return "", errors.New("invalid path")
	}
	return cleaned, nil
}
