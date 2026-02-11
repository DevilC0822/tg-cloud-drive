package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/const/tg-cloud-drive/backend/internal/telegram"
)

type preparedVideoUpload struct {
	filePath string
	fileName string
	options  *telegram.SendVideoOptions
	process  videoUploadProcessMeta
	cleanup  func()
}

type videoSendMeta struct {
	DurationSeconds int
	Width           int
	Height          int
}

func (s *Server) prepareVideoUploadAssets(ctx context.Context, fileName string, filePath string) preparedVideoUpload {
	result := preparedVideoUpload{
		filePath: filePath,
		fileName: fileName,
		options: &telegram.SendVideoOptions{
			SupportsStreaming: true,
		},
		process: videoUploadProcessMeta{},
		cleanup: func() {},
	}
	if strings.TrimSpace(filePath) == "" {
		return result
	}

	cleanupPaths := make([]string, 0, 2)

	faststartPath, faststartName, faststartErr := s.remuxVideoWithFaststart(ctx, fileName, filePath)
	if faststartErr != nil {
		result.process.FaststartFallback = true
		s.logger.Warn(
			"video faststart preprocess failed, fallback original",
			"error", faststartErr.Error(),
			"file_name", fileName,
		)
	} else {
		result.process.FaststartApplied = true
		result.filePath = faststartPath
		result.fileName = faststartName
		cleanupPaths = append(cleanupPaths, faststartPath)
	}

	previewPath, previewErr := s.generateVideoPreviewAsset(ctx, result.filePath)
	if previewErr != nil {
		s.logger.Warn(
			"generate video thumbnail/cover failed, continue without preview",
			"error", previewErr.Error(),
			"file_name", result.fileName,
		)
	} else {
		result.process.PreviewAttached = true
		result.options.ThumbnailPath = previewPath
		result.options.CoverPath = previewPath
		cleanupPaths = append(cleanupPaths, previewPath)
	}

	meta, metaErr := s.probeVideoSendMeta(ctx, result.filePath)
	if metaErr != nil {
		s.logger.Warn(
			"probe video metadata failed, continue with default sendVideo options",
			"error", metaErr.Error(),
			"file_name", result.fileName,
		)
	} else {
		result.options.DurationSeconds = meta.DurationSeconds
		result.options.Width = meta.Width
		result.options.Height = meta.Height
	}

	result.cleanup = func() {
		for _, p := range cleanupPaths {
			if strings.TrimSpace(p) == "" {
				continue
			}
			_ = os.Remove(p)
		}
	}

	return result
}

func (s *Server) probeVideoSendMeta(ctx context.Context, inputPath string) (videoSendMeta, error) {
	trimmedPath := strings.TrimSpace(inputPath)
	if trimmedPath == "" {
		return videoSendMeta{}, errors.New("视频文件路径为空")
	}
	ffprobeBinary, err := s.resolveFFprobeBinary()
	if err != nil {
		return videoSendMeta{}, err
	}

	type ffprobeOutput struct {
		Streams []struct {
			Width        int               `json:"width"`
			Height       int               `json:"height"`
			Tags         map[string]string `json:"tags"`
			SideDataList []map[string]any  `json:"side_data_list"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}

	probeCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	cmd := exec.CommandContext(
		probeCtx,
		ffprobeBinary,
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=width,height,tags,side_data_list:format=duration",
		"-of", "json",
		trimmedPath,
	)
	raw, runErr := cmd.CombinedOutput()
	if runErr != nil {
		msg := strings.TrimSpace(string(raw))
		if msg == "" {
			return videoSendMeta{}, runErr
		}
		return videoSendMeta{}, fmt.Errorf("ffprobe 失败: %w: %s", runErr, msg)
	}

	var out ffprobeOutput
	if err := json.Unmarshal(raw, &out); err != nil {
		return videoSendMeta{}, fmt.Errorf("解析 ffprobe 输出失败: %w", err)
	}

	meta := videoSendMeta{}
	if len(out.Streams) > 0 {
		stream := out.Streams[0]
		width := stream.Width
		height := stream.Height
		if width > 0 && height > 0 {
			if shouldSwapVideoDimensionsByRotation(parseVideoRotation(stream.Tags, stream.SideDataList)) {
				width, height = height, width
			}
			meta.Width = width
			meta.Height = height
		}
	}

	if trimmedDuration := strings.TrimSpace(out.Format.Duration); trimmedDuration != "" {
		if seconds, parseErr := strconv.ParseFloat(trimmedDuration, 64); parseErr == nil && seconds > 0 {
			meta.DurationSeconds = int(math.Round(seconds))
			if meta.DurationSeconds <= 0 {
				meta.DurationSeconds = 1
			}
		}
	}

	if meta.DurationSeconds <= 0 && (meta.Width <= 0 || meta.Height <= 0) {
		return videoSendMeta{}, errors.New("ffprobe 未返回有效的视频发送元数据")
	}
	return meta, nil
}

func parseVideoRotation(tags map[string]string, sideDataList []map[string]any) float64 {
	for _, item := range sideDataList {
		if item == nil {
			continue
		}
		raw, ok := item["rotation"]
		if !ok {
			continue
		}
		switch v := raw.(type) {
		case float64:
			return v
		case float32:
			return float64(v)
		case int:
			return float64(v)
		case int64:
			return float64(v)
		case json.Number:
			if parsed, err := v.Float64(); err == nil {
				return parsed
			}
		case string:
			if parsed, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil {
				return parsed
			}
		}
	}
	if tags != nil {
		if raw, ok := tags["rotate"]; ok {
			if parsed, err := strconv.ParseFloat(strings.TrimSpace(raw), 64); err == nil {
				return parsed
			}
		}
	}
	return 0
}

func shouldSwapVideoDimensionsByRotation(rotation float64) bool {
	normalized := math.Mod(math.Abs(rotation), 360)
	return math.Abs(normalized-90) < 1 || math.Abs(normalized-270) < 1
}

func (s *Server) resolveFFprobeBinary() (string, error) {
	candidates := make([]string, 0, 4)
	ffmpegBinary := strings.TrimSpace(s.cfg.FFmpegBinary)
	if ffmpegBinary != "" {
		ffmpegBase := filepath.Base(ffmpegBinary)
		ffmpegDir := filepath.Dir(ffmpegBinary)
		if strings.EqualFold(ffmpegBase, "ffmpeg") && ffmpegDir != "" && ffmpegDir != "." {
			candidates = append(candidates, filepath.Join(ffmpegDir, "ffprobe"))
		} else if ffmpegDir != "" && ffmpegDir != "." {
			candidates = append(candidates, filepath.Join(ffmpegDir, "ffprobe"))
		}
	}
	candidates = append(candidates, "ffprobe")

	seen := map[string]struct{}{}
	for _, candidate := range candidates {
		trimmed := strings.TrimSpace(candidate)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		if resolved, err := exec.LookPath(trimmed); err == nil {
			return resolved, nil
		}
	}
	return "", errors.New("未找到 ffprobe，可安装 ffmpeg 套件后重试")
}

func (s *Server) remuxVideoWithFaststart(ctx context.Context, fileName string, inputPath string) (string, string, error) {
	tmp, err := createPreprocessTempFile(inputPath, "tgcd-faststart-*.mp4")
	if err != nil {
		return "", "", err
	}
	outputPath := tmp.Name()
	_ = tmp.Close()
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.Remove(outputPath)
		}
	}()

	cmd := exec.CommandContext(
		ctx,
		s.cfg.FFmpegBinary,
		"-hide_banner",
		"-loglevel", "error",
		"-y",
		"-i", inputPath,
		"-c", "copy",
		"-movflags", "+faststart",
		outputPath,
	)
	if out, runErr := cmd.CombinedOutput(); runErr != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			return "", "", runErr
		}
		return "", "", fmt.Errorf("ffmpeg faststart 失败: %w: %s", runErr, msg)
	}

	info, err := os.Stat(outputPath)
	if err != nil {
		return "", "", err
	}
	if info.Size() <= 0 {
		return "", "", errors.New("faststart 输出文件为空")
	}
	if err := os.Chmod(outputPath, 0o644); err != nil {
		return "", "", fmt.Errorf("设置 faststart 输出文件权限失败: %w", err)
	}

	cleanup = false
	return outputPath, buildFaststartOutputName(fileName), nil
}

func (s *Server) generateVideoPreviewAsset(ctx context.Context, inputPath string) (string, error) {
	tmp, err := createPreprocessTempFile(inputPath, "tgcd-video-preview-*.jpg")
	if err != nil {
		return "", err
	}
	outputPath := tmp.Name()
	_ = tmp.Close()
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.Remove(outputPath)
		}
	}()

	filter := fmt.Sprintf("scale=min(%d\\,iw):-2", thumbnailWidthPx)
	cmd := exec.CommandContext(
		ctx,
		s.cfg.FFmpegBinary,
		"-hide_banner",
		"-loglevel", "error",
		"-y",
		"-ss", thumbnailCaptureAtSec,
		"-i", inputPath,
		"-frames:v", "1",
		"-vf", filter,
		"-q:v", "4",
		outputPath,
	)
	if out, runErr := cmd.CombinedOutput(); runErr != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			return "", runErr
		}
		return "", fmt.Errorf("ffmpeg 生成视频预览图失败: %w: %s", runErr, msg)
	}

	info, err := os.Stat(outputPath)
	if err != nil {
		return "", err
	}
	if info.Size() <= 0 {
		return "", errors.New("视频预览图为空")
	}
	if err := os.Chmod(outputPath, 0o644); err != nil {
		return "", fmt.Errorf("设置视频预览图文件权限失败: %w", err)
	}

	cleanup = false
	return outputPath, nil
}

func createPreprocessTempFile(inputPath string, pattern string) (*os.File, error) {
	trimmedPath := strings.TrimSpace(inputPath)
	if trimmedPath == "" {
		return os.CreateTemp("", pattern)
	}
	dir := filepath.Dir(trimmedPath)
	if strings.TrimSpace(dir) == "" || dir == "." {
		return os.CreateTemp("", pattern)
	}
	return os.CreateTemp(dir, pattern)
}

func buildFaststartOutputName(fileName string) string {
	trimmed := strings.TrimSpace(fileName)
	if trimmed == "" {
		return "video.mp4"
	}
	base := filepath.Base(trimmed)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	if strings.TrimSpace(name) == "" {
		name = "video"
	}
	return name + ".mp4"
}
