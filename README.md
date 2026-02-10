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
- 视频增强链路：
  - 上传前做 faststart 预处理（失败自动回退原文件）
  - `sendVideo` 支持 `thumbnail` / `cover` 参数
  - 预处理命中/回退状态写入上传响应与传输历史
- 下载与预览支持 `HEAD` / 单段 `Range`

## 技术栈

- 后端：Go、Chi、pgx、PostgreSQL
- 前端：React、TypeScript、Vite、Tailwind、Jotai
- 运行：Docker Compose（postgres + backend + frontend + telegram-bot-api）

## 目录结构

```text
.
├─ backend/
│  ├─ cmd/server/main.go                # 后端入口
│  ├─ internal/api/                     # HTTP API 与核心业务
│  ├─ internal/config/config.go         # 环境变量与默认值
│  ├─ internal/db/migrations/           # SQL 迁移
│  └─ internal/store/                   # 数据访问层
├─ frontend/
│  ├─ src/App.tsx                       # 初始化/鉴权/主页面路由控制
│  └─ src/components/                   # 页面与组件（setup/header/transfer 等）
├─ deploy/telegram-bot-api/
│  └─ runtime-entrypoint.sh             # 自建 Bot API 凭据热更新入口脚本
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

## 迁移版本

数据库迁移位于 `backend/internal/db/migrations`，当前包含：

- `001`~`013`（含 `system_config` 接入方式扩展、`upload_sessions`
  接入模式字段、`transfer_history` 视频预处理字段等）

---

如需进一步按生产环境部署（反向代理、HTTPS、跨域策略、日志采集），建议在现有
compose 基础上增加网关层与监控告警。
