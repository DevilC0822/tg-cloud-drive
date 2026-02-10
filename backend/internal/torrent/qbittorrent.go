package torrent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type QBittorrentClient struct {
	baseURL  string
	username string
	password string
	http     *http.Client
}

type QBittorrentTorrentInfo struct {
	Hash        string  `json:"hash"`
	Name        string  `json:"name"`
	SavePath    string  `json:"save_path"`
	ContentPath string  `json:"content_path"`
	State       string  `json:"state"`
	Progress    float64 `json:"progress"`
	TotalSize   int64   `json:"total_size"`
	Completed   int64   `json:"completed"`
	AmountLeft  int64   `json:"amount_left"`
}

type QBittorrentTorrentFile struct {
	Index    int     `json:"index"`
	Name     string  `json:"name"`
	Size     int64   `json:"size"`
	Progress float64 `json:"progress"`
	Priority int     `json:"priority"`
}

func NewQBittorrentClient(baseURL string, username string, password string, timeout time.Duration) (*QBittorrentClient, error) {
	trimmedBaseURL := strings.TrimSpace(strings.TrimRight(baseURL, "/"))
	if trimmedBaseURL == "" {
		return nil, errors.New("qBittorrent base url 不能为空")
	}
	if timeout <= 0 {
		timeout = 20 * time.Second
	}
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, err
	}
	return &QBittorrentClient{
		baseURL:  trimmedBaseURL,
		username: strings.TrimSpace(username),
		password: strings.TrimSpace(password),
		http: &http.Client{
			Timeout: timeout,
			Jar:     jar,
		},
	}, nil
}

func (c *QBittorrentClient) Authenticate(ctx context.Context) error {
	form := url.Values{}
	form.Set("username", c.username)
	form.Set("password", c.password)
	resp, err := c.doRequest(
		ctx,
		http.MethodPost,
		"/api/v2/auth/login",
		strings.NewReader(form.Encode()),
		map[string]string{"Content-Type": "application/x-www-form-urlencoded"},
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("qBittorrent 登录失败: http %d", resp.StatusCode)
	}

	// 不同版本返回体不稳定，优先以 SID Cookie 判断认证成功。
	for _, cookie := range resp.Cookies() {
		if strings.EqualFold(strings.TrimSpace(cookie.Name), "SID") && strings.TrimSpace(cookie.Value) != "" {
			return nil
		}
	}

	bodyText := strings.ToLower(strings.TrimSpace(string(body)))
	if strings.Contains(bodyText, "ok") {
		return nil
	}
	if strings.Contains(bodyText, "fails") || strings.Contains(bodyText, "forbidden") {
		return errors.New("qBittorrent 登录失败: 账号或密码不匹配（请检查 TORRENT_QBT_USERNAME/TORRENT_QBT_PASSWORD 或 qBittorrent 已持久化密码）")
	}
	return fmt.Errorf("qBittorrent 登录失败: 返回内容异常（%s）", shortenForLog(strings.TrimSpace(string(body)), 160))
}

func (c *QBittorrentClient) SetPrivateProfile(ctx context.Context) error {
	payload := map[string]any{
		"dht": false,
		"pex": false,
		"lsd": false,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	form := url.Values{}
	form.Set("json", string(raw))
	resp, err := c.doRequest(
		ctx,
		http.MethodPost,
		"/api/v2/app/setPreferences",
		strings.NewReader(form.Encode()),
		map[string]string{"Content-Type": "application/x-www-form-urlencoded"},
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("设置 qBittorrent 偏好失败: http %d", resp.StatusCode)
	}
	return nil
}

func (c *QBittorrentClient) AddTorrentFile(
	ctx context.Context,
	torrentFileName string,
	torrentData []byte,
	savePath string,
) error {
	if len(torrentData) == 0 {
		return errors.New("torrent 文件内容为空")
	}
	if strings.TrimSpace(savePath) == "" {
		return errors.New("savePath 不能为空")
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	filePart, err := writer.CreateFormFile("torrents", torrentFileName)
	if err != nil {
		return err
	}
	if _, err := filePart.Write(torrentData); err != nil {
		return err
	}
	if err := writer.WriteField("savepath", savePath); err != nil {
		return err
	}
	if err := writer.WriteField("skip_checking", "false"); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	resp, err := c.doRequest(
		ctx,
		http.MethodPost,
		"/api/v2/torrents/add",
		&body,
		map[string]string{"Content-Type": writer.FormDataContentType()},
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		return fmt.Errorf("添加 torrent 失败: http %d (%s)", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	return nil
}

func (c *QBittorrentClient) GetTorrentInfo(ctx context.Context, hash string) (*QBittorrentTorrentInfo, error) {
	hash = strings.TrimSpace(strings.ToLower(hash))
	if hash == "" {
		return nil, errors.New("torrent hash 不能为空")
	}
	query := url.Values{}
	query.Set("hashes", hash)
	endpoint := "/api/v2/torrents/info?" + query.Encode()

	resp, err := c.doRequest(ctx, http.MethodGet, endpoint, nil, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("查询 torrent 信息失败: http %d", resp.StatusCode)
	}
	var infos []QBittorrentTorrentInfo
	if err := json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(&infos); err != nil {
		return nil, err
	}
	for _, info := range infos {
		if strings.EqualFold(strings.TrimSpace(info.Hash), hash) {
			out := info
			return &out, nil
		}
	}
	return nil, nil
}

func (c *QBittorrentClient) ListTorrentInfos(ctx context.Context) ([]QBittorrentTorrentInfo, error) {
	query := url.Values{}
	query.Set("filter", "all")
	query.Set("sort", "added_on")
	query.Set("reverse", "true")
	endpoint := "/api/v2/torrents/info?" + query.Encode()

	resp, err := c.doRequest(ctx, http.MethodGet, endpoint, nil, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("查询 torrent 列表失败: http %d", resp.StatusCode)
	}

	var infos []QBittorrentTorrentInfo
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&infos); err != nil {
		return nil, err
	}
	return infos, nil
}

func (c *QBittorrentClient) GetTorrentFiles(ctx context.Context, hash string) ([]QBittorrentTorrentFile, error) {
	hash = strings.TrimSpace(strings.ToLower(hash))
	if hash == "" {
		return nil, errors.New("torrent hash 不能为空")
	}
	query := url.Values{}
	query.Set("hash", hash)
	endpoint := "/api/v2/torrents/files?" + query.Encode()

	resp, err := c.doRequest(ctx, http.MethodGet, endpoint, nil, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("查询 torrent 文件列表失败: http %d", resp.StatusCode)
	}

	var files []QBittorrentTorrentFile
	if err := json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(&files); err != nil {
		return nil, err
	}
	return files, nil
}

func (c *QBittorrentClient) DeleteTorrent(ctx context.Context, hash string, deleteFiles bool) error {
	hash = strings.TrimSpace(strings.ToLower(hash))
	if hash == "" {
		return errors.New("torrent hash 不能为空")
	}
	form := url.Values{}
	form.Set("hashes", hash)
	form.Set("deleteFiles", strconv.FormatBool(deleteFiles))

	resp, err := c.doRequest(
		ctx,
		http.MethodPost,
		"/api/v2/torrents/delete",
		strings.NewReader(form.Encode()),
		map[string]string{"Content-Type": "application/x-www-form-urlencoded"},
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("删除 torrent 失败: http %d", resp.StatusCode)
	}
	return nil
}

func (c *QBittorrentClient) doRequest(
	ctx context.Context,
	method string,
	endpoint string,
	body io.Reader,
	headers map[string]string,
) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.joinURL(endpoint), body)
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		if strings.TrimSpace(k) == "" || strings.TrimSpace(v) == "" {
			continue
		}
		req.Header.Set(k, v)
	}
	return c.http.Do(req)
}

func (c *QBittorrentClient) joinURL(endpoint string) string {
	base, err := url.Parse(c.baseURL)
	if err != nil {
		return strings.TrimRight(c.baseURL, "/") + "/" + strings.TrimLeft(endpoint, "/")
	}
	rel, err := url.Parse(strings.TrimSpace(endpoint))
	if err != nil {
		return strings.TrimRight(c.baseURL, "/") + "/" + strings.TrimLeft(endpoint, "/")
	}
	return base.ResolveReference(rel).String()
}

func shortenForLog(raw string, limit int) string {
	if limit <= 0 {
		limit = 80
	}
	text := strings.TrimSpace(raw)
	if len(text) <= limit {
		if text == "" {
			return "<empty>"
		}
		return text
	}
	return strings.TrimSpace(text[:limit]) + "..."
}
