package api

const maxIntValueAsInt64 = int64(^uint(0) >> 1)

func resolveStoredSizeByTelegramSize(telegramSize int64, fallback int64) int64 {
	if telegramSize > 0 && telegramSize <= maxIntValueAsInt64 {
		return telegramSize
	}
	if fallback < 0 {
		return 0
	}
	return fallback
}

func resolveStoredChunkSize(telegramSize int64, fallback int64) int {
	return int(resolveStoredSizeByTelegramSize(telegramSize, fallback))
}
