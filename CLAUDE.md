# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

TG Cloud Drive — 基于 Telegram 频道的云存储系统。后端 Go + PostgreSQL 管理元数据，文件存储在 Telegram（官方或自建 Bot API），后端代理下载/预览以隐藏 Bot Token。

## 常用命令

### Docker Compose（推荐）

```bash
docker compose up --build          # 启动全栈（Postgres + Bot API + 后端 + 前端）
docker compose up -d --build       # 后台启动
docker compose down                # 停止服务
docker compose down -v             # 停止并清除所有数据卷
```

### 后端（Go）

```bash
cd backend && go run ./cmd/server                    # 本地运行（需先设 DATABASE_URL）
cd backend && go build -o server ./cmd/server        # 编译二进制
cd backend && go test ./...                          # 运行所有测试
cd backend && go test ./internal/api/ -run TestXxx   # 运行单个测试
cd backend && go fmt ./...                           # 格式化代码
```

本地开发需先启动 PostgreSQL：
```bash
export DATABASE_URL="postgres://tgcd:tgcd@localhost:5432/tgcd?sslmode=disable"
```

### 前端（React + TypeScript）

```bash
cd frontend && npm install         # 安装依赖
cd frontend && npm run dev         # 开发服务器 http://localhost:5173（自动代理 /api 到 :8080）
cd frontend && npm run build       # tsc -b && vite build（类型检查 + 构建）
cd frontend && npm run lint        # ESLint 检查
```

## 架构概览

### 后端分层

```
cmd/server/main.go          → 入口：配置加载、DB 连接池、迁移、HTTP 服务、优雅关闭
internal/config/             → 环境变量配置读取
internal/api/server.go       → Chi 路由定义 + 中间件链（CORS → 日志 → 恢复 → 鉴权）
internal/api/handlers_*.go   → 业务处理器（按功能域拆分）
internal/store/              → 数据访问层（pgx 直接查询，无 ORM）
internal/telegram/client.go  → Telegram Bot API 封装（支持官方/自建热切换）
internal/db/migrations/      → SQL 迁移文件（embed.FS 嵌入，自动版本管理）
```

关键处理器文件：
- `handlers_upload.go` / `handlers_upload_sessions.go` — 上传（会话分片 + 断点续传）
- `handlers_items.go` — 文件/目录 CRUD、回收站、收藏、密码箱
- `handlers_download.go` — 下载与预览（支持 Range）
- `handlers_settings.go` — 设置与接入模式热切换
- `handlers_thumbnail.go` — ffmpeg 视频缩略图（按需生成 + LRU 缓存）
- `handlers_transfers.go` — 传输历史

### 前端分层

```
src/App.tsx                  → 主路由控制（初始化/鉴权/页面切换）
src/components/              → 按功能域组织（file/ layout/ settings/ setup/ transfer/ upload/ vault/ ui/）
src/hooks/                   → 自定义 Hooks（useFiles、useUpload、useTransferCenter 等）
src/stores/                  → Jotai atoms（authAtoms、fileAtoms、uiAtoms、uploadAtoms 等）
src/types/                   → TypeScript 类型定义
src/utils/                   → 工具函数
```

技术栈：React 19 + TypeScript 5.6 + Vite 7 + Tailwind CSS v4 + Jotai + React Router 7

### 数据流

```
浏览器 ──分片上传──→ Go 后端 ──Bot API──→ Telegram 频道
浏览器 ←──代理流──── Go 后端 ←──Bot API──── Telegram 频道
                       ↕
                   PostgreSQL（元数据 + 分片映射）
```

### 关键设计决策

- **Telegram 客户端热切换**：`tgMu` 读写锁保护，切换失败自动回滚，无需重启进程
- **上传双模式**：官方 API 按类型+大小阈值选择 sendPhoto/sendVideo/sendDocument，超限自动分片；自建 API 本地合并后 `file://` 路径上传
- **并发控制**：`transferMu` 互斥锁 + `activeUploads`/`activeDownloads` 计数器限流
- **视频预处理**：faststart remux（无重编码）+ 缩略图生成，失败均自动回退

## 编码规范

- **Go**：`gofmt` 默认风格，PascalCase 导出标识符，表驱动测试
- **TypeScript/React**：PascalCase 组件名，`useXxx` hooks，camelCase 变量/函数
- **路径别名**：前端 `@/*` 映射到 `src/*`
- **Commit**：Conventional Commits（`feat:` / `fix:` / `docs:` 等），单一关注点
- **测试**：修改上传路由、Telegram 客户端行为或 Range/下载逻辑时需补测试

## 服务端口

| 服务 | 端口 |
|------|------|
| 前端（开发） | 5173 |
| 前端（Docker） | 3000 |
| 后端 | 8080 |
| 健康检查 | 8080/healthz |
| PostgreSQL | 5432 |
| 自建 Bot API（容器内部） | 8081 |

## 数据库

PostgreSQL 16，核心表：`items`（文件/文件夹）、`telegram_chunks`（分片映射）、`system_config`（系统配置单例）、`upload_sessions`、`transfer_history`、`runtime_settings`。迁移文件 001-013 位于 `backend/internal/db/migrations/`。
