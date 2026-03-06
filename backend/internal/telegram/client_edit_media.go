package telegram

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	editMessageMediaPhotoType     = "photo"
	editMessageMediaVideoType     = "video"
	editMessageMediaAnimationType = "animation"
)

func (c *Client) EditPhotoMessageByFileID(
	ctx context.Context,
	chatID string,
	messageID int64,
	fileID string,
	caption string,
	hasSpoiler bool,
) (Message, error) {
	return c.editMessageMediaByFileID(ctx, chatID, messageID, editMessageMediaPhotoType, fileID, caption, hasSpoiler, nil)
}

func (c *Client) EditVideoMessageByFileID(
	ctx context.Context,
	chatID string,
	messageID int64,
	fileID string,
	caption string,
	hasSpoiler bool,
) (Message, error) {
	extra := map[string]any{
		"supports_streaming": true,
	}
	return c.editMessageMediaByFileID(ctx, chatID, messageID, editMessageMediaVideoType, fileID, caption, hasSpoiler, extra)
}

func (c *Client) EditAnimationMessageByFileID(
	ctx context.Context,
	chatID string,
	messageID int64,
	fileID string,
	caption string,
	hasSpoiler bool,
) (Message, error) {
	return c.editMessageMediaByFileID(ctx, chatID, messageID, editMessageMediaAnimationType, fileID, caption, hasSpoiler, nil)
}

func (c *Client) editMessageMediaByFileID(
	ctx context.Context,
	chatID string,
	messageID int64,
	mediaType string,
	fileID string,
	caption string,
	hasSpoiler bool,
	extra map[string]any,
) (Message, error) {
	media, err := marshalEditMessageMedia(mediaType, fileID, caption, hasSpoiler, extra)
	if err != nil {
		return Message{}, err
	}

	values := url.Values{}
	values.Set("chat_id", chatID)
	values.Set("message_id", strconv.FormatInt(messageID, 10))
	values.Set("media", media)

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.apiURL("editMessageMedia"),
		strings.NewReader(values.Encode()),
	)
	if err != nil {
		return Message{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	var out apiResponse[Message]
	if err := c.doHTTP(req, &out); err != nil {
		return Message{}, err
	}
	if !out.OK {
		if out.ErrorCode == 429 && out.Parameters.RetryAfter > 0 {
			return Message{}, RetryAfterError{
				After:   time.Duration(out.Parameters.RetryAfter) * time.Second,
				Message: out.Description,
			}
		}
		return Message{}, fmt.Errorf("editMessageMedia(file_id) 失败: %s", out.Description)
	}
	normalizeMessageDocument(&out.Result)
	return out.Result, nil
}

func marshalEditMessageMedia(
	mediaType string,
	fileID string,
	caption string,
	hasSpoiler bool,
	extra map[string]any,
) (string, error) {
	media := map[string]any{
		"type":  mediaType,
		"media": fileID,
	}
	if caption != "" {
		media["caption"] = caption
	}
	if hasSpoiler {
		media["has_spoiler"] = true
	}
	for key, value := range extra {
		if strings.TrimSpace(key) == "" {
			continue
		}
		media[key] = value
	}
	raw, err := json.Marshal(media)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}
