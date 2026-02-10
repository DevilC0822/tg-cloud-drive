package api

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/const/tg-cloud-drive/backend/internal/telegram"
)

type preparedVideoUpload struct {
	filePath string
	fileName string
	options  *telegram.SendVideoOptions
	process  videoUploadProcessMeta
	cleanup  func()
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
