package api

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/store"
)

const (
	torrentSourceDeleteModeImmediate = "immediate"
	torrentSourceDeleteModeFixed     = "fixed"
	torrentSourceDeleteModeRandom    = "random"

	torrentSourceDeleteMinMinutes = 1
	torrentSourceDeleteMaxMinutes = 7 * 24 * 60
)

func normalizeTorrentSourceDeleteMode(raw string) (string, error) {
	mode := strings.ToLower(strings.TrimSpace(raw))
	switch mode {
	case "", torrentSourceDeleteModeImmediate:
		return torrentSourceDeleteModeImmediate, nil
	case torrentSourceDeleteModeFixed:
		return torrentSourceDeleteModeFixed, nil
	case torrentSourceDeleteModeRandom:
		return torrentSourceDeleteModeRandom, nil
	default:
		return "", fmt.Errorf("源文件清理模式非法，仅支持 immediate/fixed/random")
	}
}

func validateTorrentSourceDeletePolicy(mode string, fixedMin int, randomMin int, randomMax int) error {
	if mode != torrentSourceDeleteModeImmediate &&
		mode != torrentSourceDeleteModeFixed &&
		mode != torrentSourceDeleteModeRandom {
		return fmt.Errorf("源文件清理模式非法，仅支持 immediate/fixed/random")
	}
	if fixedMin < torrentSourceDeleteMinMinutes || fixedMin > torrentSourceDeleteMaxMinutes {
		return fmt.Errorf("固定清理延迟范围应为 %d~%d 分钟", torrentSourceDeleteMinMinutes, torrentSourceDeleteMaxMinutes)
	}
	if randomMin < torrentSourceDeleteMinMinutes || randomMin > torrentSourceDeleteMaxMinutes {
		return fmt.Errorf("随机清理最小延迟范围应为 %d~%d 分钟", torrentSourceDeleteMinMinutes, torrentSourceDeleteMaxMinutes)
	}
	if randomMax < torrentSourceDeleteMinMinutes || randomMax > torrentSourceDeleteMaxMinutes {
		return fmt.Errorf("随机清理最大延迟范围应为 %d~%d 分钟", torrentSourceDeleteMinMinutes, torrentSourceDeleteMaxMinutes)
	}
	if randomMin > randomMax {
		return fmt.Errorf("随机清理最小延迟不能大于最大延迟")
	}
	return nil
}

func resolveTorrentSourceCleanupDueAt(settings store.RuntimeSettings, now time.Time) time.Time {
	mode, err := normalizeTorrentSourceDeleteMode(settings.TorrentSourceDeleteMode)
	if err != nil {
		mode = torrentSourceDeleteModeImmediate
	}

	switch mode {
	case torrentSourceDeleteModeFixed:
		return now.Add(time.Duration(settings.TorrentSourceDeleteFixedMinutes) * time.Minute)
	case torrentSourceDeleteModeRandom:
		minMinutes := settings.TorrentSourceDeleteRandomMinMins
		maxMinutes := settings.TorrentSourceDeleteRandomMaxMins
		if minMinutes > maxMinutes {
			minMinutes = maxMinutes
		}
		if minMinutes < torrentSourceDeleteMinMinutes {
			minMinutes = torrentSourceDeleteMinMinutes
		}
		if maxMinutes < minMinutes {
			maxMinutes = minMinutes
		}
		window := maxMinutes - minMinutes + 1
		delay := minMinutes
		if window > 1 {
			delay += rand.New(rand.NewSource(time.Now().UnixNano())).Intn(window)
		}
		return now.Add(time.Duration(delay) * time.Minute)
	default:
		return now
	}
}
