package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Client struct {
	token   string
	http    *http.Client
	baseURL string
}

type ClientOption func(*Client)

const defaultBotAPIBaseURL = "https://api.telegram.org"

func NewClient(token string, httpClient *http.Client, options ...ClientOption) *Client {
	c := &Client{token: token, http: httpClient, baseURL: defaultBotAPIBaseURL}
	for _, apply := range options {
		if apply != nil {
			apply(c)
		}
	}
	if c.http == nil {
		c.http = &http.Client{Timeout: 30 * time.Second}
	}
	return c
}

func WithBaseURL(raw string) ClientOption {
	return func(c *Client) {
		normalized := strings.TrimSpace(raw)
		if normalized == "" {
			return
		}
		c.baseURL = strings.TrimRight(normalized, "/")
	}
}

func (c *Client) apiURL(method string) string {
	return SafeJoinURL(c.baseURL, path.Join("bot"+c.token, method))
}

func (c *Client) fileURL(filePath string) string {
	filePath = strings.TrimPrefix(filePath, "/")
	return SafeJoinURL(c.baseURL, path.Join("file", "bot"+c.token, filePath))
}

type apiResponse[T any] struct {
	OK          bool   `json:"ok"`
	Result      T      `json:"result"`
	Description string `json:"description"`
	ErrorCode   int    `json:"error_code"`
	Parameters  struct {
		RetryAfter int `json:"retry_after"`
	} `json:"parameters"`
}

type Me struct {
	ID       int64  `json:"id"`
	IsBot    bool   `json:"is_bot"`
	Username string `json:"username"`
}

func (c *Client) GetMe(ctx context.Context) (Me, error) {
	var out apiResponse[Me]
	if err := c.doJSON(ctx, http.MethodGet, c.apiURL("getMe"), nil, &out); err != nil {
		return Me{}, err
	}
	if !out.OK {
		return Me{}, fmt.Errorf("getMe 失败: %s", out.Description)
	}
	return out.Result, nil
}

type Chat struct {
	ID       int64  `json:"id"`
	Type     string `json:"type"`
	Title    string `json:"title"`
	Username string `json:"username"`
}

func (c *Client) GetChat(ctx context.Context, chatID string) (Chat, error) {
	values := url.Values{}
	values.Set("chat_id", chatID)
	endpoint := c.apiURL("getChat") + "?" + values.Encode()

	var out apiResponse[Chat]
	if err := c.doJSON(ctx, http.MethodGet, endpoint, nil, &out); err != nil {
		return Chat{}, err
	}
	if !out.OK {
		return Chat{}, fmt.Errorf("getChat 失败: %s", out.Description)
	}
	return out.Result, nil
}

type ChatMember struct {
	User struct {
		ID int64 `json:"id"`
	} `json:"user"`
	Status string `json:"status"`
}

func (c *Client) GetChatAdministrators(ctx context.Context, chatID string) ([]ChatMember, error) {
	values := url.Values{}
	values.Set("chat_id", chatID)
	endpoint := c.apiURL("getChatAdministrators") + "?" + values.Encode()

	var out apiResponse[[]ChatMember]
	if err := c.doJSON(ctx, http.MethodGet, endpoint, nil, &out); err != nil {
		return nil, err
	}
	if !out.OK {
		return nil, fmt.Errorf("getChatAdministrators 失败: %s", out.Description)
	}
	return out.Result, nil
}

type Document struct {
	FileID       string `json:"file_id"`
	FileUniqueID string `json:"file_unique_id"`
	FileName     string `json:"file_name"`
	MimeType     string `json:"mime_type"`
	FileSize     int64  `json:"file_size"`
}

type MediaFile struct {
	FileID       string `json:"file_id"`
	FileUniqueID string `json:"file_unique_id"`
	FileName     string `json:"file_name"`
	MimeType     string `json:"mime_type"`
	FileSize     int64  `json:"file_size"`
}

type PhotoSize struct {
	FileID       string `json:"file_id"`
	FileUniqueID string `json:"file_unique_id"`
	FileSize     int64  `json:"file_size"`
	Width        int    `json:"width"`
	Height       int    `json:"height"`
}

type Message struct {
	MessageID int64       `json:"message_id"`
	Document  Document    `json:"document"`
	Video     MediaFile   `json:"video"`
	Audio     MediaFile   `json:"audio"`
	Animation MediaFile   `json:"animation"`
	Voice     MediaFile   `json:"voice"`
	VideoNote MediaFile   `json:"video_note"`
	Sticker   MediaFile   `json:"sticker"`
	Photo     []PhotoSize `json:"photo"`
}

func (m Message) PrimaryFile() (Document, bool) {
	if strings.TrimSpace(m.Document.FileID) != "" {
		return m.Document, true
	}

	candidates := []MediaFile{
		m.Video,
		m.Audio,
		m.Animation,
		m.Voice,
		m.VideoNote,
		m.Sticker,
	}
	for _, c := range candidates {
		if strings.TrimSpace(c.FileID) == "" {
			continue
		}
		return Document{
			FileID:       c.FileID,
			FileUniqueID: c.FileUniqueID,
			FileName:     c.FileName,
			MimeType:     c.MimeType,
			FileSize:     c.FileSize,
		}, true
	}

	var best PhotoSize
	for _, p := range m.Photo {
		if strings.TrimSpace(p.FileID) == "" {
			continue
		}
		if p.FileSize >= best.FileSize {
			best = p
		}
	}
	if strings.TrimSpace(best.FileID) != "" {
		return Document{
			FileID:       best.FileID,
			FileUniqueID: best.FileUniqueID,
			MimeType:     "image/jpeg",
			FileSize:     best.FileSize,
		}, true
	}

	return Document{}, false
}

func normalizeMessageDocument(msg *Message) {
	if msg == nil {
		return
	}
	if strings.TrimSpace(msg.Document.FileID) != "" {
		return
	}
	if d, ok := msg.PrimaryFile(); ok {
		msg.Document = d
	}
}

type SendVideoOptions struct {
	SupportsStreaming bool
	ThumbnailPath     string
	CoverPath         string
}

func normalizeSendVideoOptions(options *SendVideoOptions) SendVideoOptions {
	out := SendVideoOptions{
		SupportsStreaming: true,
	}
	if options == nil {
		return out
	}
	out.SupportsStreaming = options.SupportsStreaming
	if !out.SupportsStreaming {
		out.SupportsStreaming = true
	}
	out.ThumbnailPath = strings.TrimSpace(options.ThumbnailPath)
	out.CoverPath = strings.TrimSpace(options.CoverPath)
	return out
}

func (c *Client) SendDocumentFile(ctx context.Context, chatID string, fileName string, r io.Reader, caption string) (Message, error) {
	return c.sendMediaFile(ctx, "sendDocument", "document", chatID, fileName, r, caption, nil, nil)
}

func (c *Client) SendPhotoFile(ctx context.Context, chatID string, fileName string, r io.Reader, caption string) (Message, error) {
	return c.sendMediaFile(ctx, "sendPhoto", "photo", chatID, fileName, r, caption, nil, nil)
}

func (c *Client) SendVideoFile(ctx context.Context, chatID string, fileName string, r io.Reader, caption string) (Message, error) {
	return c.SendVideoFileWithOptions(ctx, chatID, fileName, r, caption, nil)
}

func (c *Client) SendVideoFileWithOptions(
	ctx context.Context,
	chatID string,
	fileName string,
	r io.Reader,
	caption string,
	options *SendVideoOptions,
) (Message, error) {
	normalized := normalizeSendVideoOptions(options)
	extra := map[string]string{
		"supports_streaming": strconv.FormatBool(normalized.SupportsStreaming),
	}
	extraFiles := map[string]string{}
	if normalized.ThumbnailPath != "" {
		extraFiles["thumbnail"] = normalized.ThumbnailPath
	}
	if normalized.CoverPath != "" {
		extraFiles["cover"] = normalized.CoverPath
	}
	return c.sendMediaFile(ctx, "sendVideo", "video", chatID, fileName, r, caption, extra, extraFiles)
}

func (c *Client) SendAudioFile(ctx context.Context, chatID string, fileName string, r io.Reader, caption string) (Message, error) {
	return c.sendMediaFile(ctx, "sendAudio", "audio", chatID, fileName, r, caption, nil, nil)
}

func (c *Client) SendAnimationFile(ctx context.Context, chatID string, fileName string, r io.Reader, caption string) (Message, error) {
	return c.sendMediaFile(ctx, "sendAnimation", "animation", chatID, fileName, r, caption, nil, nil)
}

func (c *Client) sendMediaFile(
	ctx context.Context,
	apiMethod string,
	mediaField string,
	chatID string,
	fileName string,
	r io.Reader,
	caption string,
	extra map[string]string,
	extraFiles map[string]string,
) (Message, error) {
	safeName := strings.TrimSpace(fileName)
	if safeName == "" {
		safeName = "file"
	}
	pr, pw := io.Pipe()
	writer := multipart.NewWriter(pw)

	go func() {
		defer pw.Close()
		defer writer.Close()

		_ = writer.WriteField("chat_id", chatID)
		if caption != "" {
			_ = writer.WriteField("caption", caption)
		}
		for k, v := range extra {
			if strings.TrimSpace(k) == "" || strings.TrimSpace(v) == "" {
				continue
			}
			_ = writer.WriteField(k, v)
		}

		part, err := writer.CreateFormFile(mediaField, safeName)
		if err != nil {
			_ = pw.CloseWithError(err)
			return
		}
		if _, err := io.Copy(part, r); err != nil {
			_ = pw.CloseWithError(err)
			return
		}

		for field, localPath := range extraFiles {
			trimmedField := strings.TrimSpace(field)
			trimmedPath := strings.TrimSpace(localPath)
			if trimmedField == "" || trimmedPath == "" {
				continue
			}
			f, err := os.Open(trimmedPath)
			if err != nil {
				_ = pw.CloseWithError(err)
				return
			}
			part, err := writer.CreateFormFile(trimmedField, filepath.Base(trimmedPath))
			if err != nil {
				_ = f.Close()
				_ = pw.CloseWithError(err)
				return
			}
			if _, err := io.Copy(part, f); err != nil {
				_ = f.Close()
				_ = pw.CloseWithError(err)
				return
			}
			_ = f.Close()
		}
	}()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL(apiMethod), pr)
	if err != nil {
		return Message{}, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	var out apiResponse[Message]
	if err := c.doHTTP(req, &out); err != nil {
		return Message{}, err
	}
	if !out.OK {
		if out.ErrorCode == 429 && out.Parameters.RetryAfter > 0 {
			return Message{}, RetryAfterError{After: time.Duration(out.Parameters.RetryAfter) * time.Second, Message: out.Description}
		}
		return Message{}, fmt.Errorf("%s 失败: %s", apiMethod, out.Description)
	}
	normalizeMessageDocument(&out.Result)
	return out.Result, nil
}

func (c *Client) SendDocumentByFileID(ctx context.Context, chatID string, fileID string, caption string) (Message, error) {
	values := url.Values{}
	values.Set("chat_id", chatID)
	values.Set("document", fileID)
	if caption != "" {
		values.Set("caption", caption)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL("sendDocument"), strings.NewReader(values.Encode()))
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
			return Message{}, RetryAfterError{After: time.Duration(out.Parameters.RetryAfter) * time.Second, Message: out.Description}
		}
		return Message{}, fmt.Errorf("sendDocument(file_id) 失败: %s", out.Description)
	}
	normalizeMessageDocument(&out.Result)
	return out.Result, nil
}

func (c *Client) SendDocumentByLocalPath(ctx context.Context, chatID string, localPath string, caption string) (Message, error) {
	return c.sendMediaByLocalPath(ctx, "sendDocument", "document", chatID, localPath, caption, nil, nil)
}

func (c *Client) SendPhotoByLocalPath(ctx context.Context, chatID string, localPath string, caption string) (Message, error) {
	return c.sendMediaByLocalPath(ctx, "sendPhoto", "photo", chatID, localPath, caption, nil, nil)
}

func (c *Client) SendVideoByLocalPath(ctx context.Context, chatID string, localPath string, caption string) (Message, error) {
	return c.SendVideoByLocalPathWithOptions(ctx, chatID, localPath, caption, nil)
}

func (c *Client) SendVideoByLocalPathWithOptions(
	ctx context.Context,
	chatID string,
	localPath string,
	caption string,
	options *SendVideoOptions,
) (Message, error) {
	normalized := normalizeSendVideoOptions(options)
	extra := map[string]string{
		"supports_streaming": strconv.FormatBool(normalized.SupportsStreaming),
	}
	extraLocalFiles := map[string]string{}
	if normalized.ThumbnailPath != "" {
		extraLocalFiles["thumbnail"] = normalized.ThumbnailPath
	}
	if normalized.CoverPath != "" {
		extraLocalFiles["cover"] = normalized.CoverPath
	}
	return c.sendMediaByLocalPath(ctx, "sendVideo", "video", chatID, localPath, caption, extra, extraLocalFiles)
}

func (c *Client) SendAudioByLocalPath(ctx context.Context, chatID string, localPath string, caption string) (Message, error) {
	return c.sendMediaByLocalPath(ctx, "sendAudio", "audio", chatID, localPath, caption, nil, nil)
}

func (c *Client) SendAnimationByLocalPath(ctx context.Context, chatID string, localPath string, caption string) (Message, error) {
	return c.sendMediaByLocalPath(ctx, "sendAnimation", "animation", chatID, localPath, caption, nil, nil)
}

func (c *Client) sendMediaByLocalPath(
	ctx context.Context,
	apiMethod string,
	mediaField string,
	chatID string,
	localPath string,
	caption string,
	extra map[string]string,
	extraLocalFiles map[string]string,
) (Message, error) {
	fileURI, err := localPathToFileURI(localPath)
	if err != nil {
		return Message{}, err
	}
	values := url.Values{}
	values.Set("chat_id", chatID)
	values.Set(mediaField, fileURI)
	if caption != "" {
		values.Set("caption", caption)
	}
	for k, v := range extra {
		if strings.TrimSpace(k) == "" || strings.TrimSpace(v) == "" {
			continue
		}
		values.Set(k, v)
	}
	for k, localFilePath := range extraLocalFiles {
		trimmedField := strings.TrimSpace(k)
		if trimmedField == "" {
			continue
		}
		fileURI, err := localPathToFileURI(localFilePath)
		if err != nil {
			return Message{}, err
		}
		values.Set(trimmedField, fileURI)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL(apiMethod), strings.NewReader(values.Encode()))
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
			return Message{}, RetryAfterError{After: time.Duration(out.Parameters.RetryAfter) * time.Second, Message: out.Description}
		}
		return Message{}, fmt.Errorf("%s(local_path) 失败: %s", apiMethod, out.Description)
	}
	normalizeMessageDocument(&out.Result)
	return out.Result, nil
}

func localPathToFileURI(localPath string) (string, error) {
	trimmed := strings.TrimSpace(localPath)
	if trimmed == "" {
		return "", errors.New("local path 不能为空")
	}
	return (&url.URL{Scheme: "file", Path: trimmed}).String(), nil
}

func (c *Client) SendPhotoByFileID(ctx context.Context, chatID string, fileID string, caption string, hasSpoiler bool) (Message, error) {
	values := url.Values{}
	values.Set("chat_id", chatID)
	values.Set("photo", fileID)
	if caption != "" {
		values.Set("caption", caption)
	}
	if hasSpoiler {
		values.Set("has_spoiler", "true")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL("sendPhoto"), strings.NewReader(values.Encode()))
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
			return Message{}, RetryAfterError{After: time.Duration(out.Parameters.RetryAfter) * time.Second, Message: out.Description}
		}
		return Message{}, fmt.Errorf("sendPhoto(file_id) 失败: %s", out.Description)
	}
	normalizeMessageDocument(&out.Result)
	return out.Result, nil
}

func (c *Client) SendVideoByFileID(ctx context.Context, chatID string, fileID string, caption string, hasSpoiler bool) (Message, error) {
	values := url.Values{}
	values.Set("chat_id", chatID)
	values.Set("video", fileID)
	values.Set("supports_streaming", "true")
	if caption != "" {
		values.Set("caption", caption)
	}
	if hasSpoiler {
		values.Set("has_spoiler", "true")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL("sendVideo"), strings.NewReader(values.Encode()))
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
			return Message{}, RetryAfterError{After: time.Duration(out.Parameters.RetryAfter) * time.Second, Message: out.Description}
		}
		return Message{}, fmt.Errorf("sendVideo(file_id) 失败: %s", out.Description)
	}
	normalizeMessageDocument(&out.Result)
	return out.Result, nil
}

func (c *Client) SendAnimationByFileID(ctx context.Context, chatID string, fileID string, caption string, hasSpoiler bool) (Message, error) {
	values := url.Values{}
	values.Set("chat_id", chatID)
	values.Set("animation", fileID)
	if caption != "" {
		values.Set("caption", caption)
	}
	if hasSpoiler {
		values.Set("has_spoiler", "true")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL("sendAnimation"), strings.NewReader(values.Encode()))
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
			return Message{}, RetryAfterError{After: time.Duration(out.Parameters.RetryAfter) * time.Second, Message: out.Description}
		}
		return Message{}, fmt.Errorf("sendAnimation(file_id) 失败: %s", out.Description)
	}
	normalizeMessageDocument(&out.Result)
	return out.Result, nil
}

func (c *Client) ForwardMessage(ctx context.Context, toChatID string, fromChatID string, messageID int64) (Message, error) {
	values := url.Values{}
	values.Set("chat_id", toChatID)
	values.Set("from_chat_id", fromChatID)
	values.Set("message_id", strconv.FormatInt(messageID, 10))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL("forwardMessage"), strings.NewReader(values.Encode()))
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
			return Message{}, RetryAfterError{After: time.Duration(out.Parameters.RetryAfter) * time.Second, Message: out.Description}
		}
		return Message{}, fmt.Errorf("forwardMessage 失败: %s", out.Description)
	}
	normalizeMessageDocument(&out.Result)
	return out.Result, nil
}

type File struct {
	FileID       string `json:"file_id"`
	FileUniqueID string `json:"file_unique_id"`
	FileSize     int64  `json:"file_size"`
	FilePath     string `json:"file_path"`
}

func (c *Client) GetFile(ctx context.Context, fileID string) (File, error) {
	values := url.Values{}
	values.Set("file_id", fileID)
	endpoint := c.apiURL("getFile") + "?" + values.Encode()

	var out apiResponse[File]
	if err := c.doJSON(ctx, http.MethodGet, endpoint, nil, &out); err != nil {
		return File{}, err
	}
	if !out.OK {
		return File{}, fmt.Errorf("getFile 失败: %s", out.Description)
	}
	return out.Result, nil
}

func (c *Client) DeleteMessage(ctx context.Context, chatID string, messageID int64) error {
	values := url.Values{}
	values.Set("chat_id", chatID)
	values.Set("message_id", strconv.FormatInt(messageID, 10))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.apiURL("deleteMessage"), strings.NewReader(values.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	var out apiResponse[bool]
	if err := c.doHTTP(req, &out); err != nil {
		return err
	}
	if !out.OK {
		// 仅放过“已不存在”类错误，避免把“无权限删除”等真实失败误判为成功。
		if out.ErrorCode == 400 && isIgnorableDeleteMessageError(out.Description) {
			return nil
		}
		return fmt.Errorf("deleteMessage 失败: %s", out.Description)
	}
	return nil
}

func isIgnorableDeleteMessageError(desc string) bool {
	desc = strings.ToLower(strings.TrimSpace(desc))
	if desc == "" {
		return false
	}
	return strings.Contains(desc, "message to delete not found") ||
		strings.Contains(desc, "message not found") ||
		strings.Contains(desc, "message_id_invalid")
}

func (c *Client) DownloadURLFromFilePath(filePath string) string {
	return c.fileURL(filePath)
}

type RetryAfterError struct {
	After   time.Duration
	Message string
}

func (e RetryAfterError) Error() string {
	return fmt.Sprintf("触发 Telegram 限流，请在 %s 后重试：%s", e.After, e.Message)
}

func (c *Client) SelfCheck(ctx context.Context, storageChatID string) error {
	me, err := c.GetMe(ctx)
	if err != nil {
		return err
	}
	if !me.IsBot {
		return errors.New("token 对应的账号不是 bot")
	}

	if _, err := c.GetChat(ctx, storageChatID); err != nil {
		return err
	}
	admins, err := c.GetChatAdministrators(ctx, storageChatID)
	if err != nil {
		return err
	}
	for _, m := range admins {
		if m.User.ID == me.ID {
			return nil
		}
	}
	return errors.New("bot 不是存储频道的管理员（请把 bot 加入频道并授予管理员权限）")
}

func (c *Client) doJSON(ctx context.Context, method string, endpoint string, body any, out any) error {
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, r)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.doHTTP(req, out)
}

func (c *Client) doHTTP(req *http.Request, out any) error {
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return err
	}
	if err := json.Unmarshal(b, out); err != nil {
		// 保留原始错误上下文，便于排障
		return fmt.Errorf("解析 Telegram 响应失败: %w", err)
	}
	return nil
}

func SafeJoinURL(base string, p string) string {
	u, err := url.Parse(base)
	if err != nil {
		return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(p, "/")
	}
	u.Path = path.Join(u.Path, p)
	return u.String()
}
