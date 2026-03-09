package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const deletedPlaceholderAttachField = "replacement"

func (c *Client) ReplaceMessageWithDeletedDocument(ctx context.Context, chatID string, messageID int64, caption string) error {
	reader := strings.NewReader(caption + "\n")
	return c.editMessageMediaWithUpload(ctx, chatID, messageID, "document", "deleted.txt", reader, caption)
}

func (c *Client) ReplaceMessageWithDeletedPhoto(ctx context.Context, chatID string, messageID int64, caption string) error {
	content, err := buildTransparentPlaceholderPNG()
	if err != nil {
		return err
	}
	return c.editMessageMediaWithUpload(
		ctx,
		chatID,
		messageID,
		"photo",
		"deleted.png",
		bytes.NewReader(content),
		caption,
	)
}

func buildTransparentPlaceholderPNG() ([]byte, error) {
	img := image.NewNRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.NRGBA{R: 0, G: 0, B: 0, A: 0})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (c *Client) editMessageMediaWithUpload(
	ctx context.Context,
	chatID string,
	messageID int64,
	mediaType string,
	fileName string,
	r io.Reader,
	caption string,
) error {
	media, err := marshalUploadedEditMessageMedia(mediaType, deletedPlaceholderAttachField, caption, nil)
	if err != nil {
		return err
	}
	req, err := c.newEditMessageMediaUploadRequest(ctx, chatID, messageID, media, fileName, r)
	if err != nil {
		return err
	}
	var out apiResponse[json.RawMessage]
	if err := c.doHTTP(req, &out); err != nil {
		return err
	}
	return resolveEditMessageMediaActionError(out, "editMessageMedia(upload)")
}

func marshalUploadedEditMessageMedia(
	mediaType string,
	attachField string,
	caption string,
	extra map[string]any,
) (string, error) {
	return marshalEditMessageMedia(mediaType, "attach://"+attachField, caption, false, extra)
}

func (c *Client) newEditMessageMediaUploadRequest(
	ctx context.Context,
	chatID string,
	messageID int64,
	media string,
	fileName string,
	r io.Reader,
) (*http.Request, error) {
	pr, pw := io.Pipe()
	writer := multipart.NewWriter(pw)

	go func() {
		defer pw.Close()
		defer writer.Close()

		_ = writer.WriteField("chat_id", chatID)
		_ = writer.WriteField("message_id", strconv.FormatInt(messageID, 10))
		_ = writer.WriteField("media", media)

		part, err := writer.CreateFormFile(deletedPlaceholderAttachField, safeMultipartFileName(fileName))
		if err != nil {
			_ = pw.CloseWithError(err)
			return
		}
		if _, err := io.Copy(part, r); err != nil {
			_ = pw.CloseWithError(err)
		}
	}()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL("editMessageMedia"), pr)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req, nil
}

func safeMultipartFileName(fileName string) string {
	trimmed := strings.TrimSpace(fileName)
	if trimmed == "" {
		return "file"
	}
	return trimmed
}

func resolveEditMessageMediaActionError(out apiResponse[json.RawMessage], action string) error {
	if out.OK {
		return nil
	}
	if out.ErrorCode == 429 && out.Parameters.RetryAfter > 0 {
		return RetryAfterError{After: time.Duration(out.Parameters.RetryAfter) * time.Second, Message: out.Description}
	}
	if isIgnorableMessageEditError(out.Description) {
		return nil
	}
	return fmt.Errorf("%s 失败: %s", action, out.Description)
}

func isIgnorableMessageEditError(desc string) bool {
	normalized := strings.ToLower(strings.TrimSpace(desc))
	if normalized == "" {
		return false
	}
	return strings.Contains(normalized, "message is not modified") ||
		strings.Contains(normalized, "message to edit not found") ||
		strings.Contains(normalized, "message not found") ||
		strings.Contains(normalized, "message_id_invalid")
}
