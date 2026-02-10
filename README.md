# TG Cloud Drive

基于 Telegram 频道的网盘系统。  
后端使用 Go + PostgreSQL 管理元数据，文件写入 Telegram（官方或自建 Bot
API），并由后端代理下载/预览，避免在浏览器暴露 Bot Token。

## 项目特性

- 完整文件管理：目录、重命名、移动、复制、收藏、回收站、分享
- 初始化向导：首次访问进入 `/setup`，完成 Telegram 与管理员配置
- 双接入模式：
  - `official_bot_api`（官方 Bot API）
  - `self_hosted_bot_api`（自建 Bot API）
- 已初始化实例支持在线切换接入模式（带校验与自动回滚）
- 上传支持断点续传（浏览器到后端固定走会话分片）
- 传输中心支持任务进度、历史记录、失败重试与高级筛选
- Torrent 任务链路：
  - 支持提交 `torrent URL` 或种子文件
  - 后端校验 bencode / infohash / private / announce 域名
  - 异步 worker 调用 qBittorrent 下载并可在多文件场景手动选择发送目标
- 视频增强链路：
  - 上传前做 faststart 预处理（失败自动回退原文件）
  - `sendVideo` 支持 `thumbnail` / `cover` 参数
  - 预处理命中/回退状态写入上传响应与传输历史
- 下载与预览支持 `HEAD` / 单段 `Range`

## 技术栈

- 后端：Go、Chi、pgx、PostgreSQL
- 前端：React、TypeScript、Vite、Tailwind、Jotai
- 运行：Docker Compose（postgres + backend + frontend + telegram-bot-api + qbittorrent）

## 目录结构

```text
.
├─ backend/
│  ├─ cmd/server/main.go                # 后端入口
│  ├─ internal/api/                     # HTTP API 与核心业务
│  ├─ internal/config/config.go         # 环境变量与默认值
│  ├─ internal/db/migrations/           # SQL 迁移
│  ├─ internal/store/                   # 数据访问层
│  └─ internal/torrent/                 # Torrent 解析与 qBittorrent 客户端
├─ frontend/
│  ├─ src/App.tsx                       # 初始化/鉴权/主页面路由控制
│  └─ src/components/                   # 页面与组件（setup/header/transfer 等）
├─ deploy/telegram-bot-api/
│  └─ runtime-entrypoint.sh             # 自建 Bot API 凭据热更新入口脚本
├─ deploy/nginx/
│  └─ setup_https.sh                    # Debian/Ubuntu 一键 Nginx+SSL
├─ docker-compose.yml
└─ .env.example
```

## 快速开始（Docker，推荐）

### 1) 前置准备

1. 创建 Telegram Bot（@BotFather）。
2. 准备一个频道或群作为存储容器，把 Bot 加为管理员。
3. 记下：
   - `Telegram Bot Token`
   - `存储 Chat ID`（例如 `-100xxxxxxxxxx` 或 `@channelusername`）
4. 若计划使用自建 Bot API，还需准备：
   - `API ID`
   - `API Hash`

### 2) 启动

```bash
cp ".env.example" ".env"   # 可选
docker compose up --build
```

访问地址：

- Web：`http://localhost:3000`
- 后端健康检查：`http://localhost:8080/healthz`

### 3) 首次初始化

首次访问会自动进入 `/setup`（由前端调用 `/api/setup/status` 决定）。

- 官方 Bot API：填写 `Bot Token` + `Chat ID` + 管理员密码
- 自建 Bot API：额外填写 `API ID` + `API Hash`
- `Bot API Base URL` 在自建模式下默认使用：
  - `http://telegram-bot-api:8081`

说明：

- 现在不需要在 `.env` 或 compose 里手工提供
  `TELEGRAM_API_ID`/`TELEGRAM_API_HASH`。
- `telegram-bot-api` 容器会等待后端写入凭据文件后再拉起服务进程。
- 自建 Bot API 的 `8081` 仅容器网络可访问（`expose`，未映射宿主机端口）。
- 默认同时启动 `qbittorrent`（仅容器内可访问），用于 Torrent 异步下载任务。

### 3.1) qBittorrent 说明

- 后端默认通过 `http://qbittorrent:8080` 调用 WebAPI。
- 默认账户由环境变量控制（`TORRENT_QBT_USERNAME` / `TORRENT_QBT_PASSWORD`）。
- compose 默认固定镜像 `qbittorrentofficial/qbittorrent-nox:4.5.5-1`，
  避免新版临时密码机制导致后端无法登录。
- compose 内已配置下载目录共享卷 `tgcd_torrent_data`，用于：
  - qBittorrent 下载落盘
  - 后端读取并发送到 Telegram
  - 自建 Bot API（local）通过 `file://` 直接读取

### 4) Linux 服务器一键 HTTPS（Debian/Ubuntu）

如果你在 Debian/Ubuntu 服务器部署，并且已把域名 `A/AAAA` 解析到服务器公网 IP，
可直接使用脚本自动完成 Nginx 反代与 Let's Encrypt 证书申请。

前置条件：

- 已执行 `docker compose up --build`，并可通过 `http://127.0.0.1:3000` 访问前端
- 服务器放通 `80/443` 端口（云防火墙 + 系统防火墙）
- 以 `root` 或 `sudo` 执行

使用步骤：

```bash
# 1) 查看参数说明
sudo bash ./deploy/nginx/setup_https.sh --help

# 2) 先做证书演练（推荐）
sudo bash ./deploy/nginx/setup_https.sh \
  --domain pan.example.com \
  --email ops@example.com \
  --dry-run

# 3) 申请正式证书并启用 HTTPS
sudo bash ./deploy/nginx/setup_https.sh \
  --domain pan.example.com \
  --email ops@example.com
```

可选参数：

- `--upstream 127.0.0.1:3000`（默认即此值）
- `--dry-run`（先走 Let's Encrypt 测试环境演练）
- `--skip-install`（已安装 nginx/certbot 时跳过 apt 安装）

执行完成后验证：

```bash
# 证书状态
sudo certbot certificates

# 续期定时任务
sudo systemctl list-timers | grep certbot
```

完成后即可通过 `https://你的域名` 访问，业务入口仍由 Docker 前端服务
`127.0.0.1:3000` 提供。

如需同时禁用后端的 `IP:PORT` 直接访问，可在 `.env` 中增加：

```bash
DISABLE_IP_PORT_ACCESS=true
```

然后重启后端容器使配置生效：

```bash
docker compose up -d --build backend
```

## 接入模式与切换机制

### 模式定义

- `official_bot_api`
  - 使用 Telegram 官方 Bot API（`https://api.telegram.org`）
- `self_hosted_bot_api`
  - 使用自建 Bot API（默认 `http://telegram-bot-api:8081`）
- `mtproto`
  - 当前禁用（请求会返回“暂未开放”）

### 已初始化后切换（Header「切换服务」）

前端通过 `PATCH /api/settings/access` 切换，支持以下逻辑：

1. 新目标配置组装（允许复用现有 `Bot Token/Chat ID`）。
2. 若切到自建模式，要求 `tgApiId` + `tgApiHash`，并写入凭据文件。
3. 先执行连接测试（Bot / Chat / 管理员三段校验）。
4. 校验通过后入库（`system_config`）。
5. 立即创建并替换内存中的 Telegram client，实时生效。
6. 若切换后 `SelfCheck` 失败，自动回滚旧配置与凭据。

结论：切换服务是即时生效，不需要重启后端进程。

## Torrent 下载任务（新增）

### 流程概览

1. Web 端在“上传文件”弹窗切换到 `Torrent 下载`：
   - 填写 `torrent URL` 或上传 `.torrent` 文件
   - 选择目标目录（发送完成后入库位置）
2. 后端创建异步任务并做元信息校验：
   - bencode 结构合法性
   - `infohash` / `total size` 解析
   - `private torrent` 检查（可配置强制）
   - `announce` 域名白名单（可配置）
3. 后台 worker 调用 qBittorrent WebAPI 异步下载（不阻塞 HTTP 请求）。
4. 下载完成后：
   - 单文件任务：自动进入发送流程
   - 多文件任务：在传输中心点击“选择文件”并提交
5. 后端将选中文件发送到 Telegram（复用现有媒体策略与视频增强链路）。
6. 每个发送文件都会写入 `transfer_history`，可在传输中心追踪结果。

### 任务状态

- `queued`：已入队
- `downloading`：qBittorrent 下载中
- `awaiting_selection`：多文件任务等待用户选择
- `uploading`：发送到 Telegram 中
- `completed`：任务完成
- `error`：任务失败

## 上传策略（当前实现）

### 浏览器 -> 后端

- 统一走上传会话分片接口（可续传）：
  - `POST /api/uploads`
  - `POST /api/uploads/{id}/chunks/{index}`
  - `POST /api/uploads/{id}/complete`

### 后端 -> Telegram（按接入模式分流）

#### 官方 Bot API

- 优先按“文件类型 + 大小阈值”决定是否单文件直传：
  - 图片（`sendPhoto`）：`<= 10MB`
  - 其他（`sendVideo`/`sendAnimation`/`sendAudio`/`sendDocument`）：
    `<= 50MB`
- 超过阈值：走原有分片文档模型（多消息分片）
- 若单文件尝试失败：自动回退到分片上传

#### 自建 Bot API（local）

- 浏览器分片落本地 staging，完成后合并文件
- 合并后使用 `file://` 本地路径调用 Telegram 接口上传（单消息）
- `TELEGRAM_LOCAL=1` 下支持更大单文件（当前按 2GB 场景使用）

### 媒体发送策略

- 视频类：`sendVideo`
- GIF：`sendAnimation`
- 图片：`sendPhoto`
- 音频：`sendAudio`
- 其他：`sendDocument`

### 视频预处理链路

- 触发条件：视频类型文件
- 执行内容：
  - faststart remux（无重编码优先，失败自动回退原文件）
  - 生成预览图并传给 `thumbnail` / `cover`（失败自动去掉预览重试）
  - `supports_streaming=true`
- 结果回传字段（上传响应 + 传输历史）：
  - `videoFaststartApplied`
  - `videoFaststartFallback`
  - `videoPreviewAttached`
  - `videoPreviewFallback`

## 下载、分享与缩略图

- 登录态下载/预览：`GET|HEAD /api/items/{id}/content`
- 公开分享下载：`GET|HEAD /d/{shareCode}`
- `Range`：仅支持单段 Range
- 分享限制：
  - 回收站文件不可分享下载
  - 密码箱文件不可分享下载
  - 文件夹不支持分享下载
- 视频缩略图接口：`GET /api/items/{id}/thumbnail`
  - 后端按需生成并缓存（`ffmpeg`）
  - 受缓存大小、TTL、生成并发控制

## 环境变量（后端）

### 最小必需

- Docker Compose 默认可直接跑，不强制手填环境变量
- `DATABASE_URL` 未配置时默认值：
  - `postgres://tgcd:tgcd@postgres:5432/tgcd?sslmode=disable`

### 常用可选

- `COOKIE_SECRET_B64`
  - 不配置则每次启动随机生成，重启后登录态失效
- `FRONTEND_ORIGIN`
  - CORS 允许来源（compose 默认 `http://localhost:3000`）
- `BASE_URL`
  - 生成分享链接的固定基地址
- `PUBLIC_URL_HEADER`
  - 优先从指定请求头推导对外基地址
- `DISABLE_IP_PORT_ACCESS`
  - `true` 时拒绝 `IP:PORT` 访问（返回 403，提示使用域名）
  - 建议生产环境配合 Nginx/域名启用
- `SELF_HOSTED_BOT_API_SECRET_DIR`
  - 自建模式 API 凭据目录（默认 `/var/lib/tgcd-runtime/self-hosted-bot-api`）
- `SELF_HOSTED_BOT_API_UPLOAD_DIR`
  - 自建模式本地上传目录（默认 `/var/lib/tgcd-runtime/self-hosted-bot-api-upload`）
- `CHUNK_SIZE_BYTES`
  - 上传分片大小（默认 `20MB`）
- `UPLOAD_CONCURRENCY` / `DOWNLOAD_CONCURRENCY`
  - 默认上传/下载并发阈值（默认 `1` / `2`）
- `RESERVED_DISK_BYTES`
  - 临时目录预留空间（默认 `2GB`）
- `UPLOAD_SESSION_TTL_HOURS`
  - 上传会话过期时间（默认 `24`）
- `UPLOAD_SESSION_CLEANUP_INTERVAL_MINUTES`
  - 会话清理周期（默认 `30`）
- `THUMBNAIL_CACHE_MAX_BYTES`
  - 缩略图缓存上限（默认 `512MB`）
- `THUMBNAIL_CACHE_TTL_HOURS`
  - 缩略图缓存 TTL（默认 `720`，即 30 天）
- `THUMBNAIL_GENERATE_CONCURRENCY`
  - 缩略图生成并发（默认 `1`）
- `THUMBNAIL_CACHE_DIR`
  - 缩略图缓存目录
- `FFMPEG_BINARY`
  - ffmpeg 命令路径（默认 `ffmpeg`）
- `TORRENT_ENABLED`
  - 是否启用 Torrent 下载任务（默认 `true`）
- `TORRENT_WORK_DIR`
  - Torrent 元文件目录（默认 `/var/lib/tgcd-runtime/torrents`）
- `TORRENT_DOWNLOAD_DIR`
  - 下载目录（默认 `/var/lib/tgcd-torrent-data`）
- `TORRENT_MAX_METADATA_BYTES`
  - 单个 torrent 元文件大小上限（默认 `4MB`）
- `TORRENT_REQUIRE_PRIVATE`
  - 是否只允许 private torrent（默认 `false`）
- `TORRENT_ALLOWED_ANNOUNCE_DOMAINS`
  - announce 域名白名单（逗号分隔，留空不限制）
- `TORRENT_WORKER_POLL_INTERVAL_SECONDS`
  - worker 轮询周期（默认 `3` 秒）
- `TORRENT_QBT_BASE_URL`
  - qBittorrent WebAPI 地址（默认 `http://qbittorrent:8080`）
- `TORRENT_QBT_USERNAME` / `TORRENT_QBT_PASSWORD`
  - qBittorrent 登录凭据（默认 `admin` / `adminadmin`）
- `TORRENT_QBT_TIMEOUT_SECONDS`
  - qBittorrent API 请求超时（默认 `20` 秒）
- `TORRENT_QBT_DISABLE_DHT_PEX_LSD`
  - `true` 时尝试写入 qBittorrent 偏好关闭 DHT/PEX/LSD
- `TORRENT_QBT_DELETE_ON_COMPLETE`
  - 任务完成后删除 qBittorrent 任务与下载文件（默认 `true`）
- `HOST` / `PORT`
  - 后端监听地址（默认 `0.0.0.0:8080`）

## 本地开发（非 Docker）

### 启动 PostgreSQL（示例）

```bash
docker run --rm -p 5432:5432 \
  -e POSTGRES_DB=tgcd \
  -e POSTGRES_USER=tgcd \
  -e POSTGRES_PASSWORD=tgcd \
  postgres:16
```

### 启动后端

```bash
cd "backend"
export DATABASE_URL="postgres://tgcd:tgcd@localhost:5432/tgcd?sslmode=disable"
go run ./cmd/server
```

### 启动前端

```bash
cd "frontend"
npm install
npm run dev
```

访问：`http://localhost:5173`

## API 概览

### 初始化与鉴权

- `GET /api/setup/status`
- `POST /api/setup/test-connection`
- `POST /api/setup/init`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 设置与服务切换

- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/settings/access`
- `PATCH /api/settings/access`

### 上传下载

- `POST /api/uploads`
- `GET /api/uploads/{id}`
- `POST /api/uploads/{id}/chunks/{index}`
- `POST /api/uploads/{id}/complete`
- `GET|HEAD /api/items/{id}/content`
- `GET /api/items/{id}/thumbnail`
- `GET|HEAD /d/{code}`

### Torrent 任务

- `POST /api/torrents/tasks`（支持 `torrentUrl` 或 `torrentFile`）
- `GET /api/torrents/tasks`
- `GET /api/torrents/tasks/{id}`
- `POST /api/torrents/tasks/{id}/dispatch`（多文件任务选择发送目标）

### 传输历史

- `GET /api/transfers/history`
- `POST /api/transfers/history`
- `DELETE /api/transfers/history`
- `DELETE /api/transfers/history/{id}`

## 持久化与数据卷

compose 默认卷：

- `tgcd_pgdata`：PostgreSQL 数据
- `tgcd_thumbnail_cache`：缩略图缓存
- `telegram_bot_api_data`：Bot API 数据
- `tgcd_runtime`：自建模式运行时文件（凭据/上传 staging）
- `qbittorrent_config`：qBittorrent 配置与状态
- `tgcd_torrent_data`：Torrent 下载目录（qBittorrent / backend / bot-api 共享）

执行 `docker compose down -v` 会清空上述持久化数据。

## 常见问题排查

### 1) 切到自建模式时报 Bot Token 校验失败（EOF / restart）

- 先看 `telegram-bot-api` 日志是否处于凭据等待或重启期
- 确认初始化页或切换弹窗中的 `API ID / API Hash` 填写正确
- 确认容器内地址使用 `http://telegram-bot-api:8081`
- 后端内置了针对自建模式启动期错误的重试（连接会有短暂抖动）

### 2) `expected TELEGRAM_API_ID or TELEGRAM_API_ID_FILE ...`

- 表示 Bot API 进程未拿到凭据
- 检查 `tgcd_runtime` 挂载与 `TELEGRAM_API_ID_FILE` /
  `TELEGRAM_API_HASH_FILE` 是否指向同一路径
- 检查后端是否有权限写 `SELF_HOSTED_BOT_API_SECRET_DIR`

### 3) 重启后偶发进入 `/setup`

- 前端会在启动时调用 `/api/setup/status`
- 后端尚未就绪、网关抖动或数据库短暂不可用时可能临时误判
- 系统已实现重试；若持续出现，请优先检查后端健康与数据库连接

### 4) 缩略图 502

- 检查 `ffmpeg` 是否可执行（`FFMPEG_BINARY`）
- 检查缓存目录可写及磁盘空间
- 过大的源视频可能在截帧阶段超时或失败

### 5) Torrent 任务一直失败（qBittorrent 认证/连接）

- 检查 `qbittorrent` 容器状态与日志
- 确认后端环境变量与下载器一致：
  - `TORRENT_QBT_BASE_URL`
  - `TORRENT_QBT_USERNAME`
  - `TORRENT_QBT_PASSWORD`
- 确认下载目录共享挂载正常（`tgcd_torrent_data`）
- 若是 PT 私有场景，建议启用 `TORRENT_QBT_DISABLE_DHT_PEX_LSD=true`

## 迁移版本

数据库迁移位于 `backend/internal/db/migrations`，当前包含：

- `001`~`014`（含 `system_config` 接入方式扩展、`upload_sessions`
  接入模式字段、`transfer_history` 视频预处理字段、`torrent_tasks`
  异步任务表等）

---

如需进一步按生产环境部署（反向代理、HTTPS、跨域策略、日志采集），建议在现有
compose 基础上增加网关层与监控告警。
